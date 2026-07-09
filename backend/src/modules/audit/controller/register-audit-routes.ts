import { z } from "zod";

import type { AppRoute } from "../../../app/http/create-server.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import type { AuditLogService } from "../service/audit-log-service.js";

const auditLogListQuerySchema = baseListQuerySchema.extend({
  module: z.string().trim().optional(),
});

type RegisterAuditRoutesOptions = {
  auditLogService: AuditLogService;
};

export function registerAuditRoutes(options: RegisterAuditRoutesOptions): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/audit-logs",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(auditLogListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.auditLogService.listAuditLogs(query),
        };
      },
    },
  ];
}
