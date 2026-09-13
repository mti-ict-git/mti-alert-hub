import {
  OrganizationManagementService,
  organizationInput,
  organizationKind,
} from "../service/organization-management-service.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import { z } from "zod";

import type { AppRoute } from "../../../app/http/create-server.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import type { OrganizationReadService } from "../service/organization-read-service.js";

const areaListQuerySchema = baseListQuerySchema.extend({
  siteId: z.string().optional(),
});

const departmentListQuerySchema = baseListQuerySchema.extend({
  siteId: z.string().optional(),
});

const sectionListQuerySchema = baseListQuerySchema.extend({
  departmentId: z.string().optional(),
});

const employeeListQuerySchema = baseListQuerySchema.extend({
  siteId: z.string().optional(),
  areaId: z.string().optional(),
  departmentId: z.string().optional(),
  sectionId: z.string().optional(),
});

type RegisterOrganizationRoutesOptions = {
  organizationReadService: OrganizationReadService;
  organizationManagementService: OrganizationManagementService;
};

export function registerOrganizationRoutes(options: RegisterOrganizationRoutesOptions): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/organization",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler() {
        return { statusCode: 200, body: await options.organizationManagementService.list() };
      },
    },
    ...(["POST", "PATCH"] as const).map((method): AppRoute => ({
      method,
      path: method === "POST" ? "/organization/{kind}" : "/organization/{kind}/{id}",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ params, json, auth }) {
        const kind = validateWithSchema(organizationKind, params.kind);
        const id = method === "PATCH" ? validateWithSchema(z.string().uuid(), params.id) : null;
        const input = validateWithSchema(organizationInput, await json());
        return {
          statusCode: method === "POST" ? 201 : 200,
          body: await options.organizationManagementService.save(
            kind,
            id,
            input,
            auth!.session.user.username,
          ),
        };
      },
    })),
    {
      method: "GET",
      path: "/reference/organization",
      requiresAuth: true,
      async handler() {
        return {
          statusCode: 200,
          body: await options.organizationReadService.getOrganizationReference(),
        };
      },
    },
    {
      method: "GET",
      path: "/reference/sites",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(baseListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.organizationReadService.listSites(query),
        };
      },
    },
    {
      method: "GET",
      path: "/reference/areas",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(areaListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.organizationReadService.listAreas(query),
        };
      },
    },
    {
      method: "GET",
      path: "/reference/departments",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(departmentListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.organizationReadService.listDepartments(query),
        };
      },
    },
    {
      method: "GET",
      path: "/reference/sections",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(sectionListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.organizationReadService.listSections(query),
        };
      },
    },
    {
      method: "GET",
      path: "/employees",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(employeeListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.organizationReadService.listEmployees(query),
        };
      },
    },
  ];
}
