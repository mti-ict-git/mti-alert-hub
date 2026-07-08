import { loadEnv } from "../config/env.js";
import { createHttpServer } from "../http/create-server.js";
import { bootstrapDatabase } from "../../infrastructure/db/connection.js";
import { registerAgentRoutes } from "../../modules/agent/controller/register-agent-routes.js";
import { AgentService } from "../../modules/agent/service/agent-service.js";
import { AgentSessionStore } from "../../modules/agent/service/agent-session-store.js";
import { registerAuthRoutes } from "../../modules/auth/controller/register-auth-routes.js";
import { AdminSessionStore } from "../../modules/auth/service/admin-session-store.js";
import { AuthService } from "../../modules/auth/service/auth-service.js";
import { LdapAuthenticator } from "../../modules/auth/service/ldap-authenticator.js";
import { registerCommunicationRoutes } from "../../modules/communications/controller/register-communication-routes.js";
import { AudiencePreviewService } from "../../modules/communications/service/audience-preview-service.js";
import { CommunicationDraftService } from "../../modules/communications/service/communication-draft-service.js";
import { CommunicationTemplateService } from "../../modules/communications/service/communication-template-service.js";
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
  const agentSessionStore = new AgentSessionStore(database.client);
  const ldapAuthenticator = new LdapAuthenticator(env, logger);
  const organizationReadService = new OrganizationReadService(database.client);
  const deviceReadService = new DeviceReadService(database.client);
  const agentService = new AgentService(database.client, agentSessionStore, env, logger);
  const communicationTemplateService = new CommunicationTemplateService(database.client);
  const audiencePreviewService = new AudiencePreviewService(
    database.client,
    communicationTemplateService,
  );
  const communicationDraftService = new CommunicationDraftService(
    database.client,
    communicationTemplateService,
    audiencePreviewService,
    agentService,
  );
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
      ...registerAgentRoutes({
        agentService,
      }),
      ...registerCommunicationRoutes({
        communicationDraftService,
        communicationTemplateService,
        audiencePreviewService,
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
