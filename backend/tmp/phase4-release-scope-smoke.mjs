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
const baseUrl = "http://127.0.0.1:4028";

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

async function waitForServer(url, processHandle, startupLogs) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Backend exited early during release-scope smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for release-scope smoke.\n${startupLogs.value}`);
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_PORT: "4028",
      LDAP_ALLOWED_GROUPS: "",
      ENABLED_DELIVERY_CHANNELS: "WindowsAgent",
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

  const devicesResponse = await fetch(`${baseUrl}/devices?page=1&pageSize=20`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const devices = await json(devicesResponse);
  if (!devicesResponse.ok) {
    throw new Error(`${devicesResponse.status} /devices :: ${JSON.stringify(devices)}`);
  }

  const device = devices.items.find((item) => item.deviceIdentifier === "device-mti-ops-01") ?? devices.items[0];
  if (!device) {
    throw new Error("No test device available for release-scope smoke.");
  }

  const desktopDraft = await postJson(
    `${baseUrl}/communications`,
    {
      communicationType: "Alert",
      priority: "Warning",
      category: "ReleaseScopeSmoke",
      title: `Phase 4 Desktop Scope ${Date.now()}`,
      body: "Desktop-only release scope smoke test.",
      channelSelections: ["WindowsAgent"],
      targets: [{ targetType: "Device", targetValue: device.id }],
      workflowId: null,
      windowsAgentPresentation: "Toast",
      deliveryStrategy: null,
    },
    adminToken,
    201,
  );

  const disabledChannelResponse = await postJson(
    `${baseUrl}/communications`,
    {
      communicationType: "Reminder",
      priority: "Info",
      category: "ReleaseScopeSmoke",
      title: `Phase 4 Disabled Channel ${Date.now()}`,
      body: "This request should be rejected because WhatsApp is out of scope.",
      channelSelections: ["WhatsApp"],
      targets: [{ targetType: "All", targetValue: "all" }],
      workflowId: null,
      windowsAgentPresentation: null,
      deliveryStrategy: null,
    },
    adminToken,
    422,
  );

  if (disabledChannelResponse?.code !== "CHANNEL_NOT_ENABLED") {
    throw new Error(`Expected CHANNEL_NOT_ENABLED but got ${JSON.stringify(disabledChannelResponse)}`);
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        enabledDeliveryChannels: ["WindowsAgent"],
        desktopDraftId: desktopDraft.id,
        rejectedCode: disabledChannelResponse.code,
        rejectedMessage: disabledChannelResponse.message,
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
