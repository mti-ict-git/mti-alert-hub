import { z } from "zod";

import type { AppRoute } from "../../../app/http/create-server.js";
import type { AgentService } from "../../agent/service/agent-service.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import type { DeviceReadService } from "../service/device-read-service.js";

const deviceListQuerySchema = baseListQuerySchema.extend({
  siteId: z.string().optional(),
  areaId: z.string().optional(),
  status: z.enum(["Online", "Offline", "Stale"]).optional(),
});

type RegisterDeviceRoutesOptions = {
  deviceReadService: DeviceReadService;
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
