import process from "node:process";

import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/postgres-database.js";

type Arguments = {
  hostname: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    hostname: "",
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

    if (token === "--apply") {
      defaults.apply = true;
      continue;
    }
  }

  if (positionals.includes("apply")) {
    defaults.apply = true;
  }

  const positionalHostname = positionals.find((value) => value !== "apply");
  if (!defaults.hostname && positionalHostname) {
    defaults.hostname = positionalHostname;
  }

  return defaults;
}

const input = parseArgs(process.argv.slice(2));
if (!input.hostname.trim()) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "VALIDATION_ERROR",
        message: "hostname is required",
        example: 'npm run backend:delete-device:dev -- "MTI-OPS-01"',
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

const devices = await client.query<DeviceRow>(
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
  `,
  [input.hostname],
);

if (devices.length === 0) {
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
  process.exit(0);
}

const device = devices[0];
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
  process.exit(0);
}

const deviceId = device.id;

async function countRows(tableName: string, sql: string, params: unknown[]) {
  const rows = await client.maybeQuery<{ count: string }>(tableName, sql, params);
  return Number.parseInt(rows[0]?.count ?? "0", 10) || 0;
}

const counts = {
  deviceSessions: await countRows(
    "device_sessions",
    `select count(*)::text as count from public.device_sessions where device_id::text = $1`,
    [deviceId],
  ),
  realtimeConnections: await countRows(
    "device_realtime_connections",
    `select count(*)::text as count from public.device_realtime_connections where device_id::text = $1`,
    [deviceId],
  ),
  reminderPolicies: await countRows(
    "agent_reminder_policies",
    `select count(*)::text as count from public.agent_reminder_policies where device_id::text = $1`,
    [deviceId],
  ),
  reminderEvents: await countRows(
    "agent_reminder_events",
    `select count(*)::text as count from public.agent_reminder_events where device_id::text = $1`,
    [deviceId],
  ),
  rolloutIntents: await countRows(
    "agent_rollout_intents",
    `select count(*)::text as count from public.agent_rollout_intents where device_id::text = $1`,
    [deviceId],
  ),
  rolloutStatusEvents: await countRows(
    "agent_rollout_status_events",
    `select count(*)::text as count from public.agent_rollout_status_events where device_id::text = $1`,
    [deviceId],
  ),
};

if (!input.apply) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "dry-run",
        target: device,
        relatedRowCounts: counts,
        nextCommand: `npm run backend:delete-device:dev -- --hostname "${device.hostname}" --apply`,
        note: "Delete ini akan menghapus device dan semua data turunan yang pakai ON DELETE CASCADE.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const deleted = await client.query<{ id: string; hostname: string }>(
  `
    delete from public.devices
    where id::text = $1
    returning id::text as id, hostname::text as hostname
  `,
  [deviceId],
);

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "applied",
      deleted: deleted[0] ?? null,
      relatedRowCountsBeforeDelete: counts,
    },
    null,
    2,
  ),
);
