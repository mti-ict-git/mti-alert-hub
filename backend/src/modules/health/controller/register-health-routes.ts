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
      async handler() {
        const [adminSessionDiagnostics, agentSessionDiagnostics, operationalDiagnostics, databaseStatus] =
          await Promise.all([
            Promise.resolve(options.adminSessionStore.getDiagnostics()),
            options.agentSessionStore.getDiagnostics(),
            options.agentService.getOperationalDiagnostics(),
            probeDatabase(options.database),
          ]);

        const overallStatus =
          databaseStatus.status === "ok" &&
          operationalDiagnostics.realtimeHub.stalePersistedConnectedCount === 0
            ? "ok"
            : "degraded";

        return {
          statusCode: 200,
          body: {
            status: overallStatus,
            service: options.env.APP_NAME,
            environment: options.env.NODE_ENV,
            startedAt: options.startedAt.toISOString(),
            uptimeSeconds: Math.floor((Date.now() - options.startedAt.getTime()) / 1000),
            enabledDeliveryChannels: options.enabledDeliveryChannels,
            database: databaseStatus,
            adminSessions: adminSessionDiagnostics,
            agentSessions: agentSessionDiagnostics,
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
