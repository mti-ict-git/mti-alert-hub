import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

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
const baseUrl = "http://127.0.0.1:4033";

if (!adminUsername || !adminPassword) {
  throw new Error("LDAP_USER and LDAP_PASS must be available in the environment.");
}

const json = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const postJson = async (url, body, token, expectedStatus = 200) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await json(response);
  if (response.status !== expectedStatus) {
    throw new Error(`${response.status} ${url} :: ${JSON.stringify(data)}`);
  }
  return data;
};

const getJson = async (url, token, expectedStatus = 200) => {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await json(response);
  if (response.status !== expectedStatus) {
    throw new Error(`${response.status} ${url} :: ${JSON.stringify(data)}`);
  }
  return data;
};

async function waitForServer(url, processHandle, startupLogs) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Backend exited early during reminder hybrid smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for reminder hybrid smoke.\n${startupLogs.value}`);
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      BACKEND_PORT: "4033",
      LDAP_ALLOWED_GROUPS: "",
      ENABLED_DELIVERY_CHANNELS: "WindowsAgent",
      ADMIN_SESSION_TTL_MINUTES: "120",
      AGENT_SESSION_TTL_MINUTES: "30",
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

  const devices = await getJson(`${baseUrl}/devices?page=1&pageSize=20`, adminToken);
  const device = devices.items.find((item) => item.deviceIdentifier === "device-mti-ops-01") ?? devices.items[0];
  if (!device) {
    throw new Error("No device baseline found for reminder hybrid smoke.");
  }

  const draft = await postJson(
    `${baseUrl}/communications`,
    {
      communicationType: "Reminder",
      priority: "Info",
      category: "General",
      title: "Phase 4 Hybrid Reminder Smoke",
      body: "Hydrate, stretch, and confirm workstation readiness.",
      channelSelections: ["WindowsAgent"],
      targets: [{ targetType: "Device", targetValue: device.deviceIdentifier }],
      workflowId: null,
      windowsAgentPresentation: "Toast",
      deliveryStrategy: null,
    },
    adminToken,
    201,
  );

  const now = Date.now();
  const publishResponse = await postJson(
    `${baseUrl}/communications/${draft.id}/publish`,
    {
      publishMode: "Recurring",
      scheduledAt: new Date(now + 5 * 60 * 1000).toISOString(),
      recurrenceRule: "FREQ=DAILY;INTERVAL=1",
      timezone: "Asia/Jakarta",
      executionMode: "AgentLocalRoutine",
      validUntil: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      confirmedPreview: true,
    },
    adminToken,
  );

  const detail = await getJson(`${baseUrl}/communications/${draft.id}`, adminToken);
  const reminderActivity = await getJson(
    `${baseUrl}/communications/${draft.id}/reminder-activity`,
    adminToken,
  );

  if (publishResponse.status !== "Scheduled") {
    throw new Error(`Expected recurring reminder publish to move into Scheduled status: ${JSON.stringify(publishResponse)}`);
  }

  if (!detail.schedule || detail.schedule.scheduleType !== "Recurring") {
    throw new Error(`Expected communication detail to expose recurring schedule metadata: ${JSON.stringify(detail)}`);
  }

  if (detail.schedule.executionMode !== "AgentLocalRoutine") {
    throw new Error(`Expected executionMode AgentLocalRoutine in detail schedule: ${JSON.stringify(detail.schedule)}`);
  }

  if (!Array.isArray(reminderActivity.policies) || reminderActivity.policies.length === 0) {
    throw new Error(`Expected reminder activity to expose at least one materialized policy: ${JSON.stringify(reminderActivity)}`);
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        communicationId: draft.id,
        status: publishResponse.status,
        scheduleType: detail.schedule.scheduleType,
        executionMode: detail.schedule.executionMode,
        recurrenceRule: detail.schedule.recurrenceRule,
        policyCount: reminderActivity.policies.length,
        eventCount: reminderActivity.events.length,
        deviceIdentifier: device.deviceIdentifier,
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
}
