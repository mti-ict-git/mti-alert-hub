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
const baseUrl = "http://127.0.0.1:4034";

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
      throw new Error(
        `Backend exited early during device test notification smoke.\n${startupLogs.value}`,
      );
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(
    `Backend did not become ready for device test notification smoke.\n${startupLogs.value}`,
  );
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      BACKEND_PORT: "4034",
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

  const devices = await getJson(`${baseUrl}/devices?page=1&pageSize=50`, adminToken);
  const onlineDevice = devices.items.find(
    (item) => item.status === "Online" && item.deviceIdentifier?.trim(),
  );
  if (!onlineDevice) {
    throw new Error("No online device with a deviceIdentifier is available for smoke verification.");
  }

  const nonOnlineDevice = devices.items.find((item) => item.status !== "Online");

  const agentSession = await postJson(`${baseUrl}/agent/session`, {
    deviceIdentifier: onlineDevice.deviceIdentifier,
    agentVersion: "1.0.0",
    hostname: onlineDevice.hostname,
    activeUserIdentifier: "phase4.device.test",
  });
  const agentToken = agentSession.sessionToken;

  const testTitle = `Phase 4 Device Test ${Date.now()}`;
  const testBody = `Connectivity verification for ${onlineDevice.hostname}`;
  const created = await postJson(
    `${baseUrl}/devices/${onlineDevice.id}/test-notification`,
    {
      title: testTitle,
      body: testBody,
      windowsAgentPresentation: "Modal",
    },
    adminToken,
    201,
  );

  const detail = await getJson(`${baseUrl}/communications/${created.communicationId}`, adminToken);
  const pendingMessages = await getJson(`${baseUrl}/agent/messages`, agentToken);
  const auditLogs = await getJson(
    `${baseUrl}/audit-logs?page=1&pageSize=20&module=Devices&search=SendDeviceTestNotification`,
    adminToken,
  );

  const missingDeviceResponse = await fetch(
    `${baseUrl}/devices/not-a-real-device/test-notification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    },
  );
  const missingDevicePayload = await json(missingDeviceResponse);

  let nonOnlineStatus = null;
  let nonOnlineCode = null;
  if (nonOnlineDevice) {
    const nonOnlineResponse = await fetch(
      `${baseUrl}/devices/${nonOnlineDevice.id}/test-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      },
    );
    const nonOnlinePayload = await json(nonOnlineResponse);
    nonOnlineStatus = nonOnlineResponse.status;
    nonOnlineCode = nonOnlinePayload?.code ?? null;
  }

  const pendingMessage = pendingMessages.items.find(
    (item) => item.communicationId === created.communicationId,
  );
  const auditEntry = auditLogs.items.find((item) =>
    item.description?.includes(onlineDevice.hostname),
  );

  if (created.communicationStatus !== "Queued") {
    throw new Error(`Expected device test notification to publish immediately: ${JSON.stringify(created)}`);
  }

  if (detail.communicationType !== "OperationalNotice" || detail.status !== "Queued") {
    throw new Error(`Unexpected created communication detail: ${JSON.stringify(detail)}`);
  }

  if (detail.title !== testTitle || detail.body !== testBody) {
    throw new Error(`Expected custom device test payload to persist on the communication: ${JSON.stringify(detail)}`);
  }

  if (!pendingMessage) {
    throw new Error(`Expected the test notification to be visible in agent reconciliation: ${JSON.stringify(pendingMessages)}`);
  }

  if (!auditEntry) {
    throw new Error(`Expected a device audit log entry for the test notification: ${JSON.stringify(auditLogs)}`);
  }

  if (missingDeviceResponse.status !== 404 || missingDevicePayload?.code !== "DEVICE_NOT_FOUND") {
    throw new Error(
      `Expected missing device test-notification call to return 404 DEVICE_NOT_FOUND: ${missingDeviceResponse.status} ${JSON.stringify(missingDevicePayload)}`,
    );
  }

  if (
    nonOnlineDevice &&
    (nonOnlineStatus !== 409 || nonOnlineCode !== "DEVICE_TEST_NOTIFICATION_DEVICE_OFFLINE")
  ) {
    throw new Error(
      `Expected non-online device to reject the test notification with 409: ${nonOnlineStatus} ${JSON.stringify({ nonOnlineCode, deviceStatus: nonOnlineDevice.status })}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        deviceId: onlineDevice.id,
        deviceIdentifier: onlineDevice.deviceIdentifier,
        hostname: onlineDevice.hostname,
        communicationId: created.communicationId,
        communicationStatus: created.communicationStatus,
        pendingMessageId: pendingMessage.messageId,
        auditActionMatched: auditEntry.action,
        missingDeviceCode: missingDevicePayload.code,
        nonOnlineDeviceId: nonOnlineDevice?.id ?? null,
        nonOnlineDeviceStatus: nonOnlineDevice?.status ?? null,
        nonOnlineRejectionCode: nonOnlineCode,
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
