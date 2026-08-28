import process from "node:process";

import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/postgres-database.js";

type Arguments = {
  hostname: string;
  deviceIdentifier: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    hostname: "",
    deviceIdentifier: "",
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

    if (token === "--hostname") {
      defaults.hostname = args.shift() ?? defaults.hostname;
      continue;
    }

    if (token === "--deviceIdentifier") {
      defaults.deviceIdentifier = args.shift() ?? defaults.deviceIdentifier;
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

  if (!defaults.hostname && positionals.length > 0) {
    defaults.hostname = positionals[0] ?? defaults.hostname;
  }

  if (!defaults.deviceIdentifier && positionals.length > 1) {
    defaults.deviceIdentifier = positionals[1] ?? defaults.deviceIdentifier;
  }

  return defaults;
}

const input = parseArgs(process.argv.slice(2));
if (!input.hostname.trim() || !input.deviceIdentifier.trim()) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "VALIDATION_ERROR",
        message: "hostname dan deviceIdentifier wajib diisi",
        example:
          'npm run backend:update-device-identifier:dev -- "MTI-NB-373" "device-mti-nb-373" apply',
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
  updatedAt: string | null;
};

const rows = await client.query<DeviceRow>(
  `
    select
      d.id::text as id,
      d.hostname::text as hostname,
      d.device_identifier::text as "deviceIdentifier",
      d.agent_version::text as "agentVersion",
      d.status::text as status,
      d.updated_at::text as "updatedAt"
    from public.devices d
    where lower(d.hostname) = lower($1)
    order by d.updated_at desc
    limit 1
  `,
  [input.hostname],
);

const device = rows[0] ?? null;
if (!device) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "DEVICE_NOT_FOUND",
        hostname: input.hostname,
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
        before: device,
        after: {
          ...device,
          deviceIdentifier: input.deviceIdentifier,
        },
        nextCommand: `npm run backend:update-device-identifier:dev -- "${device.hostname}" "${input.deviceIdentifier}" apply`,
        warning:
          "Kalau deviceIdentifier ini dipakai agent real untuk /agent/session & /agent/heartbeat, pastikan agent juga ikut pakai nilai yang sama.",
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
    set
      device_identifier = $2,
      updated_at = now()
    where id::text = $1
  `,
  [device.id, input.deviceIdentifier],
);

const updatedRows = await client.query<DeviceRow>(
  `
    select
      d.id::text as id,
      d.hostname::text as hostname,
      d.device_identifier::text as "deviceIdentifier",
      d.agent_version::text as "agentVersion",
      d.status::text as status,
      d.updated_at::text as "updatedAt"
    from public.devices d
    where id::text = $1
    limit 1
  `,
  [device.id],
);

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "applied",
      device: updatedRows[0] ?? null,
    },
    null,
    2,
  ),
);
