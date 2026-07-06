import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { loadEnv } from "../app/config/env.js";
import {
  redactPostgresConnectionConfig,
  resolvePostgresConnectionConfig,
} from "../infrastructure/db/postgres-connection-config.js";

const MIGRATIONS_DIRECTORY = path.resolve(process.cwd(), "backend", "migrations");

type MigrationCommand = "status" | "up";

type MigrationFile = {
  name: string;
  filePath: string;
  checksum: string;
  sql: string;
};

type AppliedMigrationRow = {
  name: string;
  checksum: string;
  appliedAt: string;
};

async function main() {
  const command = parseCommand(process.argv[2]);
  const env = loadEnv();
  const connectionConfig = resolvePostgresConnectionConfig(env);
  const pool = new Pool(connectionConfig);

  try {
    await ensureMigrationTable(pool);
    const migrationFiles = await loadMigrationFiles();
    const appliedMigrations = await loadAppliedMigrations(pool);

    if (command === "status") {
      printStatus(migrationFiles, appliedMigrations);
      return;
    }

    await applyPendingMigrations(pool, migrationFiles, appliedMigrations);
  } finally {
    await pool.end();
  }

  console.log(
    JSON.stringify(
      {
        level: "info",
        message: "database.migrations.completed",
        context: {
          connectionString: redactPostgresConnectionConfig(connectionConfig),
        },
      },
      null,
      2,
    ),
  );
}

function parseCommand(rawCommand: string | undefined): MigrationCommand {
  if (!rawCommand || rawCommand === "up") {
    return "up";
  }

  if (rawCommand === "status") {
    return rawCommand;
  }

  throw new Error(`Unsupported migration command "${rawCommand}". Use "up" or "status".`);
}

async function ensureMigrationTable(pool: Pool) {
  await pool.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function loadMigrationFiles(): Promise<MigrationFile[]> {
  const directoryEntries = await fs.readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });
  const migrationNames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".up.sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const migrationFiles: MigrationFile[] = [];
  for (const name of migrationNames) {
    const filePath = path.join(MIGRATIONS_DIRECTORY, name);
    const sql = await fs.readFile(filePath, "utf8");
    migrationFiles.push({
      name,
      filePath,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }

  return migrationFiles;
}

async function loadAppliedMigrations(pool: Pool) {
  const result = await pool.query<AppliedMigrationRow>(`
    select
      name,
      checksum,
      applied_at::text as "appliedAt"
    from public.schema_migrations
    order by name asc
  `);

  return new Map(result.rows.map((row) => [row.name, row]));
}

function printStatus(
  migrationFiles: MigrationFile[],
  appliedMigrations: Map<string, AppliedMigrationRow>,
) {
  const items = migrationFiles.map((file) => {
    const applied = appliedMigrations.get(file.name);

    if (!applied) {
      return {
        name: file.name,
        status: "pending" as const,
      };
    }

    return {
      name: file.name,
      status: applied.checksum === file.checksum ? ("applied" as const) : ("checksum_mismatch" as const),
      appliedAt: applied.appliedAt,
    };
  });

  console.log(
    JSON.stringify(
      {
        level: "info",
        message: "database.migrations.status",
        context: {
          migrationDirectory: MIGRATIONS_DIRECTORY,
          items,
        },
      },
      null,
      2,
    ),
  );
}

async function applyPendingMigrations(
  pool: Pool,
  migrationFiles: MigrationFile[],
  appliedMigrations: Map<string, AppliedMigrationRow>,
) {
  for (const migration of migrationFiles) {
    const applied = appliedMigrations.get(migration.name);

    if (applied) {
      if (applied.checksum !== migration.checksum) {
        throw new Error(
          `Migration checksum mismatch for "${migration.name}". The applied migration differs from the current file.`,
        );
      }

      continue;
    }

    console.log(
      JSON.stringify(
        {
          level: "info",
          message: "database.migration.applying",
          context: {
            name: migration.name,
            filePath: migration.filePath,
          },
        },
        null,
        2,
      ),
    );

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(migration.sql);
      await client.query(
        `
          insert into public.schema_migrations (name, checksum)
          values ($1, $2)
        `,
        [migration.name, migration.checksum],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
