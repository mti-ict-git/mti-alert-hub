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

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    if (token === "--apply") {
      defaults.apply = true;
    }
  }

  if (positionals.includes("apply")) {
    defaults.apply = true;
  }

  return defaults;
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const connectionConfig = resolvePostgresConnectionConfig(env);
  const pool = new Pool(connectionConfig);

  try {
    if (!input.apply) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: "dry-run",
            message:
              "This will drop schema public cascade and recreate it. Run again with --apply to proceed.",
            context: {
              connectionString: redactPostgresConnectionConfig(connectionConfig),
            },
            nextCommand: "npm run backend:reset-db:dev -- --apply",
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    await pool.query("drop schema if exists public cascade");
    await pool.query("create schema public");
    await pool.query("grant usage on schema public to public");
    await pool.query("grant create on schema public to public");

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "applied",
          message: "schema public recreated. Run migrations next.",
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

