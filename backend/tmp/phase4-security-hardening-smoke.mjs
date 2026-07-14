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
const baseUrl = "http://127.0.0.1:4030";

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
      throw new Error(`Backend exited early during security hardening smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for security hardening smoke.\n${startupLogs.value}`);
}

async function runProductionLdapGuardrailCheck() {
  const processHandle = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      BACKEND_PORT: "4031",
      ENABLED_DELIVERY_CHANNELS: "WindowsAgent",
      LDAP_URL: "ldap://directory.example.internal",
      LDAP_BIND_DN: "CN=svc-mti-alert,OU=Service Accounts,DC=example,DC=internal",
      LDAP_BIND_PASSWORD: "placeholder",
      LDAP_SEARCH_BASE: "DC=example,DC=internal",
      LDAP_ALLOWED_GROUPS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  processHandle.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  processHandle.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  const exitCode = await new Promise((resolveExit) => {
    processHandle.once("exit", (code) => resolveExit(code ?? 0));
  });

  if (exitCode === 0) {
    throw new Error("Expected production LDAP guardrail startup to fail for insecure ldap:// configuration.");
  }

  if (!output.includes("LDAP_URL must use ldaps://")) {
    throw new Error(`Expected LDAP guardrail error message, got:\n${output}`);
  }

  return {
    exitCode,
    messageMatched: true,
  };
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_PORT: "4030",
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

  const loginResponse = await postJson(`${baseUrl}/auth/login`, {
    username: adminUsername,
    password: adminPassword,
  });

  const originalSession = await getJson(`${baseUrl}/auth/me`, loginResponse.sessionToken);
  const rotatedSession = await postJson(
    `${baseUrl}/auth/rotate-session`,
    {},
    loginResponse.sessionToken,
  );

  if (rotatedSession.sessionToken === loginResponse.sessionToken) {
    throw new Error("Expected rotate-session to issue a new session token.");
  }

  const oldSessionResponse = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${loginResponse.sessionToken}` },
  });
  const oldSessionPayload = await json(oldSessionResponse);
  if (oldSessionResponse.status !== 401) {
    throw new Error(
      `Expected old session token to fail after rotation: ${oldSessionResponse.status} ${JSON.stringify(oldSessionPayload)}`,
    );
  }

  const currentSession = await getJson(`${baseUrl}/auth/me`, rotatedSession.sessionToken);
  const ldapGuardrail = await runProductionLdapGuardrailCheck();

  console.log(
    JSON.stringify(
      {
        baseUrl,
        originalUsername: originalSession.user.username,
        rotatedUsername: currentSession.user.username,
        rotatedRoleType: currentSession.user.roleType,
        sessionTokenChanged: rotatedSession.sessionToken !== loginResponse.sessionToken,
        oldTokenRejectedCode: oldSessionPayload.code,
        ldapGuardrailExitCode: ldapGuardrail.exitCode,
        ldapGuardrailMessageMatched: ldapGuardrail.messageMatched,
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
