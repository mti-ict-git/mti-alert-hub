import { loadEnv } from "../config/env.js";
import { createHttpServer } from "../http/create-server.js";
import { bootstrapDatabase } from "../../infrastructure/db/connection.js";
import { registerAuthRoutes } from "../../modules/auth/controller/register-auth-routes.js";
import { AdminSessionStore } from "../../modules/auth/service/admin-session-store.js";
import { AuthService } from "../../modules/auth/service/auth-service.js";
import { LdapAuthenticator } from "../../modules/auth/service/ldap-authenticator.js";
import { AccessProfileService } from "../../modules/access/service/access-profile-service.js";
import { registerDeviceRoutes } from "../../modules/devices/controller/register-device-routes.js";
import { DeviceReadService } from "../../modules/devices/service/device-read-service.js";
import { registerHealthRoutes } from "../../modules/health/controller/register-health-routes.js";
import { registerOrganizationRoutes } from "../../modules/organization/controller/register-organization-routes.js";
import { OrganizationReadService } from "../../modules/organization/service/organization-read-service.js";
import { createLogger } from "../../shared/observability/logger.js";

export async function createBackendApp() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const startedAt = new Date();

  const database = bootstrapDatabase(env, logger);
  await database.client.ping();
  const accessProfileService = new AccessProfileService();
  const adminSessionStore = new AdminSessionStore();
  const ldapAuthenticator = new LdapAuthenticator(env, logger);
  const organizationReadService = new OrganizationReadService(database.client);
  const deviceReadService = new DeviceReadService(database.client);
  const authService = new AuthService(
    ldapAuthenticator,
    accessProfileService,
    adminSessionStore,
    logger,
  );

  const server = createHttpServer({
    logger,
    resolveSession: (sessionToken) =>
      sessionToken ? authService.getCurrentSession(sessionToken) : undefined,
    routes: [
      ...registerHealthRoutes({
        env,
        startedAt,
      }),
      ...registerAuthRoutes({
        authService,
      }),
      ...registerOrganizationRoutes({
        organizationReadService,
      }),
      ...registerDeviceRoutes({
        deviceReadService,
      }),
    ],
  });

  return {
    env,
    logger,
    server,
    startedAt,
    database,
    authService,
  };
}
