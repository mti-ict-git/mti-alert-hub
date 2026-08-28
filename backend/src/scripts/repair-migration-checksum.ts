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
  name: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    name: "0001_phase1_foundation.up.sql",
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

    if (token === "--name") {
      defaults.name = args.shift() ?? defaults.name;
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

  const positionalName = positionals.find((value) => value !== "apply");
  if (positionalName && defaults.name === "0001_phase1_foundation.up.sql") {
    defaults.name = positionalName;
  }

  return defaults;
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const connectionConfig = resolvePostgresConnectionConfig(env);
  const pool = new Pool(connectionConfig);

  try {
    const migrationsDirectory = path.resolve(process.cwd(), "backend", "migrations");
    const migrationPath = path.join(migrationsDirectory, input.name);
    const sql = await fs.readFile(migrationPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    const applied = await pool.query<{ name: string; checksum: string; applied_at: string }>(
      `
        select name, checksum, applied_at::text as applied_at
        from public.schema_migrations
        where name = $1
        limit 1
      `,
      [input.name],
    );

    const row = applied.rows[0];
    if (!row) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            reason: "MIGRATION_NOT_APPLIED",
            name: input.name,
            context: {
              connectionString: redactPostgresConnectionConfig(connectionConfig),
            },
            hint: "Migration belum ada di schema_migrations, jadi tidak perlu repair checksum.",
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    if (!input.apply) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: "dry-run",
            name: input.name,
            appliedAt: row.applied_at,
            currentChecksumInDb: row.checksum,
            checksumFromFile: checksum,
            matches: row.checksum === checksum,
            context: {
              connectionString: redactPostgresConnectionConfig(connectionConfig),
            },
            nextCommand: `npm run backend:repair-migration-checksum:dev -- --name "${input.name}" --apply`,
            warning:
              "Ini hanya memperbaiki metadata checksum. Pastikan schema DB benar-benar kompatibel dengan file migration saat ini.",
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    await pool.query(
      `
        update public.schema_migrations
        set checksum = $2
        where name = $1
      `,
      [input.name, checksum],
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "applied",
          name: input.name,
          checksumFromFile: checksum,
          context: {
            connectionString: redactPostgresConnectionConfig(connectionConfig),
          },
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
