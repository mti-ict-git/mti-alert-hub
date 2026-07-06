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
};

export function registerOrganizationRoutes(
  options: RegisterOrganizationRoutesOptions,
): AppRoute[] {
  return [
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
