import type { IncomingMessage } from "node:http";
import { z } from "zod";

import type { AppRoute } from "../../../app/http/create-server.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import type { AgentService } from "../service/agent-service.js";

const deviceStatusSchema = z.enum(["Online", "Offline", "Stale"]);
const reminderEventTypeSchema = z.enum([
  "Triggered",
  "Displayed",
  "Read",
  "Dismissed",
  "Snoozed",
  "Responded",
  "Started",
  "StepAdvanced",
  "Completed",
  "TimedOut",
]);
const rolloutStateSchema = z.enum([
  "UpdateAvailable",
  "Downloading",
  "Staged",
  "InstallPending",
  "Installing",
  "Succeeded",
  "Failed",
  "UninstallPending",
  "Uninstalling",
  "Uninstalled",
]);

const agentSessionRequestSchema = z.object({
  deviceIdentifier: z.string().trim().min(1),
  employeeNumber: z.string().trim().optional().nullable(),
  agentVersion: z.string().trim().optional().nullable(),
  activeUserIdentifier: z.string().trim().optional().nullable(),
  hostname: z.string().trim().optional().nullable(),
});

const agentRealtimeNegotiationRequestSchema = z.object({
  deviceIdentifier: z.string().trim().min(1),
});

const agentHeartbeatRequestSchema = z.object({
  deviceIdentifier: z.string().trim().min(1),
  heartbeatAt: z.string().trim().min(1),
  status: deviceStatusSchema.optional().nullable(),
  activeUserIdentifier: z.string().trim().optional().nullable(),
});

const agentLifecycleEventRequestSchema = z.object({
  occurredAt: z.string().trim().min(1),
  activeUserIdentifier: z.string().trim().optional().nullable(),
});

const agentResponseRequestSchema = z.object({
  responseOptionKey: z.string().trim().min(1),
  responseNote: z.string().trim().optional().nullable(),
  occurredAt: z.string().trim().optional().nullable(),
  activeUserIdentifier: z.string().trim().optional().nullable(),
});

const agentReminderEventRequestSchema = z.object({
  eventType: reminderEventTypeSchema,
  occurredAt: z.string().trim().min(1),
  activeUserIdentifier: z.string().trim().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const agentRolloutStatusRequestSchema = z.object({
  rolloutId: z.string().trim().min(1),
  state: rolloutStateSchema,
  installedVersion: z.string().trim().optional().nullable(),
  targetVersion: z.string().trim().optional().nullable(),
  updaterVersion: z.string().trim().optional().nullable(),
  startupRegistered: z.boolean().optional().nullable(),
  errorCode: z.string().trim().optional().nullable(),
  errorMessage: z.string().trim().optional().nullable(),
  occurredAt: z.string().trim().min(1),
  metadataJson: z.record(z.unknown()).optional().nullable(),
});

type RegisterAgentRoutesOptions = {
  agentService: AgentService;
};

export function registerAgentRoutes(options: RegisterAgentRoutesOptions): AppRoute[] {
  return [
    {
      method: "POST",
      path: "/agent/session",
      allowAnonymous: true,
      async handler({ json }) {
        const payload = validateWithSchema(agentSessionRequestSchema, await json());
        return {
          statusCode: 200,
          body: await options.agentService.createSession(payload),
        };
      },
    },
    {
      method: "POST",
      path: "/agent/realtime/negotiate",
      allowAnonymous: true,
      async handler({ json, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentRealtimeNegotiationRequestSchema, await json());

        return {
          statusCode: 200,
          body: await options.agentService.negotiateRealtime(sessionToken, {
            ...payload,
            requestBaseUrl: resolveRequestBaseUrl(request),
          }),
        };
      },
    },
    {
      method: "GET",
      path: "/agent/realtime-hub",
      allowAnonymous: true,
      async handler({ request, response, url }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const connectionId = url.searchParams.get("connectionId") ?? "";
        const deviceIdentifier = url.searchParams.get("deviceIdentifier") ?? "";

        if (!connectionId.trim() || !deviceIdentifier.trim()) {
          throw new AppError({
            statusCode: 422,
            code: "VALIDATION_ERROR",
            message: "connectionId and deviceIdentifier are required.",
          });
        }

        await options.agentService.openRealtimeStream({
          sessionToken,
          connectionId,
          deviceIdentifier,
          request,
          response,
        });
        return {
          statusCode: 200,
        };
      },
    },
    {
      method: "POST",
      path: "/agent/heartbeat",
      allowAnonymous: true,
      async handler({ json, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentHeartbeatRequestSchema, await json());

        await options.agentService.reportHeartbeat(sessionToken, payload);
        return {
          statusCode: 204,
        };
      },
    },
    {
      method: "GET",
      path: "/agent/rollout-intent",
      allowAnonymous: true,
      async handler({ request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        return {
          statusCode: 200,
          body: await options.agentService.getRolloutIntent(sessionToken),
        };
      },
    },
    {
      method: "POST",
      path: "/agent/rollout-status",
      allowAnonymous: true,
      async handler({ json, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentRolloutStatusRequestSchema, await json());

        await options.agentService.reportRolloutStatus(sessionToken, payload);
        return {
          statusCode: 204,
        };
      },
    },
    {
      method: "GET",
      path: "/agent/messages",
      allowAnonymous: true,
      async handler({ request, url }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        return {
          statusCode: 200,
          body: await options.agentService.listPendingMessages(
            sessionToken,
            url.searchParams.get("since"),
          ),
        };
      },
    },
    {
      method: "GET",
      path: "/agent/reminder-policies",
      allowAnonymous: true,
      async handler({ request, url }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        return {
          statusCode: 200,
          body: await options.agentService.listReminderPolicies(
            sessionToken,
            url.searchParams.get("since"),
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/agent/messages/{messageId}/displayed",
      allowAnonymous: true,
      async handler({ json, params, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentLifecycleEventRequestSchema, await json());

        await options.agentService.reportDisplayed(
          sessionToken,
          params.messageId ?? "",
          payload,
        );
        return {
          statusCode: 204,
        };
      },
    },
    {
      method: "POST",
      path: "/agent/messages/{messageId}/read",
      allowAnonymous: true,
      async handler({ json, params, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentLifecycleEventRequestSchema, await json());

        await options.agentService.reportRead(sessionToken, params.messageId ?? "", payload);
        return {
          statusCode: 204,
        };
      },
    },
    {
      method: "POST",
      path: "/agent/messages/{messageId}/response",
      allowAnonymous: true,
      async handler({ json, params, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentResponseRequestSchema, await json());

        return {
          statusCode: 200,
          body: await options.agentService.submitResponse(
            sessionToken,
            params.messageId ?? "",
            payload,
            {
              ipAddress: resolveRequestIpAddress(request),
            },
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/agent/reminder-policies/{policyId}/events",
      allowAnonymous: true,
      async handler({ json, params, request }) {
        const sessionToken = requireAgentSessionToken(request.headers.authorization);
        const payload = validateWithSchema(agentReminderEventRequestSchema, await json());

        await options.agentService.reportReminderEvent(
          sessionToken,
          params.policyId ?? "",
          payload,
        );
        return {
          statusCode: 204,
        };
      },
    },
  ];
}

function resolveRequestIpAddress(request: IncomingMessage) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
}

function requireAgentSessionToken(authorizationHeader: string | undefined) {
  const sessionToken = extractBearerToken(authorizationHeader);
  if (!sessionToken) {
    throw new AppError({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "A valid agent session token is required.",
    });
  }

  return sessionToken;
}

function extractBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token;
}

function resolveRequestBaseUrl(request: RequestLike) {
  const protocol = firstHeaderValue(request.headers["x-forwarded-proto"]) ?? "http";
  const host = firstHeaderValue(request.headers["x-forwarded-host"]) ?? request.headers.host;

  if (!host?.trim()) {
    return undefined;
  }

  return `${protocol}://${host.trim()}`;
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (!value) {
    return undefined;
  }

  return value.split(",")[0]?.trim();
}

type RequestLike = {
  headers: {
    authorization?: string;
    host?: string;
    "x-forwarded-host"?: string | string[];
    "x-forwarded-proto"?: string | string[];
  };
};
