import process from "node:process";

import { loadEnv, resolveDeviceHealthThresholds } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/postgres-database.js";
import { buildDeviceHealthStatusSql } from "../modules/devices/service/device-health-sql.js";

type Arguments = {
  limit: number;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    limit: 50,
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

    if (token === "--limit") {
      const raw = args.shift();
      const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
      defaults.limit = Number.isFinite(parsed) ? parsed : defaults.limit;
    }
  }

  if (positionals.length > 0 && defaults.limit === 50) {
    const parsed = Number.parseInt(positionals[0] ?? "", 10);
    if (Number.isFinite(parsed)) {
      defaults.limit = parsed;
    }
  }

  return defaults;
}

const input = parseArgs(process.argv.slice(2));
const env = loadEnv();
const statusSql = buildDeviceHealthStatusSql(resolveDeviceHealthThresholds(env));
const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const { client } = bootstrapDatabase(env, logger);

type DeviceListRow = {
  id: string;
  hostname: string;
  agentVersion: string | null;
  status: string | null;
  lastHeartbeatAt: string | null;
  lastConnectionAt: string | null;
  siteCode: string | null;
  siteName: string | null;
};

const devices = await client.query<DeviceListRow>(
  `
    select
      d.id::text as id,
      d.hostname as hostname,
      d.agent_version as "agentVersion",
      ${statusSql}::text as status,
      d.last_heartbeat_at::text as "lastHeartbeatAt",
      d.last_connection_at::text as "lastConnectionAt",
      s.code as "siteCode",
      s.name as "siteName"
    from public.devices d
    left join public.sites s
      on s.id = d.site_id
    order by d.updated_at desc
    limit $1
  `,
  [input.limit],
);

console.log(
  JSON.stringify(
    {
      ok: true,
      limit: input.limit,
      count: devices.length,
      devices,
    },
    null,
    2,
  ),
);
