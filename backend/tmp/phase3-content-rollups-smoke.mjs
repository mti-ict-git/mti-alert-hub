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

async function createAndPublishCommunication(base, adminToken) {
  const communication = await postJson(
    `${baseUrl}/communications`,
    {
      communicationType: base.communicationType,
      priority: "Warning",
      category: base.category,
      title: `${base.title} ${Date.now()}`,
      body: base.body,
      channelSelections: ["WindowsAgent"],
      targets: [{ targetType: "Device", targetValue: base.deviceId }],
      workflowId: base.workflowId ?? null,
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

  return communication;
}

const adminSession = await postJson(`${baseUrl}/auth/login`, {
  username: adminUsername,
  password: adminPassword,
});
const adminToken = adminSession.sessionToken;

const devices = await getJson(`${baseUrl}/devices?page=1&pageSize=50`, adminToken);
const device = devices.items.find((item) => item.deviceIdentifier === deviceIdentifier) ?? devices.items[0];
if (!device) {
  throw new Error("No test device available.");
}

const alertCommunication = await createAndPublishCommunication(
  {
    communicationType: "Alert",
    category: "OHSE",
    title: "Phase 3 Rollup Alert",
    body: "Rollup smoke test for Alert content type.",
    deviceId: device.id,
    workflowId: "11111111-1111-1111-1111-111111111111",
  },
  adminToken,
);

const newsCommunication = await createAndPublishCommunication(
  {
    communicationType: "News",
    category: "General",
    title: "Phase 3 Rollup News",
    body: "Rollup smoke test for News content type.",
    deviceId: device.id,
  },
  adminToken,
);

const agentSession = await postJson(`${baseUrl}/agent/session`, {
  deviceIdentifier: device.deviceIdentifier,
  agentVersion: "1.0.0",
  hostname: device.hostname,
  activeUserIdentifier: "phase3.rollup.tester",
});
const agentToken = agentSession.sessionToken;

const messages = await getJson(`${baseUrl}/agent/messages`, agentToken);
const alertMessage = messages.items.find((item) => item.communicationId === alertCommunication.id);
if (!alertMessage) {
  throw new Error(`Published alert communication ${alertCommunication.id} was not visible to the agent.`);
}

await postJson(
  `${baseUrl}/agent/messages/${alertMessage.messageId}/displayed`,
  {
    occurredAt: new Date().toISOString(),
    activeUserIdentifier: "phase3.rollup.tester",
  },
  agentToken,
);

await postJson(
  `${baseUrl}/agent/messages/${alertMessage.messageId}/read`,
  {
    occurredAt: new Date().toISOString(),
    activeUserIdentifier: "phase3.rollup.tester",
  },
  agentToken,
);

const responseOptionKey = alertMessage.workflow?.options?.[0]?.key;
if (!responseOptionKey) {
  throw new Error("No workflow response option was available on the alert agent message.");
}

await postJson(
  `${baseUrl}/agent/messages/${alertMessage.messageId}/response`,
  {
    responseOptionKey,
    activeUserIdentifier: "phase3.rollup.tester",
  },
  agentToken,
);

const rollups = await getJson(`${baseUrl}/dashboard/content-type-rollups`, adminToken);
const alertRollup = rollups.items.find((item) => item.communicationType === "Alert");
const newsRollup = rollups.items.find((item) => item.communicationType === "News");

if (!alertRollup || !newsRollup) {
  throw new Error("Expected Alert and News rollup rows were not returned.");
}

if (alertRollup.respondedCount < 1 || alertRollup.readCount < 1) {
  throw new Error(`Alert rollup did not reflect read/responded state: ${JSON.stringify(alertRollup)}`);
}

if (newsRollup.communicationCount < 1 || newsRollup.recipientCount < 1) {
  throw new Error(`News rollup did not reflect tracked content type counts: ${JSON.stringify(newsRollup)}`);
}

const communicationList = await getJson(`${baseUrl}/communications?page=1&pageSize=50`, adminToken);
const listedAlert = communicationList.items.find((item) => item.id === alertCommunication.id);
const listedNews = communicationList.items.find((item) => item.id === newsCommunication.id);

if (!listedAlert || !listedNews) {
  throw new Error("Created communications were not returned by /communications.");
}

if ((listedAlert.recipientsCount ?? 0) < 1 || (listedAlert.ackCount ?? 0) < 1) {
  throw new Error(`Alert communication summary did not include recipient/ack counts: ${JSON.stringify(listedAlert)}`);
}

if ((listedNews.recipientsCount ?? 0) < 1) {
  throw new Error(`News communication summary did not include recipientsCount: ${JSON.stringify(listedNews)}`);
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      alertCommunicationId: alertCommunication.id,
      newsCommunicationId: newsCommunication.id,
      alertRollup,
      newsRollup,
      listedAlert: {
        id: listedAlert.id,
        category: listedAlert.category,
        recipientsCount: listedAlert.recipientsCount,
        ackCount: listedAlert.ackCount,
      },
      listedNews: {
        id: listedNews.id,
        category: listedNews.category,
        recipientsCount: listedNews.recipientsCount,
        ackCount: listedNews.ackCount,
      },
      totalRollupRows: rollups.items.length,
    },
    null,
    2,
  ),
);
