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
const baseUrl = "http://127.0.0.1:4032";
const tracedRequestId = "phase4-observability-request";

if (!adminUsername || !adminPassword) {
  throw new Error("LDAP_USER and LDAP_PASS must be available in the environment.");
}

const json = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const postJson = async (url, body, token, expectedStatus = 200, extraHeaders = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const data = await json(response);
  if (response.status !== expectedStatus) {
    throw new Error(`${response.status} ${url} :: ${JSON.stringify(data)}`);
  }
  return { data, response };
};

async function waitForServer(url, processHandle, startupLogs) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Backend exited early during observability smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for observability smoke.\n${startupLogs.value}`);
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_PORT: "4032",
      LDAP_ALLOWED_GROUPS: "",
      ENABLED_DELIVERY_CHANNELS: "WindowsAgent",
      ADMIN_SESSION_TTL_MINUTES: "10",
      AGENT_SESSION_TTL_MINUTES: "10",
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

  const { data: loginResponse } = await postJson(`${baseUrl}/auth/login`, {
    username: adminUsername,
    password: adminPassword,
  });

  const devicesResponse = await fetch(`${baseUrl}/devices?page=1&pageSize=20`, {
    headers: { Authorization: `Bearer ${loginResponse.sessionToken}` },
  });
  const devices = await json(devicesResponse);
  if (!devicesResponse.ok) {
    throw new Error(`${devicesResponse.status} /devices :: ${JSON.stringify(devices)}`);
  }

  const device = devices.items.find((item) => item.deviceIdentifier === "device-mti-ops-01") ?? devices.items[0];
  if (!device) {
    throw new Error("No test device available for observability smoke.");
  }

  await postJson(`${baseUrl}/agent/session`, {
    deviceIdentifier: device.deviceIdentifier,
    hostname: device.hostname,
    agentVersion: "1.0.0",
  });

  const diagnosticsResponse = await fetch(`${baseUrl}/health/diagnostics`, {
    headers: {
      Authorization: `Bearer ${loginResponse.sessionToken}`,
      "X-Request-Id": tracedRequestId,
    },
  });
  const diagnostics = await json(diagnosticsResponse);
  if (!diagnosticsResponse.ok) {
    throw new Error(`${diagnosticsResponse.status} /health/diagnostics :: ${JSON.stringify(diagnostics)}`);
  }

  const echoedRequestId = diagnosticsResponse.headers.get("x-request-id");
  if (echoedRequestId !== tracedRequestId) {
    throw new Error(`Expected x-request-id ${tracedRequestId} but got ${echoedRequestId}`);
  }

  const alertCodes = Array.isArray(diagnostics.alerts)
    ? diagnostics.alerts.map((alert) => alert.code)
    : [];

  if (
    !alertCodes.includes("ADMIN_SESSIONS_EXPIRING_SOON") ||
    !alertCodes.includes("AGENT_SESSIONS_EXPIRING_SOON")
  ) {
    throw new Error(`Expected expiring-session alerts in diagnostics: ${JSON.stringify(diagnostics)}`);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (startupLogs.value.includes(tracedRequestId) && startupLogs.value.includes("http.request.completed")) {
      break;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  if (!startupLogs.value.includes(tracedRequestId) || !startupLogs.value.includes("http.request.completed")) {
    throw new Error(`Expected request-completed log with requestId in backend output:\n${startupLogs.value}`);
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        requestId: tracedRequestId,
        responseHeaderRequestId: echoedRequestId,
        diagnosticsStatus: diagnostics.status,
        alertCodes,
        adminSessionTtlMinutes: diagnostics.adminSessions.ttlMinutes,
        agentSessionTtlMinutes: diagnostics.agentSessions.ttlMinutes,
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
