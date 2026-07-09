import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const baseUrl = process.env.VITE_API_URL ?? env.VITE_API_URL ?? "http://127.0.0.1:4019";
const adminUsername = process.env.LDAP_USER ?? env.LDAP_USER;
const adminPassword = process.env.LDAP_PASS ?? env.LDAP_PASS;
const deviceIdentifier = "device-mti-ops-01";

if (!adminUsername || !adminPassword) {
  throw new Error("LDAP_USER and LDAP_PASS must be available in the environment.");
}

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

const adminSession = await postJson(`${baseUrl}/auth/login`, {
  username: adminUsername,
  password: adminPassword,
});
const adminToken = adminSession.sessionToken;

const devices = await getJson(`${baseUrl}/devices?page=1&pageSize=20`, adminToken);
const device = devices.items.find((item) => item.deviceIdentifier === deviceIdentifier) ?? devices.items[0];
if (!device) {
  throw new Error("No test device available.");
}

const communication = await postJson(
  `${baseUrl}/communications`,
  {
    communicationType: "Alert",
    priority: "Warning",
    category: "OHSE",
    title: `Phase 3 Response Visibility ${Date.now()}`,
    body: "Response visibility smoke test.",
    channelSelections: ["WindowsAgent"],
    targets: [{ targetType: "Device", targetValue: device.id }],
    workflowId: "11111111-1111-1111-1111-111111111111",
    windowsAgentPresentation: "Toast",
    deliveryStrategy: null,
  },
  adminToken,
);

await postJson(`${baseUrl}/communications/${communication.id}/audience-preview`, {}, adminToken);
await postJson(
  `${baseUrl}/communications/${communication.id}/publish`,
  {
    publishMode: "Now",
    confirmedPreview: true,
  },
  adminToken,
);

const agentSession = await postJson(`${baseUrl}/agent/session`, {
  deviceIdentifier: device.deviceIdentifier,
  agentVersion: "1.0.0",
  hostname: device.hostname,
  activeUserIdentifier: "phase3.response.tester",
});
const agentToken = agentSession.sessionToken;

const messages = await getJson(`${baseUrl}/agent/messages`, agentToken);
const message = messages.items.find((item) => item.communicationId === communication.id);
if (!message) {
  throw new Error(`Published communication ${communication.id} was not visible to the agent.`);
}

const responseOptionKey = message.workflow?.options?.[0]?.key;
if (!responseOptionKey) {
  throw new Error("No workflow response option was available on the agent message.");
}

const responsePayload = await postJson(
  `${baseUrl}/agent/messages/${message.messageId}/response`,
  {
    responseOptionKey,
    activeUserIdentifier: "phase3.response.tester",
  },
  agentToken,
);

const responseList = await getJson(
  `${baseUrl}/communications/${communication.id}/responses?page=1&pageSize=20`,
  adminToken,
);
const listed = responseList.items.find((item) => item.id === responsePayload.id);
if (!listed) {
  throw new Error(`Response ${responsePayload.id} was not returned by the admin responses endpoint.`);
}

console.log(
  JSON.stringify(
    {
      communicationId: communication.id,
      messageId: message.messageId,
      responseId: listed.id,
      responseOptionKey: listed.responseOptionKey,
      actorUserIdentifier: listed.actorUserIdentifier,
      totalItems: responseList.page.totalItems,
    },
    null,
    2,
  ),
);
