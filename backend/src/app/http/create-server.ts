import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { AdminRoleType } from "../../modules/access/model/admin-access.js";
import { requireRole } from "../../modules/access/service/access-guard.js";
import type { AdminSession } from "../../modules/auth/model/admin-session.js";
import { AppError, isAppError } from "../../shared/errors/app-error.js";
import { sendJson } from "../../shared/http/json-response.js";
import type { Logger } from "../../shared/observability/logger.js";

export type AuthContext = {
  session: AdminSession;
};

export type AppRouteHandlerContext = {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  auth?: AuthContext;
  json: () => Promise<unknown>;
};

export type AppRouteResult = {
  statusCode: number;
  body?: unknown;
};

export type AppRoute = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  allowAnonymous?: boolean;
  requiresAuth?: boolean;
  requiredRoles?: AdminRoleType[];
  handler: (context: AppRouteHandlerContext) => Promise<AppRouteResult> | AppRouteResult;
};

type CreateServerOptions = {
  logger: Logger;
  routes: AppRoute[];
  resolveSession: (sessionToken: string | undefined) => AdminSession | undefined;
};

export function createHttpServer(options: CreateServerOptions) {
  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    try {
      const auth = resolveAuthContext(request, options.resolveSession);
      const route = options.routes.find(
        (candidate) =>
          candidate.method === request.method && candidate.path === requestUrl.pathname,
      );

      if (!route) {
        sendJson(response, 404, {
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
        });
        return;
      }

      if (route.requiresAuth && !auth) {
        sendJson(response, 401, {
          code: "UNAUTHORIZED",
          message: "Authentication is required.",
        });
        return;
      }

      if (auth && route.requiredRoles) {
        try {
          requireRole(auth.session.accessProfile, route.requiredRoles);
        } catch (error) {
          if (isAppError(error)) {
            sendJson(response, error.statusCode, {
              code: error.code,
              message: error.message,
            });
            return;
          }

          throw error;
        }
      }

      const result = await route.handler({
        request,
        response,
        url: requestUrl,
        auth,
        json: () => parseJsonBody(request),
      });

      if (response.writableEnded) {
        return;
      }

      sendJson(response, result.statusCode, result.body ?? null);
    } catch (error) {
      if (isAppError(error)) {
        sendJson(response, error.statusCode, {
          code: error.code,
          message: error.message,
          ...(error.details ? { errors: error.details } : {}),
        });
      } else {
        options.logger.error("http.request.unhandled_error", {
          method: request.method,
          path: requestUrl.pathname,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        sendJson(response, 500, {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    } finally {
      options.logger.info("http.request.completed", {
        method: request.method,
        path: requestUrl.pathname,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    }
  });
}

async function parseJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_JSON",
      message: "The request body is not valid JSON.",
    });
  }
}

function resolveAuthContext(
  request: IncomingMessage,
  resolveSession: CreateServerOptions["resolveSession"],
): AuthContext | undefined {
  const authorizationHeader = request.headers.authorization;
  const sessionToken = extractBearerToken(authorizationHeader);
  const session = resolveSession(sessionToken);
  if (!session) {
    return undefined;
  }

  return { session };
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token;
}
