import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { loadEnv } from "../app/config/env.js";
import {
  redactPostgresConnectionConfig,
  resolvePostgresConnectionConfig,
} from "../infrastructure/db/postgres-connection-config.js";
import {
  importPhase1Baseline,
  phase1BaselineImportSchema,
} from "../modules/organization/service/phase1-baseline-import.js";

async function main() {
  const { filePath, dryRun } = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const connectionConfig = resolvePostgresConnectionConfig(env);
  const pool = new Pool(connectionConfig);
  const rawContents = await readFile(filePath, "utf8");
  const payload = phase1BaselineImportSchema.parse(JSON.parse(rawContents));
  let stats = {
    sites: 0,
    areas: 0,
    departments: 0,
    sections: 0,
    employees: 0,
    devices: 0,
  };

  const client = await pool.connect();
  try {
    await client.query("begin");
    stats = await importPhase1Baseline(client, payload);

    if (dryRun) {
      await client.query("rollback");
    } else {
      await client.query("commit");
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    JSON.stringify(
      {
        level: "info",
        message: dryRun
          ? "database.baseline_import.dry_run_completed"
          : "database.baseline_import.completed",
        context: {
          filePath,
          dryRun,
          connectionString: redactPostgresConnectionConfig(connectionConfig),
          stats,
        },
      },
      null,
      2,
    ),
  );
}

function parseArgs(args: string[]) {
  const dryRun = args.includes("--rollback") || args.includes("--dry-run");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) {
    throw new Error(
      'Missing baseline file path. Usage: npm run backend:import:baseline:dev -- "<path-to-json>" [--rollback]',
    );
  }

  return {
    dryRun,
    filePath: path.resolve(process.cwd(), fileArg),
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
