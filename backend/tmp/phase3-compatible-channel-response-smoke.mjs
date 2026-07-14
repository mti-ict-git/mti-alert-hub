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
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:4027";
const workflowId = "22222222-2222-2222-2222-222222222222";

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
      throw new Error(`Backend exited early during compatible channel smoke.\n${startupLogs.value}`);
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Backend did not become ready for compatible channel smoke.\n${startupLogs.value}`);
}

let backendProcess = null;
const startupLogs = { value: "" };

try {
  backendProcess = spawn(process.execPath, [resolve(process.cwd(), "backend/dist/index.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_PORT: "4027",
      LDAP_ALLOWED_GROUPS: "",
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

  const employees = await getJson(`${baseUrl}/employees?page=1&pageSize=200`, adminToken);
  const employee =
    employees.items.find(
      (item) =>
        Array.isArray(item.preferredChannels) &&
        item.preferredChannels.includes("WhatsApp") &&
        typeof item.whatsappNumber === "string" &&
        item.whatsappNumber.trim().length > 0,
    ) ??
    employees.items.find(
      (item) =>
        typeof item.whatsappNumber === "string" && item.whatsappNumber.trim().length > 0,
    );

  if (!employee) {
    throw new Error("No employee with a WhatsApp-compatible endpoint was available for the smoke test.");
  }

  const communication = await postJson(
    `${baseUrl}/communications`,
    {
      communicationType: "Reminder",
      priority: "Warning",
      category: "CompatibleChannelSmoke",
      title: `Phase 3 Compatible Channel Response ${Date.now()}`,
      body: "Compatible channel response ingestion smoke test.",
      channelSelections: ["WhatsApp"],
      targets: [{ targetType: "Employee", targetValue: employee.id }],
      workflowId,
      windowsAgentPresentation: null,
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

  const deliveriesBefore = await getJson(
    `${baseUrl}/communications/${communication.id}/deliveries?page=1&pageSize=50`,
    adminToken,
  );
  const whatsappDelivery = deliveriesBefore.items.find(
    (item) => item.channel === "WhatsApp" && item.recipientType === "ContactEndpoint",
  );

  if (!whatsappDelivery) {
    throw new Error(`No WhatsApp ContactEndpoint delivery was found: ${JSON.stringify(deliveriesBefore)}`);
  }

  const responsePayload = await postJson(
    `${baseUrl}/communications/${communication.id}/deliveries/${whatsappDelivery.deliveryJobId}/response`,
    {
      responseOptionKey: "done",
      actorUserIdentifier: employee.employeeNumber ?? employee.id,
    },
    adminToken,
  );

  const deliveriesAfter = await getJson(
    `${baseUrl}/communications/${communication.id}/deliveries?page=1&pageSize=50`,
    adminToken,
  );
  const respondedRecipient = deliveriesAfter.recipients.find(
    (item) =>
      item.recipientId === whatsappDelivery.recipientId &&
      item.responseState === "Responded" &&
      item.latestJobStatus === "Responded",
  );

  if (!respondedRecipient) {
    throw new Error(`Recipient state was not updated to Responded: ${JSON.stringify(deliveriesAfter)}`);
  }

  const responses = await getJson(
    `${baseUrl}/communications/${communication.id}/responses?page=1&pageSize=20`,
    adminToken,
  );
  const listedResponse = responses.items.find((item) => item.id === responsePayload.id);
  if (!listedResponse || listedResponse.channel !== "WhatsApp" || listedResponse.responseOptionKey !== "done") {
    throw new Error(`Response list did not include the compatible channel response: ${JSON.stringify(responses)}`);
  }

  const auditLogs = await getJson(`${baseUrl}/audit-logs?page=1&pageSize=200`, adminToken);
  const responseAudit = auditLogs.items.find(
    (item) => item.action === "RecordResponse" && item.description.includes(communication.id),
  );
  const responseStateAudit = auditLogs.items.find(
    (item) =>
      item.action === "RecipientResponseStateChanged" &&
      item.description.includes(communication.id) &&
      item.description.includes("Responded via WhatsApp"),
  );

  if (!responseAudit || !responseStateAudit) {
    throw new Error(
      `Audit logs did not include the compatible channel response entries: ${JSON.stringify({
        responseAudit,
        responseStateAudit,
      })}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        communicationId: communication.id,
        deliveryJobId: whatsappDelivery.deliveryJobId,
        recipientId: whatsappDelivery.recipientId,
        channelEndpoint: whatsappDelivery.channelEndpoint,
        responseId: responsePayload.id,
        responseChannel: listedResponse.channel,
        responseOptionKey: listedResponse.responseOptionKey,
        totalResponses: responses.page.totalItems,
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
