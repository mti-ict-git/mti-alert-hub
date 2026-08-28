import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { Pool } from "pg";

import { loadEnv } from "../app/config/env.js";
import {
  redactPostgresConnectionConfig,
  resolvePostgresConnectionConfig,
} from "../infrastructure/db/postgres-connection-config.js";

type Arguments = {
  apply: boolean;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    apply: false,
  };

  const args = [...argv];
  const positionals: string[] = [];
  while (args.length > 0) {
    const token = args.shift();
    if (!token) {
      continue;
    }

    if (token === "--") {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    if (token === "--apply") {
      defaults.apply = true;
      continue;
    }
  }

  if (positionals.includes("apply")) {
    defaults.apply = true;
  }

  return defaults;
}

type AppliedMigrationRow = {
  name: string;
  checksum: string;
  appliedAt: string;
};

type RepairItem = {
  name: string;
  appliedChecksum: string;
  fileChecksum: string | null;
  status: "match" | "mismatch" | "file_missing";
};

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const connectionConfig = resolvePostgresConnectionConfig(env);
  const pool = new Pool(connectionConfig);

  try {
    const migrationsDirectory = path.resolve(process.cwd(), "backend", "migrations");
    const applied = await pool.query<AppliedMigrationRow>(
      `
        select
          name,
          checksum,
          applied_at::text as "appliedAt"
        from public.schema_migrations
        order by name asc
      `,
    );

    const items: RepairItem[] = [];
    for (const row of applied.rows) {
      const migrationPath = path.join(migrationsDirectory, row.name);
      try {
        const sql = await fs.readFile(migrationPath, "utf8");
        const fileChecksum = createHash("sha256").update(sql).digest("hex");
        items.push({
          name: row.name,
          appliedChecksum: row.checksum,
          fileChecksum,
          status: row.checksum === fileChecksum ? "match" : "mismatch",
        });
      } catch {
        items.push({
          name: row.name,
          appliedChecksum: row.checksum,
          fileChecksum: null,
          status: "file_missing",
        });
      }
    }

    const mismatches = items.filter((item) => item.status === "mismatch");
    const missing = items.filter((item) => item.status === "file_missing");

    if (!input.apply) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: "dry-run",
            context: {
              connectionString: redactPostgresConnectionConfig(connectionConfig),
            },
            summary: {
              appliedCount: items.length,
              mismatchCount: mismatches.length,
              missingFileCount: missing.length,
            },
            mismatches,
            missingFiles: missing,
            nextCommand: "npm run backend:repair-migration-checksums:dev -- apply",
            warning:
              "Ini hanya memperbaiki metadata checksum agar migrasi bisa lanjut. Jangan dipakai untuk production tanpa audit schema.",
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    if (missing.length > 0) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            reason: "MIGRATION_FILES_MISSING",
            missingFiles: missing,
            context: {
              connectionString: redactPostgresConnectionConfig(connectionConfig),
            },
            hint: "Ada migration yang sudah applied tapi file-nya tidak ada di repo. Tidak aman untuk auto-repair.",
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    await pool.query("begin");
    try {
      for (const item of mismatches) {
        await pool.query(
          `
            update public.schema_migrations
            set checksum = $2
            where name = $1
          `,
          [item.name, item.fileChecksum],
        );
      }
      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "applied",
          context: {
            connectionString: redactPostgresConnectionConfig(connectionConfig),
          },
          summary: {
            appliedCount: items.length,
            repairedCount: mismatches.length,
          },
          repaired: mismatches.map((item) => ({
            name: item.name,
            checksumFromFile: item.fileChecksum,
          })),
          nextCommand: "npm run backend:migrate:dev",
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

