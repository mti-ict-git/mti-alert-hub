import type { AppRoute } from "../../../app/http/create-server.js";
import type { DashboardReadService } from "../service/dashboard-read-service.js";

type RegisterDashboardRoutesOptions = {
  dashboardReadService: DashboardReadService;
};

export function registerDashboardRoutes(
  options: RegisterDashboardRoutesOptions,
): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/dashboard/overview",
      requiresAuth: true,
      async handler() {
        return {
          statusCode: 200,
          body: await options.dashboardReadService.getOverview(),
        };
      },
    },
    {
      method: "GET",
      path: "/dashboard/content-type-rollups",
      requiresAuth: true,
      async handler() {
        return {
          statusCode: 200,
          body: {
            items: await options.dashboardReadService.getContentTypeRollups(),
          },
        };
      },
    },
  ];
}
