import { z } from "zod";

import type { BackendEnv, DeliveryChannel } from "../../../app/config/env.js";
import type { AppRoute, AppRouteHandlerContext } from "../../../app/http/create-server.js";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import type { AgentService } from "../../agent/service/agent-service.js";
import type { AgentSessionStore } from "../../agent/service/agent-session-store.js";
import type { AdminSessionStore } from "../../auth/service/admin-session-store.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";

const healthQuerySchema = z.object({
  verbose: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

type RegisterHealthRoutesOptions = {
  env: BackendEnv;
  startedAt: Date;
  database: DatabaseClient;
  adminSessionStore: AdminSessionStore;
  agentSessionStore: AgentSessionStore;
  agentService: AgentService;
  enabledDeliveryChannels: DeliveryChannel[];
};

type DiagnosticsAlert = {
  code:
    | "DATABASE_UNREACHABLE"
    | "REALTIME_CONNECTIONS_STALE"
    | "ADMIN_SESSIONS_EXPIRING_SOON"
    | "AGENT_SESSIONS_EXPIRING_SOON"
    | "DEVICES_STALE";
  severity: "warning" | "critical";
  message: string;
};

export function registerHealthRoutes(options: RegisterHealthRoutesOptions): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/health",
      async handler({ url }: AppRouteHandlerContext) {
        const query = validateWithSchema(
          healthQuerySchema,
          Object.fromEntries(url.searchParams.entries()),
        );

        const basePayload = {
          status: "ok",
          service: options.env.APP_NAME,
          environment: options.env.NODE_ENV,
        };

        if (!query.verbose) {
          return {
            statusCode: 200,
            body: basePayload,
          };
        }

        return {
          statusCode: 200,
          body: {
            ...basePayload,
            uptimeSeconds: Math.floor((Date.now() - options.startedAt.getTime()) / 1000),
            startedAt: options.startedAt.toISOString(),
          },
        };
      },
    },
    {
      method: "GET",
      path: "/health/diagnostics",
      requiresAuth: true,
      async handler({ requestId }) {
        const [adminSessionDiagnostics, agentSessionDiagnostics, operationalDiagnostics, databaseStatus] =
          await Promise.all([
            Promise.resolve(options.adminSessionStore.getDiagnostics()),
            options.agentSessionStore.getDiagnostics(),
            options.agentService.getOperationalDiagnostics(),
            probeDatabase(options.database),
          ]);

        const alerts = buildDiagnosticsAlerts({
          databaseStatus,
          adminSessionDiagnostics,
          agentSessionDiagnostics,
          operationalDiagnostics,
        });
        const overallStatus = alerts.length > 0 ? "degraded" : "ok";

        return {
          statusCode: 200,
          body: {
            status: overallStatus,
            requestId,
            service: options.env.APP_NAME,
            environment: options.env.NODE_ENV,
            startedAt: options.startedAt.toISOString(),
            uptimeSeconds: Math.floor((Date.now() - options.startedAt.getTime()) / 1000),
            enabledDeliveryChannels: options.enabledDeliveryChannels,
            database: databaseStatus,
            adminSessions: adminSessionDiagnostics,
            agentSessions: agentSessionDiagnostics,
            alerts,
            ...operationalDiagnostics,
          },
        };
      },
    },
  ];
}

async function probeDatabase(database: DatabaseClient) {
  try {
    await database.ping();
    return { status: "ok" as const };
  } catch (error) {
    return {
      status: "degraded" as const,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

function buildDiagnosticsAlerts(input: {
  databaseStatus: Awaited<ReturnType<typeof probeDatabase>>;
  adminSessionDiagnostics: {
    activeCount: number;
    expiringWithin15MinutesCount: number;
    ttlMinutes: number;
  };
  agentSessionDiagnostics: {
    activeCount: number;
    expiringWithin15MinutesCount: number;
    ttlMinutes: number;
  };
  operationalDiagnostics: Awaited<ReturnType<AgentService["getOperationalDiagnostics"]>>;
}): DiagnosticsAlert[] {
  const alerts: DiagnosticsAlert[] = [];

  if (input.databaseStatus.status !== "ok") {
    alerts.push({
      code: "DATABASE_UNREACHABLE",
      severity: "critical",
      message: "Database health probe failed for the current backend runtime.",
    });
  }

  if (input.operationalDiagnostics.realtimeHub.stalePersistedConnectedCount > 0) {
    alerts.push({
      code: "REALTIME_CONNECTIONS_STALE",
      severity: "warning",
      message: `${input.operationalDiagnostics.realtimeHub.stalePersistedConnectedCount} realtime connection(s) have gone stale.`,
    });
  }

  if (input.adminSessionDiagnostics.expiringWithin15MinutesCount > 0) {
    alerts.push({
      code: "ADMIN_SESSIONS_EXPIRING_SOON",
      severity: "warning",
      message: `${input.adminSessionDiagnostics.expiringWithin15MinutesCount} admin session(s) expire within 15 minutes.`,
    });
  }

  if (input.agentSessionDiagnostics.expiringWithin15MinutesCount > 0) {
    alerts.push({
      code: "AGENT_SESSIONS_EXPIRING_SOON",
      severity: "warning",
      message: `${input.agentSessionDiagnostics.expiringWithin15MinutesCount} agent session(s) expire within 15 minutes.`,
    });
  }

  if (input.operationalDiagnostics.devices.staleCount > 0) {
    alerts.push({
      code: "DEVICES_STALE",
      severity: "warning",
      message: `${input.operationalDiagnostics.devices.staleCount} device(s) are currently marked stale.`,
    });
  }

  return alerts;
}
