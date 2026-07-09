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
const workflowId = "11111111-1111-1111-1111-111111111111";

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

const devices = await getJson(`${baseUrl}/devices?page=1&pageSize=50`, adminToken);
const device = devices.items.find((item) => item.deviceIdentifier === "device-mti-ops-01") ?? devices.items[0];
if (!device) {
  throw new Error("No test device available.");
}

const communication = await postJson(
  `${baseUrl}/communications`,
  {
    communicationType: "Alert",
    priority: "Critical",
    category: "OHSE",
    title: `Phase 3 Overdue Smoke ${Date.now()}`,
    body: "Overdue handling smoke test.",
    channelSelections: ["WindowsAgent"],
    targets: [{ targetType: "Device", targetValue: device.id }],
    workflowId,
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
  activeUserIdentifier: "phase3.overdue.tester",
});
const agentToken = agentSession.sessionToken;

await getJson(`${baseUrl}/agent/messages`, agentToken);

const deliveries = await getJson(
  `${baseUrl}/communications/${communication.id}/deliveries?page=1&pageSize=50`,
  adminToken,
);

const overdueRecipient = deliveries.recipients.find((item) => item.recipientType === "Device");
if (!overdueRecipient) {
  throw new Error("No device recipient returned in deliveries view.");
}

if (overdueRecipient.responseState !== "Overdue") {
  throw new Error(`Recipient did not transition to Overdue: ${JSON.stringify(overdueRecipient)}`);
}

const overdueEvent = deliveries.events.find((item) => item.eventType === "Overdue");
if (!overdueEvent) {
  throw new Error(`Overdue event was not recorded: ${JSON.stringify(deliveries.events.slice(0, 5))}`);
}

const followUpEvent = deliveries.events.find(
  (item) => item.eventType === "Queued" && item.detail.includes("Queued for delivery"),
);
const deliveryItem = deliveries.items.find((item) => item.recipientType === "Device");
if (!deliveryItem) {
  throw new Error("No device delivery item returned in deliveries view.");
}

if (deliveryItem.jobStatus !== "Pending") {
  throw new Error(`Follow-up did not requeue the recipient job: ${JSON.stringify(deliveryItem)}`);
}

const dashboardOverview = await getJson(`${baseUrl}/dashboard/overview`, adminToken);
const contentRollups = await getJson(`${baseUrl}/dashboard/content-type-rollups`, adminToken);
const alertRollup = contentRollups.items.find((item) => item.communicationType === "Alert");
if (!alertRollup || alertRollup.overdueResponses < 1) {
  throw new Error(`Alert rollup did not include overdue count: ${JSON.stringify(alertRollup)}`);
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      communicationId: communication.id,
      overdueRecipient: {
        recipientId: overdueRecipient.recipientId,
        responseState: overdueRecipient.responseState,
        latestJobStatus: overdueRecipient.latestJobStatus,
      },
      deliveryItem: {
        deliveryJobId: deliveryItem.deliveryJobId,
        jobStatus: deliveryItem.jobStatus,
        detail: deliveryItem.detail,
      },
      overdueEvent: {
        eventType: overdueEvent.eventType,
        detail: overdueEvent.detail,
      },
      hasFollowUpQueuedEvent: Boolean(followUpEvent),
      dashboardOverview,
      alertRollup,
    },
    null,
    2,
  ),
);
