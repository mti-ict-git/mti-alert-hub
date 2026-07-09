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
const allChannels = ["WindowsAgent", "WhatsApp", "Email", "DigitalSignage"];
const allPresentations = ["Toast", "Modal", "Fullscreen"];
const allDeliveryStrategies = ["UserPreference", "MultiSend", "PrimaryFallback", "TemplatePolicy"];

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

const postExpectingError = async (url, body, token, expectedStatus) => {
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
    throw new Error(`Expected ${expectedStatus} but got ${response.status} for ${url} :: ${JSON.stringify(data)}`);
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

function buildOverridePayload(template) {
  const targets = [
    {
      targetType: template.allowedTargetTypes[0] ?? "All",
      targetValue: "audit-smoke-target",
    },
  ];
  const payload = {
    communicationType: template.communicationType,
    priority: template.defaultPriority,
    category: "AuditSmoke",
    templateId: template.id,
    title: `Phase 3 Audit Override ${Date.now()}`,
    body: "Audit override rejection smoke test.",
    channelSelections:
      template.defaultChannels.length > 0
        ? template.defaultChannels
        : (template.mandatoryChannels.length > 0 ? template.mandatoryChannels : ["WindowsAgent"]),
    targets,
    workflowId: template.defaultWorkflowId,
    windowsAgentPresentation: template.defaultWindowsAgentPresentation,
    deliveryStrategy: template.defaultDeliveryStrategy,
  };

  if (template.lockedFields.includes("priority")) {
    payload.priority = template.defaultPriority === "Critical" ? "Info" : "Critical";
    return payload;
  }

  if (template.lockedFields.includes("workflowId")) {
    payload.workflowId = template.defaultWorkflowId === workflowId ? null : workflowId;
    return payload;
  }

  if (template.lockedFields.includes("windowsAgentPresentation")) {
    payload.windowsAgentPresentation =
      allPresentations.find((item) => item !== template.defaultWindowsAgentPresentation) ?? "Modal";
    return payload;
  }

  if (template.lockedFields.includes("deliveryStrategy")) {
    payload.deliveryStrategy =
      allDeliveryStrategies.find((item) => item !== template.defaultDeliveryStrategy) ?? "UserPreference";
    return payload;
  }

  if (template.lockedFields.includes("channelSelections")) {
    const allowedChannels = new Set([...(template.mandatoryChannels ?? []), ...(template.optionalChannels ?? [])]);
    const unsupportedChannel = allChannels.find((channel) => !allowedChannels.has(channel));
    if (!unsupportedChannel) {
      return null;
    }
    payload.channelSelections = [unsupportedChannel];
    return payload;
  }

  return null;
}

const adminSession = await postJson(`${baseUrl}/auth/login`, {
  username: adminUsername,
  password: adminPassword,
});
const adminToken = adminSession.sessionToken;

const templateList = await getJson(`${baseUrl}/templates?page=1&pageSize=100`, adminToken);
let overrideTemplate = null;
let overridePayload = null;

for (const templateSummary of templateList.items) {
  const template = await getJson(`${baseUrl}/templates/${templateSummary.id}`, adminToken);
  const candidatePayload = buildOverridePayload(template);
  if (candidatePayload) {
    overrideTemplate = template;
    overridePayload = candidatePayload;
    break;
  }
}

if (!overrideTemplate || !overridePayload) {
  throw new Error("No suitable template with a testable locked override field was found.");
}

const overrideRejection = await postExpectingError(`${baseUrl}/communications`, overridePayload, adminToken, 422);

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
    category: "AuditSmoke",
    title: `Phase 3 Audit Trail ${Date.now()}`,
    body: "Audit logging smoke test for publish, response, and cancel.",
    channelSelections: ["WindowsAgent"],
    targets: [{ targetType: "Device", targetValue: device.id }],
    workflowId,
    windowsAgentPresentation: "Toast",
    deliveryStrategy: null,
  },
  adminToken,
  201,
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
  activeUserIdentifier: "phase3.audit.tester",
});
const agentToken = agentSession.sessionToken;

const messages = await getJson(`${baseUrl}/agent/messages`, agentToken);
const message = messages.items.find((item) => item.communicationId === communication.id);
if (!message) {
  throw new Error(`Published communication ${communication.id} was not visible to the agent.`);
}

const responseOptionKey = message.workflow?.options?.[0]?.key;
if (!responseOptionKey) {
  throw new Error("No workflow response option was available on the audit smoke message.");
}

await postJson(
  `${baseUrl}/agent/messages/${message.messageId}/response`,
  {
    responseOptionKey,
    activeUserIdentifier: "phase3.audit.tester",
  },
  agentToken,
);

await postJson(`${baseUrl}/communications/${communication.id}/cancel`, {}, adminToken);

const auditLogs = await getJson(`${baseUrl}/audit-logs?page=1&pageSize=200`, adminToken);

const publishAudit = auditLogs.items.find(
  (item) => item.action === "PublishCommunication" && item.description.includes(communication.id),
);
const publishStateAudit = auditLogs.items.find(
  (item) => item.action === "CommunicationStatusChanged" && item.description.includes(`${communication.id} status changed from Draft to Queued`),
);
const responseAudit = auditLogs.items.find(
  (item) => item.action === "RecordResponse" && item.description.includes(communication.id),
);
const responseStateAudit = auditLogs.items.find(
  (item) => item.action === "RecipientResponseStateChanged" &&
    item.description.includes(communication.id) &&
    item.description.includes("AwaitingResponse to Responded"),
);
const cancelAudit = auditLogs.items.find(
  (item) => item.action === "CancelCommunication" && item.description.includes(communication.id),
);
const cancelStateAudit = auditLogs.items.find(
  (item) => item.action === "CommunicationStatusChanged" &&
    item.description.includes(`${communication.id} status changed`) &&
    item.description.includes("Cancelled"),
);
const overrideAudit = auditLogs.items.find(
  (item) => item.action === "TemplateOverrideRejected" && item.description.includes(overrideTemplate.id),
);

if (!publishAudit || !publishStateAudit || !responseAudit || !responseStateAudit || !cancelAudit || !cancelStateAudit || !overrideAudit) {
  throw new Error(
    JSON.stringify(
      {
        missing: {
          publishAudit: !publishAudit,
          publishStateAudit: !publishStateAudit,
          responseAudit: !responseAudit,
          responseStateAudit: !responseStateAudit,
          cancelAudit: !cancelAudit,
          cancelStateAudit: !cancelStateAudit,
          overrideAudit: !overrideAudit,
        },
        overrideRejection,
        recentAuditActions: auditLogs.items.slice(0, 20).map((item) => ({
          action: item.action,
          description: item.description,
        })),
      },
      null,
      2,
    ),
  );
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      communicationId: communication.id,
      overrideTemplateId: overrideTemplate.id,
      overrideRejectionCode: overrideRejection.code,
      auditEvidence: {
        publishAudit,
        publishStateAudit,
        responseAudit,
        responseStateAudit,
        cancelAudit,
        cancelStateAudit,
        overrideAudit,
      },
      totalAuditItems: auditLogs.items.length,
    },
    null,
    2,
  ),
);
