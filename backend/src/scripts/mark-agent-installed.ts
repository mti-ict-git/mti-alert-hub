import os from "node:os";
import process from "node:process";

import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/postgres-database.js";

type Arguments = {
  hostname: string;
  deviceIdentifier: string | null;
  agentVersion: string;
  apply: boolean;
  createIfMissing: boolean;
  siteCode: string | null;
  siteId: string | null;
};

function looksLikeSemver(value: string) {
  return /^\d+\.\d+\.\d+/.test(value.trim());
}

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    hostname: os.hostname(),
    deviceIdentifier: null,
    agentVersion: "0.0.0-test",
    apply: false,
    createIfMissing: false,
    siteCode: null,
    siteId: null,
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

    if (token === "--agentVersion") {
      defaults.agentVersion = args.shift() ?? defaults.agentVersion;
      continue;
    }

    if (token === "--apply") {
      defaults.apply = true;
      continue;
    }

    if (token === "--createIfMissing") {
      defaults.createIfMissing = true;
      continue;
    }

    if (token === "--siteCode") {
      defaults.siteCode = args.shift() ?? defaults.siteCode;
      continue;
    }

    if (token === "--siteId") {
      defaults.siteId = args.shift() ?? defaults.siteId;
      continue;
    }
  }

  if (positionals.length > 0 && defaults.hostname === os.hostname()) {
    defaults.hostname = positionals[0] ?? defaults.hostname;
  }

  if (positionals.includes("apply")) {
    defaults.apply = true;
  }

  if (positionals.includes("createIfMissing")) {
    defaults.createIfMissing = true;
  }

  const valueArgs = positionals.filter((value) => value !== "apply" && value !== "createIfMissing");
  if (valueArgs.length > 1) {
    const second = valueArgs[1] ?? "";
    if (looksLikeSemver(second)) {
      if (defaults.agentVersion === "0.0.0-test") {
        defaults.agentVersion = second;
      }
      if (valueArgs.length > 2 && !defaults.siteId) {
        defaults.siteId = valueArgs[2] ?? defaults.siteId;
      }
    } else {
      if (!defaults.deviceIdentifier) {
        defaults.deviceIdentifier = second;
      }
      if (valueArgs.length > 2 && defaults.agentVersion === "0.0.0-test") {
        defaults.agentVersion = valueArgs[2] ?? defaults.agentVersion;
      }
      if (valueArgs.length > 3 && !defaults.siteId) {
        defaults.siteId = valueArgs[3] ?? defaults.siteId;
      }
    }
  }

  return defaults;
}

const input = parseArgs(process.argv.slice(2));
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
  deviceIdentifier: string | null;
  hostname: string;
  agentVersion: string | null;
  status: string | null;
  lastHeartbeatAt: string | null;
  lastConnectionAt: string | null;
};

type SiteRow = {
  id: string;
  code: string;
  name: string;
  status: string;
};

const devices = await client.query<DeviceRow>(
  `
    select
      d.id::text as id,
      d.device_identifier as "deviceIdentifier",
      d.hostname as hostname,
      d.agent_version as "agentVersion",
      d.status as status,
      d.last_heartbeat_at::text as "lastHeartbeatAt",
      d.last_connection_at::text as "lastConnectionAt"
    from public.devices d
    where lower(d.hostname) = lower($1)
    order by d.updated_at desc
    limit 5
  `,
  [input.hostname],
);

let ensuredDeviceId: string | null = devices[0]?.id ?? null;

if (!input.apply) {
  if (!ensuredDeviceId) {
    const sites = await client.query<SiteRow>(
      `
        select
          s.id::text as id,
          s.code as code,
          s.name as name,
          s.status as status
        from public.sites s
        where s.status = 'Active'
        order by s.created_at asc
        limit 10
      `,
    );

    const siteHint = sites.length > 0 ? sites[0] : null;
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "dry-run",
          reason: "DEVICE_NOT_FOUND",
          hostname: input.hostname,
          hint:
            "Device belum ada di tabel public.devices. Jalankan lagi dengan --createIfMissing untuk membuat record device (testing).",
          suggestedSite: siteHint,
          availableSites: sites,
          nextCommand:
            siteHint
              ? `npm run backend:mark-agent-installed:dev -- "${input.hostname}" "${input.agentVersion}" "${siteHint.id}" createIfMissing apply`
              : `npm run backend:mark-agent-installed:dev -- "${input.hostname}" "${input.agentVersion}" createIfMissing apply`,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "dry-run",
        targetDevice: devices[0] ?? null,
        nextCommand: `npm run backend:mark-agent-installed:dev -- "${input.hostname}" "${input.agentVersion}" apply`,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!ensuredDeviceId) {
  if (!input.createIfMissing) {
    const sites = await client.query<SiteRow>(
      `
        select
          s.id::text as id,
          s.code as code,
          s.name as name,
          s.status as status
        from public.sites s
        where s.status = 'Active'
        order by s.created_at asc
        limit 10
      `,
    );
    const siteHint = sites.length > 0 ? sites[0] : null;

    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "DEVICE_NOT_FOUND",
          hostname: input.hostname,
          hint:
            "Device belum ada di tabel public.devices. Jalankan lagi dengan --createIfMissing untuk membuat record device (testing).",
          suggestedSite: siteHint,
          availableSites: sites,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let resolvedSiteId = input.siteId;
  if (!resolvedSiteId && input.siteCode) {
    const siteRows = await client.query<{ id: string }>(
      `
        select s.id::text as id
        from public.sites s
        where s.code = $1
        limit 1
      `,
      [input.siteCode],
    );
    resolvedSiteId = siteRows[0]?.id ?? null;
  }

  if (!resolvedSiteId) {
    const siteRows = await client.query<{ id: string }>(
      `
        select s.id::text as id
        from public.sites s
        where s.status = 'Active'
        order by s.created_at asc
        limit 1
      `,
    );
    resolvedSiteId = siteRows[0]?.id ?? null;
  }

  if (!resolvedSiteId) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "SITE_NOT_FOUND",
          hostname: input.hostname,
          hint: "Tidak ada site aktif di tabel public.sites. Import baseline dulu atau buat site manual.",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const created = await client.query<{ id: string }>(
    `
      insert into public.devices (
        hostname,
        device_identifier,
        site_id,
        ownership_mode,
        status
      )
      values (
        $1,
        $2,
        $3::uuid,
        'LocationOwned',
        'Online'
      )
      returning id::text as id
    `,
    [input.hostname, input.deviceIdentifier, resolvedSiteId],
  );

  ensuredDeviceId = created[0]?.id ?? "";
  if (!ensuredDeviceId) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "DEVICE_CREATE_FAILED",
          hostname: input.hostname,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

await client.query(
  `
    update public.devices
    set
      device_identifier = coalesce($2, device_identifier),
      agent_version = $3,
      last_connection_at = now(),
      last_heartbeat_at = now(),
      status = 'Online',
      updated_at = now()
    where id::text = $1
  `,
  [ensuredDeviceId, input.deviceIdentifier, input.agentVersion],
);

const updated = await client.query<DeviceRow>(
  `
    select
      d.id::text as id,
      d.device_identifier as "deviceIdentifier",
      d.hostname as hostname,
      d.agent_version as "agentVersion",
      d.status as status,
      d.last_heartbeat_at::text as "lastHeartbeatAt",
      d.last_connection_at::text as "lastConnectionAt"
    from public.devices d
    where d.id::text = $1
    limit 1
  `,
  [ensuredDeviceId],
);

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "applied",
      device: updated[0] ?? null,
    },
    null,
    2,
  ),
);
