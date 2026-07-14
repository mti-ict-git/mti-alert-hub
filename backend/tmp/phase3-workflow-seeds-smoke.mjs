import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import pg from "pg";

const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
const env = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex);
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value =
        rawValue.startsWith("\"") && rawValue.endsWith("\"")
          ? rawValue.slice(1, -1)
          : rawValue;
      return [key, value];
    }),
);

const adminUsername = process.env.LDAP_USER ?? env.LDAP_USER;
const adminPassword = process.env.LDAP_PASS ?? env.LDAP_PASS;
const postgresUrl = env.POSTGRES_URL;
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4026";

if (!adminUsername || !adminPassword) {
  throw new Error("LDAP_USER and LDAP_PASS must be available in the environment.");
}
if (!postgresUrl) {
  throw new Error("POSTGRES_URL must be available in the environment.");
}

const managedWorkflowSeeds = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Critical Acknowledgement",
    description: "Baseline critical workflow for alert acknowledgement and assistance requests.",
    workflowType: "TemplateSelected",
    allowFreeText: false,
    requireFreeText: false,
    escalationTimeoutMinutes: 15,
    escalationMode: "RecipientOnly",
    responseImpliesAck: true,
    options: [
      {
        id: "11111111-aaaa-1111-aaaa-111111111111",
        key: "safe",
        label: "Safe",
        sortOrder: 1,
      },
      {
        id: "11111111-bbbb-1111-bbbb-111111111111",
        key: "assist",
        label: "Need Assistance",
        sortOrder: 2,
      },
      {
        id: "11111111-cccc-1111-cccc-111111111111",
        key: "away",
        label: "Not In Area",
        sortOrder: 3,
      },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Reminder Confirmation",
    description: "Simple reminder confirmation workflow.",
    workflowType: "TemplateSelected",
    allowFreeText: false,
    requireFreeText: false,
    escalationTimeoutMinutes: null,
    escalationMode: "RecipientOnly",
    responseImpliesAck: true,
    options: [
      {
        id: "22222222-aaaa-2222-aaaa-222222222222",
        key: "done",
        label: "Acknowledged",
        sortOrder: 1,
      },
    ],
  },
];

const json = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const postJson = async (url, body, token) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await json(response);
  if (!response.ok) {
    throw new Error(`${response.status} ${url} :: ${JSON.stringify(data)}`);
  }
  return data;
};

const getJson = async (url, token) => {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await json(response);
  if (!response.ok) {
    throw new Error(`${response.status} ${url} :: ${JSON.stringify(data)}`);
  }
  return data;
};

const { Client } = pg;
const resolvedPostgresUrl = new URL(postgresUrl);
resolvedPostgresUrl.username = encodeURIComponent(
  process.env.POSTGRES_USERNAME ?? env.POSTGRES_USERNAME ?? decodeURIComponent(resolvedPostgresUrl.username),
);
resolvedPostgresUrl.password = encodeURIComponent(
  process.env.POSTGRES_PASSWORD ?? env.POSTGRES_PASSWORD ?? decodeURIComponent(resolvedPostgresUrl.password),
);
resolvedPostgresUrl.pathname = `/${process.env.POSTGRES_DATABASE ?? env.POSTGRES_DATABASE ?? resolvedPostgresUrl.pathname.replace(/^\//, "")}`;
const db = new Client({
  connectionString: resolvedPostgresUrl.toString(),
  ssl:
    (process.env.POSTGRES_SSL ?? env.POSTGRES_SSL) === "true"
      ? {
          rejectUnauthorized:
            (process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED ?? env.POSTGRES_SSL_REJECT_UNAUTHORIZED) === "true",
        }
      : false,
});

await db.connect();

async function syncManagedSeeds() {
  for (const seed of managedWorkflowSeeds) {
    await db.query(
      `
        insert into public.response_workflows (
          id,
          name,
          description,
          workflow_type,
          allow_free_text,
          require_free_text,
          escalation_timeout_minutes,
          escalation_mode,
          response_implies_ack
        )
        values (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        on conflict (id) do update
        set
          name = excluded.name,
          description = excluded.description,
          workflow_type = excluded.workflow_type,
          allow_free_text = excluded.allow_free_text,
          require_free_text = excluded.require_free_text,
          escalation_timeout_minutes = excluded.escalation_timeout_minutes,
          escalation_mode = excluded.escalation_mode,
          response_implies_ack = excluded.response_implies_ack
      `,
      [
        seed.id,
        seed.name,
        seed.description,
        seed.workflowType,
        seed.allowFreeText,
        seed.requireFreeText,
        seed.escalationTimeoutMinutes,
        seed.escalationMode,
        seed.responseImpliesAck,
      ],
    );

    await db.query(
      `
        delete from public.response_workflow_options
        where workflow_id = $1::uuid
          and not (id::text = any($2::text[]))
      `,
      [seed.id, seed.options.map((option) => option.id)],
    );

    for (const option of seed.options) {
      await db.query(
        `
          insert into public.response_workflow_options (
            id,
            workflow_id,
            option_key,
            option_label,
            sort_order
          )
          values (
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5
          )
          on conflict (id) do update
          set
            workflow_id = excluded.workflow_id,
            option_key = excluded.option_key,
            option_label = excluded.option_label,
            sort_order = excluded.sort_order
        `,
        [option.id, seed.id, option.key, option.label, option.sortOrder],
      );
    }
  }
}

async function waitForServer(url, processHandle, startupLogs) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Backend exited early during workflow seed smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for workflow seed smoke.\n${startupLogs.value}`);
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  await syncManagedSeeds();

  await db.query(
    `
      update public.response_workflows
      set
        name = 'Drifted Workflow Name',
        escalation_timeout_minutes = 99
      where id = '11111111-1111-1111-1111-111111111111'::uuid
    `,
  );
  await db.query(
    `
      delete from public.response_workflow_options
      where id = '22222222-aaaa-2222-aaaa-222222222222'::uuid
    `,
  );

  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_PORT: "4026",
      LDAP_ALLOWED_GROUPS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout?.on("data", (chunk) => {
    startupLogs.value += chunk.toString();
  });
  backendProcess.stderr?.on("data", (chunk) => {
    startupLogs.value += chunk.toString();
  });

  await waitForServer(baseUrl, backendProcess, startupLogs);

  const adminSession = await postJson(`${baseUrl}/auth/login`, {
    username: adminUsername,
    password: adminPassword,
  });
  const adminToken = adminSession.sessionToken;

  const workflows = await getJson(`${baseUrl}/workflows?page=1&pageSize=20`, adminToken);
  const criticalWorkflow = workflows.items.find((item) => item.id === managedWorkflowSeeds[0].id);
  const reminderWorkflow = workflows.items.find((item) => item.id === managedWorkflowSeeds[1].id);

  if (!criticalWorkflow || !reminderWorkflow) {
    throw new Error(`Managed workflows were not returned: ${JSON.stringify(workflows)}`);
  }

  if (
    criticalWorkflow.name !== managedWorkflowSeeds[0].name ||
    criticalWorkflow.escalationTimeoutMinutes !== managedWorkflowSeeds[0].escalationTimeoutMinutes ||
    criticalWorkflow.options.length !== managedWorkflowSeeds[0].options.length
  ) {
    throw new Error(`Critical workflow was not restored to the managed baseline: ${JSON.stringify(criticalWorkflow)}`);
  }

  if (
    reminderWorkflow.options.length !== managedWorkflowSeeds[1].options.length ||
    reminderWorkflow.options[0]?.label !== managedWorkflowSeeds[1].options[0]?.label
  ) {
    throw new Error(`Reminder workflow option seed was not restored: ${JSON.stringify(reminderWorkflow)}`);
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        totalItems: workflows.page.totalItems,
        criticalWorkflow: {
          id: criticalWorkflow.id,
          name: criticalWorkflow.name,
          optionCount: criticalWorkflow.options.length,
          escalationTimeoutMinutes: criticalWorkflow.escalationTimeoutMinutes,
        },
        reminderWorkflow: {
          id: reminderWorkflow.id,
          name: reminderWorkflow.name,
          optionCount: reminderWorkflow.options.length,
          firstOptionLabel: reminderWorkflow.options[0]?.label ?? null,
        },
      },
      null,
      2,
    ),
  );
} finally {
  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill("SIGTERM");
    await new Promise((resolveExit) => {
      backendProcess.once("exit", () => resolveExit());
      setTimeout(() => resolveExit(), 2_000);
    });
  }

  await syncManagedSeeds();
  await db.end();
}
