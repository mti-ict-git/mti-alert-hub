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

function buildCommunicationPayload(base) {
  return {
    communicationType: "Alert",
    priority: "Warning",
    category: "OHSE",
    title: `${base.title} ${Date.now()}`,
    body: base.body,
    channelSelections: base.channelSelections,
    targets: base.targets,
    workflowId: null,
    windowsAgentPresentation: base.windowsAgentPresentation ?? null,
    deliveryStrategy: null,
  };
}

async function createAndPublishCommunication(base, adminToken) {
  const communication = await postJson(
    `${baseUrl}/communications`,
    buildCommunicationPayload(base),
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

function summarizeRecipient(recipient) {
  return {
    recipientId: recipient.recipientId,
    recipientType: recipient.recipientType,
    deviceId: recipient.deviceId ?? null,
    deviceIdentifier: recipient.deviceIdentifier ?? null,
    hostname: recipient.hostname ?? null,
    channelEndpoint: recipient.channelEndpoint ?? null,
    latestJobStatus: recipient.latestJobStatus,
  };
}

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

const employees = await getJson(`${baseUrl}/employees?page=1&pageSize=200`, adminToken);
const employeeWithEndpoint =
  employees.items.find((item) => item.phone || item.email) ?? employees.items[0];
if (!employeeWithEndpoint) {
  throw new Error("No test employee available.");
}

const deviceCommunication = await createAndPublishCommunication(
  {
    title: "Phase 3 Delivery Device Visibility",
    body: "Device recipient visibility smoke test.",
    channelSelections: ["WindowsAgent"],
    targets: [{ targetType: "Device", targetValue: device.id }],
    windowsAgentPresentation: "Toast",
  },
  adminToken,
);

const deviceDeliveries = await getJson(
  `${baseUrl}/communications/${deviceCommunication.id}/deliveries?page=1&pageSize=50`,
  adminToken,
);
const deviceRecipient = deviceDeliveries.recipients.find((item) => item.recipientType === "Device");
if (!deviceRecipient) {
  throw new Error(`No Device recipient found for communication ${deviceCommunication.id}.`);
}
if (!deviceRecipient.deviceId || !deviceRecipient.deviceIdentifier || !deviceRecipient.hostname) {
  throw new Error(
    `Device recipient is missing reference fields: ${JSON.stringify(summarizeRecipient(deviceRecipient))}`,
  );
}

const contactCommunication = await createAndPublishCommunication(
  {
    title: "Phase 3 Delivery Contact Visibility",
    body: "Contact endpoint visibility smoke test.",
    channelSelections: ["WhatsApp"],
    targets: [{ targetType: "Employee", targetValue: employeeWithEndpoint.id }],
  },
  adminToken,
);

const contactDeliveries = await getJson(
  `${baseUrl}/communications/${contactCommunication.id}/deliveries?page=1&pageSize=50`,
  adminToken,
);
const contactRecipient = contactDeliveries.recipients.find(
  (item) => item.recipientType === "ContactEndpoint",
);
if (!contactRecipient) {
  throw new Error(`No ContactEndpoint recipient found for communication ${contactCommunication.id}.`);
}
if (!contactRecipient.channelEndpoint) {
  throw new Error(
    `ContactEndpoint recipient is missing channelEndpoint: ${JSON.stringify(summarizeRecipient(contactRecipient))}`,
  );
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      deviceCommunicationId: deviceCommunication.id,
      deviceRecipient: summarizeRecipient(deviceRecipient),
      contactCommunicationId: contactCommunication.id,
      contactRecipient: summarizeRecipient(contactRecipient),
      deviceRecipientCount: deviceDeliveries.recipients.length,
      contactRecipientCount: contactDeliveries.recipients.length,
    },
    null,
    2,
  ),
);
