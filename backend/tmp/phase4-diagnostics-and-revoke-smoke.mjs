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
const baseUrl = "http://127.0.0.1:4029";

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

async function waitForServer(url, processHandle, startupLogs) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Backend exited early during diagnostics smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for diagnostics smoke.\n${startupLogs.value}`);
}

let backendProcess = null;
let realtimeAbortController = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_PORT: "4029",
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
    throw new Error("No test device available.");
  }

  const agentSession = await postJson(`${baseUrl}/agent/session`, {
    deviceIdentifier: device.deviceIdentifier,
    agentVersion: "1.0.0",
    hostname: device.hostname,
    activeUserIdentifier: "phase4.diag.tester",
  });
  const agentToken = agentSession.sessionToken;

  const realtime = await postJson(
    `${baseUrl}/agent/realtime/negotiate`,
    { deviceIdentifier: device.deviceIdentifier },
    agentToken,
  );

  realtimeAbortController = new AbortController();
  const realtimeResponse = await fetch(
    `${baseUrl}/agent/realtime-hub?connectionId=${encodeURIComponent(realtime.connectionId)}&deviceIdentifier=${encodeURIComponent(device.deviceIdentifier)}`,
    {
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
      signal: realtimeAbortController.signal,
    },
  );
  if (!realtimeResponse.ok) {
    throw new Error(`Failed to open realtime stream: ${realtimeResponse.status}`);
  }

  const diagnostics = await getJson(`${baseUrl}/health/diagnostics`, adminToken);
  if (
    diagnostics.database?.status !== "ok" ||
    diagnostics.adminSessions?.activeCount < 1 ||
    diagnostics.agentSessions?.activeCount < 1 ||
    diagnostics.realtimeHub?.persistedConnectedCount < 1 ||
    diagnostics.realtimeHub?.inMemoryActiveStreams < 1
  ) {
    throw new Error(`Unexpected diagnostics payload: ${JSON.stringify(diagnostics)}`);
  }

  const revocation = await postJson(
    `${baseUrl}/devices/${device.id}/revoke-session`,
    {},
    adminToken,
  );
  if (revocation.revokedSessionCount < 1) {
    throw new Error(`Expected at least one revoked device session: ${JSON.stringify(revocation)}`);
  }

  const revokedHeartbeatResponse = await fetch(`${baseUrl}/agent/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${agentToken}`,
    },
    body: JSON.stringify({
      deviceIdentifier: device.deviceIdentifier,
      heartbeatAt: new Date().toISOString(),
      status: "Online",
    }),
  });
  const revokedHeartbeatPayload = await json(revokedHeartbeatResponse);
  if (revokedHeartbeatResponse.status !== 401) {
    throw new Error(
      `Expected revoked agent token to fail with 401: ${revokedHeartbeatResponse.status} ${JSON.stringify(revokedHeartbeatPayload)}`,
    );
  }

  const diagnosticsAfterRevocation = await getJson(`${baseUrl}/health/diagnostics`, adminToken);

  console.log(
    JSON.stringify(
      {
        baseUrl,
        enabledDeliveryChannels: diagnostics.enabledDeliveryChannels,
        adminSessionTtlMinutes: diagnostics.adminSessions.ttlMinutes,
        agentSessionTtlMinutes: diagnostics.agentSessions.ttlMinutes,
        realtimeConnectedCount: diagnostics.realtimeHub.persistedConnectedCount,
        realtimeInMemoryStreams: diagnostics.realtimeHub.inMemoryActiveStreams,
        revokedDeviceId: revocation.deviceId,
        revokedSessionCount: revocation.revokedSessionCount,
        disconnectedRealtimeConnectionCount: revocation.disconnectedRealtimeConnectionCount,
        postRevocationAgentSessions: diagnosticsAfterRevocation.agentSessions.activeCount,
        revokedHeartbeatCode: revokedHeartbeatPayload.code,
      },
      null,
      2,
    ),
  );
} finally {
  if (realtimeAbortController) {
    realtimeAbortController.abort();
  }

  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill("SIGTERM");
    await new Promise((resolveExit) => {
      backendProcess.once("exit", () => resolveExit());
      setTimeout(() => resolveExit(), 2_000);
    });
  }
}
