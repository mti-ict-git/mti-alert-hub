import { z } from "zod";
import type { AppRoute, AppRouteHandlerContext } from "../../../app/http/create-server.js";
import type { AgentService } from "../../agent/service/agent-service.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import type { DeviceReadService } from "../service/device-read-service.js";
import type { DeviceActionService } from "../service/device-action-service.js";
import type { DeviceEnrollmentService } from "../service/device-enrollment-service.js";

const deviceListQuerySchema = baseListQuerySchema.extend({
  siteId: z.string().optional(),
  areaId: z.string().optional(),
  status: z.enum(["Online", "Offline", "Stale"]).optional(),
});

const pendingDeviceListQuerySchema = baseListQuerySchema;

const deviceTestNotificationSchema = z.object({
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  instruction: z.string().trim().min(1).optional().nullable(),
  windowsAgentPresentation: z.enum(["Toast", "Modal", "Fullscreen"]).optional().nullable(),
});

const createDeviceRolloutSchema = z.object({
  version: z.string().trim().min(1),
  packageUrl: z.string().trim().url(),
  sha256: z.string().trim().min(1),
  signature: z.string().trim().min(1),
  rolloutChannel: z.string().trim().min(1).optional().nullable(),
  action: z.enum(["Upgrade", "Repair", "Uninstall"]).optional(),
  mandatory: z.boolean().optional(),
  notes: z.string().trim().optional().nullable(),
  releaseNotes: z.string().trim().optional().nullable(),
  deadlineAt: z.string().trim().optional().nullable(),
  apply: z.boolean().optional(),
});

const approvePendingDeviceSchema = z.object({
  siteId: z.string().uuid(),
  areaId: z.string().uuid().optional().nullable(),
  locationLabel: z.string().trim().optional().nullable(),
  ownershipMode: z.enum(["LocationOwned", "EmployeeAssigned", "Mixed"]).optional().nullable(),
});

const rejectPendingDeviceSchema = z.object({
  reason: z.string().trim().optional().nullable(),
});

type RegisterDeviceRoutesOptions = {
  deviceReadService: DeviceReadService;
  deviceActionService: DeviceActionService;
  deviceEnrollmentService: DeviceEnrollmentService;
  agentService: AgentService;
};

export function registerDeviceRoutes(options: RegisterDeviceRoutesOptions): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/devices",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(deviceListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.deviceReadService.listDevices(query),
        };
      },
    },
    {
      method: "GET",
      path: "/devices/pending",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(pendingDeviceListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.deviceEnrollmentService.listPendingEnrollments(query),
        };
      },
    },
    {
      method: "GET",
      path: "/devices/rollout-packages/local",
      requiresAuth: true,
      async handler({ request }) {
        return {
          statusCode: 200,
          body: {
            items: await options.deviceActionService.listLocalPackages(
              resolveBackendBaseUrl(request),
            ),
          },
        };
      },
    },
    {
      method: "POST",
      path: "/devices/rollout-packages/upload",
      requiresAuth: true,
      async handler({ auth, request }) {
        const fileName = resolveUploadFileName(request);
        const fileBytes = await readBinaryBody(request);

        return {
          statusCode: 201,
          body: await options.deviceActionService.uploadLocalPackage(
            fileName,
            fileBytes,
            resolveBackendBaseUrl(request),
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
              ipAddress: request.socket.remoteAddress ?? null,
            },
          ),
        };
      },
    },
    {
      method: "DELETE",
      path: "/devices/rollout-packages/local/{fileName}",
      requiresAuth: true,
      async handler({ params, auth, request }) {
        return {
          statusCode: 200,
          body: await options.deviceActionService.deleteLocalPackage(
            params.fileName ?? "",
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
              ipAddress: request.socket.remoteAddress ?? null,
            },
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/devices/pending/{requestId}/approve",
      requiresAuth: true,
      async handler({ params, auth, request, json }) {
        const payload = validateWithSchema(approvePendingDeviceSchema, await json());
        return {
          statusCode: 201,
          body: await options.deviceEnrollmentService.approvePendingEnrollment(
            params.requestId ?? "",
            payload,
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
              ipAddress: request.socket.remoteAddress ?? null,
            },
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/devices/pending/{requestId}/reject",
      requiresAuth: true,
      async handler({ params, auth, request, json }) {
        const payload = validateWithSchema(rejectPendingDeviceSchema, await json());
        return {
          statusCode: 200,
          body: await options.deviceEnrollmentService.rejectPendingEnrollment(
            params.requestId ?? "",
            payload,
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
              ipAddress: request.socket.remoteAddress ?? null,
            },
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/devices/{deviceId}/test-notification",
      requiresAuth: true,
      async handler({ params, auth, request, json }) {
        const payload = validateWithSchema(deviceTestNotificationSchema, await json());
        return {
          statusCode: 201,
          body: await options.deviceActionService.sendTestNotification(params.deviceId ?? "", payload, {
            userIdentifier: auth?.session.user.id ?? "anonymous",
            username: auth?.session.user.username ?? "anonymous",
            ipAddress: request.socket.remoteAddress ?? null,
          }),
        };
      },
    },
    {
      method: "POST",
      path: "/devices/{deviceId}/rollouts",
      requiresAuth: true,
      async handler({ params, auth, request, json }) {
        const payload = validateWithSchema(createDeviceRolloutSchema, await json());
        return {
          statusCode: payload.apply === false ? 200 : 201,
          body: await options.deviceActionService.createRollout(params.deviceId ?? "", payload, {
            userIdentifier: auth?.session.user.id ?? "anonymous",
            username: auth?.session.user.username ?? "anonymous",
            ipAddress: request.socket.remoteAddress ?? null,
          }),
        };
      },
    },
    {
      method: "POST",
      path: "/devices/{deviceId}/revoke-session",
      requiresAuth: true,
      async handler({ params, auth, request }) {
        return {
          statusCode: 200,
          body: await options.agentService.revokeDeviceAccess(params.deviceId ?? "", {
            userIdentifier: auth?.session.user.id ?? "anonymous",
            username: auth?.session.user.username ?? "anonymous",
            ipAddress: request.socket.remoteAddress ?? null,
          }),
        };
      },
    },
  ];
}

function resolveBackendBaseUrl(request: AppRouteHandlerContext["request"]) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const host = (
    (typeof forwardedHost === "string" ? forwardedHost : undefined) ??
    (typeof request.headers.host === "string" ? request.headers.host : undefined) ??
    "127.0.0.1:4019"
  ).trim();
  const protocol = (
    (typeof forwardedProto === "string" ? forwardedProto : undefined) ??
    "http"
  ).replace(/:$/, "");

  return `${protocol}://${host}`;
}

function resolveUploadFileName(request: AppRouteHandlerContext["request"]) {
  const headerFileName = request.headers["x-file-name"];
  if (typeof headerFileName === "string" && headerFileName.trim().length > 0) {
    return headerFileName.trim();
  }

  throw new AppError({
    statusCode: 422,
    code: "VALIDATION_ERROR",
    message: "The request payload failed validation.",
    details: [{ field: "fileName", message: "X-File-Name header is required." }],
  });
}

async function readBinaryBody(
  request: AppRouteHandlerContext["request"],
  maxBytes = 1024 * 1024 * 512,
) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new AppError({
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: `Uploaded file exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`,
      });
    }

    chunks.push(buffer);
  }

  if (totalBytes === 0) {
    throw new AppError({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message: "The request payload failed validation.",
      details: [{ field: "file", message: "Upload content is empty." }],
    });
  }

  return Buffer.concat(chunks);
}
