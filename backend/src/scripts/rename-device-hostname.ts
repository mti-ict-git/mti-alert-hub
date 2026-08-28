import process from "node:process";

import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/postgres-database.js";

type Arguments = {
  fromHostname: string;
  toHostname: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    fromHostname: "",
    toHostname: "",
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

    if (token === "--from") {
      defaults.fromHostname = args.shift() ?? defaults.fromHostname;
      continue;
    }

    if (token === "--to") {
      defaults.toHostname = args.shift() ?? defaults.toHostname;
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

  if (!defaults.fromHostname && positionals.length > 0) {
    defaults.fromHostname = positionals[0] ?? defaults.fromHostname;
  }

  if (!defaults.toHostname && positionals.length > 1) {
    defaults.toHostname = positionals[1] ?? defaults.toHostname;
  }

  return defaults;
}

const input = parseArgs(process.argv.slice(2));
if (!input.fromHostname.trim() || !input.toHostname.trim()) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "VALIDATION_ERROR",
        message: "--from and --to are required",
        example: 'npm run backend:rename-device-hostname:dev -- "MTI-OPS-01" "MTI-NB-373" --apply',
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const env = loadEnv();
const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const { client } = bootstrapDatabase(env, logger);

type DeviceRow = {
  id: string;
  hostname: string;
  deviceIdentifier: string | null;
  agentVersion: string | null;
  status: string | null;
  siteId: string;
  updatedAt: string | null;
};

async function findByHostname(hostname: string) {
  const rows = await client.query<DeviceRow>(
    `
      select
        d.id::text as id,
        d.hostname::text as hostname,
        d.device_identifier::text as "deviceIdentifier",
        d.agent_version::text as "agentVersion",
        d.status::text as status,
        d.site_id::text as "siteId",
        d.updated_at::text as "updatedAt"
      from public.devices d
      where lower(d.hostname) = lower($1)
      order by d.updated_at desc
      limit 5
    `,
    [hostname],
  );
  return rows;
}

const fromRows = await findByHostname(input.fromHostname);
const toRows = await findByHostname(input.toHostname);

const from = fromRows[0] ?? null;
if (!from) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "FROM_DEVICE_NOT_FOUND",
        fromHostname: input.fromHostname,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

if (toRows.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "TARGET_HOSTNAME_ALREADY_EXISTS",
        fromHostname: input.fromHostname,
        toHostname: input.toHostname,
        from,
        existing: toRows,
        hint: "Hapus dulu device dengan hostname target (atau rename target) karena hostname unik.",
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
        from,
        toHostname: input.toHostname,
        nextCommand: `npm run backend:rename-device-hostname:dev -- --from "${from.hostname}" --to "${input.toHostname}" --apply`,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await client.query(
  `
    update public.devices
    set hostname = $2,
        updated_at = now()
    where id::text = $1
  `,
  [from.id, input.toHostname],
);

const updatedRows = await findByHostname(input.toHostname);
console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "applied",
      updated: updatedRows[0] ?? null,
    },
    null,
    2,
  ),
);
