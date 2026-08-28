import process from "node:process";

import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/postgres-database.js";

type RolloutAction = "Upgrade" | "Repair" | "Uninstall";

type Arguments = {
  hostname: string;
  version: string;
  packageUrl: string;
  sha256: string;
  signature: string;
  rolloutChannel: string;
  action: RolloutAction;
  mandatory: boolean;
  notes: string;
  releaseNotes: string;
  deadlineAt: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Arguments {
  const defaults: Arguments = {
    hostname: "",
    version: "",
    packageUrl: "",
    sha256: "",
    signature: "",
    rolloutChannel: "pilot",
    action: "Upgrade",
    mandatory: false,
    notes: "",
    releaseNotes: "",
    deadlineAt: "",
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

    if (token === "--version") {
      defaults.version = args.shift() ?? defaults.version;
      continue;
    }

    if (token === "--package-url") {
      defaults.packageUrl = args.shift() ?? defaults.packageUrl;
      continue;
    }

    if (token === "--sha256") {
      defaults.sha256 = args.shift() ?? defaults.sha256;
      continue;
    }

    if (token === "--signature") {
      defaults.signature = args.shift() ?? defaults.signature;
      continue;
    }

    if (token === "--rollout-channel") {
      defaults.rolloutChannel = args.shift() ?? defaults.rolloutChannel;
      continue;
    }

    if (token === "--action") {
      const value = args.shift();
      if (value === "Upgrade" || value === "Repair" || value === "Uninstall") {
        defaults.action = value;
      }
      continue;
    }

    if (token === "--notes") {
      defaults.notes = args.shift() ?? defaults.notes;
      continue;
    }

    if (token === "--release-notes") {
      defaults.releaseNotes = args.shift() ?? defaults.releaseNotes;
      continue;
    }

    if (token === "--deadline-at") {
      defaults.deadlineAt = args.shift() ?? defaults.deadlineAt;
      continue;
    }

    if (token === "--mandatory") {
      defaults.mandatory = true;
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

function fail(message: string, example: string) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "VALIDATION_ERROR",
        message,
        example,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

function ensureRequired(value: string, name: string, example: string) {
  if (!value.trim()) {
    fail(`${name} is required`, example);
  }
}

function ensureUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("packageUrl must use http or https.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "packageUrl must be a valid URL.";
    fail(message, exampleCommand(true));
  }
}

function ensureDeadline(value: string) {
  if (!value.trim()) {
    return;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    fail("deadlineAt must be a valid ISO-8601 timestamp.", exampleCommand(true));
  }
}

function exampleCommand(includeApply: boolean) {
  const command =
    'npm run backend:create-agent-rollout:dev -- --hostname "MTI-NB-373" --version "1.0.1" --package-url "https://downloads.example.com/MTI.Alert.Agent.Setup.msi" --sha256 "ABC123..." --signature "CERT_THUMBPRINT" --notes "Pilot upgrade"';

  return includeApply ? `${command} --apply` : command;
}

function buildCommand(args: Arguments, includeApply: boolean) {
  const parts = [
    "npm run backend:create-agent-rollout:dev --",
    `--hostname "${args.hostname}"`,
    `--version "${args.version}"`,
    `--package-url "${args.packageUrl}"`,
    `--sha256 "${args.sha256}"`,
    `--signature "${args.signature}"`,
  ];

  if (args.rolloutChannel.trim()) {
    parts.push(`--rollout-channel "${args.rolloutChannel}"`);
  }

  if (args.action !== "Upgrade") {
    parts.push(`--action "${args.action}"`);
  }

  if (args.notes.trim()) {
    parts.push(`--notes "${args.notes}"`);
  }

  if (args.releaseNotes.trim()) {
    parts.push(`--release-notes "${args.releaseNotes}"`);
  }

  if (args.deadlineAt.trim()) {
    parts.push(`--deadline-at "${args.deadlineAt}"`);
  }

  if (args.mandatory) {
    parts.push("--mandatory");
  }

  if (includeApply) {
    parts.push("--apply");
  }

  return parts.join(" ");
}

const input = parseArgs(process.argv.slice(2));
ensureRequired(input.hostname, "hostname", exampleCommand(false));
ensureRequired(input.version, "version", exampleCommand(false));
ensureRequired(input.packageUrl, "packageUrl", exampleCommand(false));
ensureRequired(input.sha256, "sha256", exampleCommand(false));
ensureRequired(input.signature, "signature", exampleCommand(false));
ensureUrl(input.packageUrl);
ensureDeadline(input.deadlineAt);

const env = loadEnv();
const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const { client } = bootstrapDatabase(env, logger);

const requiredTables = ["devices", "agent_release_packages", "agent_rollout_intents"];
for (const tableName of requiredTables) {
  const exists = await client.tableExists(tableName);
  if (!exists) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "MISSING_TABLE",
          table: tableName,
          message: "Run backend migrations first.",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

type DeviceRow = {
  id: string;
  hostname: string;
  deviceIdentifier: string | null;
  agentVersion: string | null;
  status: string | null;
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
      d.updated_at::text as "updatedAt"
    from public.devices d
    where lower(d.hostname) = lower($1)
    order by d.updated_at desc
    limit 1
  `,
  [input.hostname],
);

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

const activeRolloutCount = await client.query<{ count: string }>(
  `
    select count(*)::text as count
    from public.agent_rollout_intents
    where device_id = $1::uuid
      and is_active = true
  `,
  [device.id],
);

const dryRunPayload = {
  ok: true,
  mode: "dry-run",
  target: device,
  rollout: {
    action: input.action,
    targetVersion: input.version,
    rolloutChannel: input.rolloutChannel || null,
    mandatory: input.mandatory,
    deadlineAt: input.deadlineAt || null,
    notes: input.notes || null,
  },
  package: {
    packageType: "MSI",
    packageUrl: input.packageUrl,
    sha256: input.sha256,
    signature: input.signature,
    releaseNotes: input.releaseNotes || null,
  },
  currentlyActiveRollouts: Number.parseInt(activeRolloutCount[0]?.count ?? "0", 10) || 0,
  nextCommand: buildCommand(input, true),
};

if (!input.apply) {
  console.log(JSON.stringify(dryRunPayload, null, 2));
  process.exit(0);
}

type UpsertedReleasePackage = {
  id: string;
  version: string;
  packageUrl: string;
};

type InsertedRolloutIntent = {
  id: string;
  action: string;
  targetVersion: string;
  createdAt: string;
};

const result = await client.withTransaction(async (transaction) => {
  const releasePackages = await transaction.query<UpsertedReleasePackage>(
    `
      insert into public.agent_release_packages (
        version,
        package_type,
        package_url,
        sha256,
        signature,
        release_notes
      )
      values (
        $1,
        'MSI',
        $2,
        $3,
        $4,
        $5
      )
      on conflict (version, package_type)
      do update
      set
        package_url = excluded.package_url,
        sha256 = excluded.sha256,
        signature = excluded.signature,
        release_notes = excluded.release_notes,
        updated_at = now()
      returning
        id::text as id,
        version::text as version,
        package_url::text as "packageUrl"
    `,
    [
      input.version,
      input.packageUrl,
      input.sha256,
      input.signature,
      input.releaseNotes || null,
    ],
  );

  const releasePackage = releasePackages[0];
  if (!releasePackage) {
    throw new Error("Failed to upsert release package.");
  }

  const deactivated = await transaction.query<{ id: string }>(
    `
      update public.agent_rollout_intents
      set
        is_active = false,
        updated_at = now()
      where device_id = $1::uuid
        and is_active = true
      returning id::text as id
    `,
    [device.id],
  );

  const rolloutIntents = await transaction.query<InsertedRolloutIntent>(
    `
      insert into public.agent_rollout_intents (
        device_id,
        release_package_id,
        action,
        rollout_channel,
        target_version,
        mandatory,
        deadline_at,
        notes,
        is_active
      )
      values (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7::timestamptz,
        $8,
        true
      )
      returning
        id::text as id,
        action::text as action,
        target_version::text as "targetVersion",
        created_at::text as "createdAt"
    `,
    [
      device.id,
      releasePackage.id,
      input.action,
      input.rolloutChannel || null,
      input.version,
      input.mandatory,
      input.deadlineAt || null,
      input.notes || null,
    ],
  );

  const rolloutIntent = rolloutIntents[0];
  if (!rolloutIntent) {
    throw new Error("Failed to create rollout intent.");
  }

  return {
    releasePackage,
    rolloutIntent,
    deactivatedCount: deactivated.length,
  };
});

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "applied",
      target: device,
      deactivatedPreviousRollouts: result.deactivatedCount,
      releasePackage: result.releasePackage,
      rolloutIntent: result.rolloutIntent,
    },
    null,
    2,
  ),
);
