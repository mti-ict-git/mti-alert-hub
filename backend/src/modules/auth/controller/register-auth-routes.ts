import { z } from "zod";

import type { AppRoute } from "../../../app/http/create-server.js";
import { sendNoContent } from "../../../shared/http/json-response.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import type { AdminSession } from "../model/admin-session.js";
import type { AuthService } from "../service/auth-service.js";

const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

type RegisterAuthRoutesOptions = {
  authService: AuthService;
};

export function registerAuthRoutes(options: RegisterAuthRoutesOptions): AppRoute[] {
  return [
    {
      method: "POST",
      path: "/auth/login",
      allowAnonymous: true,
      async handler({ json }) {
        const payload = validateWithSchema(loginRequestSchema, await json());
        const session = await options.authService.login(payload);

        return {
          statusCode: 200,
          body: serializeSession(session),
        };
      },
    },
    {
      method: "GET",
      path: "/auth/me",
      requiresAuth: true,
      async handler({ auth }) {
        if (!auth) {
          throw new Error("Authenticated route invoked without auth context.");
        }

        return {
          statusCode: 200,
          body: serializeSession(auth.session),
        };
      },
    },
    {
      method: "POST",
      path: "/auth/logout",
      requiresAuth: true,
      async handler({ auth, response }) {
        if (!auth) {
          throw new Error("Authenticated route invoked without auth context.");
        }

        options.authService.logout(auth.session.sessionToken);
        sendNoContent(response);
        return {
          statusCode: 204,
        };
      },
    },
  ];
}

function serializeSession(session: AdminSession) {
  return {
    sessionToken: session.sessionToken,
    user: {
      id: session.user.id,
      username: session.user.username,
      fullName: session.user.fullName,
      email: session.user.email,
      roleType: session.accessProfile.roleType,
    },
    scopes: session.accessProfile.scopes,
    expiresAt: session.expiresAt,
  };
}
