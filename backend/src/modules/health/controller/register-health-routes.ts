import { z } from "zod";

import type { BackendEnv } from "../../../app/config/env.js";
import type { AppRoute, AppRouteHandlerContext } from "../../../app/http/create-server.js";
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
  ];
}
