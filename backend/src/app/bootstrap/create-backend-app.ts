import {
  loadEnv,
  resolveEnabledDeliveryChannels,
  validateSecuritySensitiveEnv,
} from "../config/env.js";
import { createHttpServer } from "../http/create-server.js";
import { bootstrapDatabase } from "../../infrastructure/db/connection.js";
import { registerAgentRoutes } from "../../modules/agent/controller/register-agent-routes.js";
import { AgentService } from "../../modules/agent/service/agent-service.js";
import { AgentSessionStore } from "../../modules/agent/service/agent-session-store.js";
import { registerAuditRoutes } from "../../modules/audit/controller/register-audit-routes.js";
import { AuditLogService } from "../../modules/audit/service/audit-log-service.js";
import { registerAuthRoutes } from "../../modules/auth/controller/register-auth-routes.js";
import { AdminSessionStore } from "../../modules/auth/service/admin-session-store.js";
import { AuthService } from "../../modules/auth/service/auth-service.js";
import { LdapAuthenticator } from "../../modules/auth/service/ldap-authenticator.js";
import { registerCommunicationRoutes } from "../../modules/communications/controller/register-communication-routes.js";
import { AudiencePreviewService } from "../../modules/communications/service/audience-preview-service.js";
import { CommunicationDraftService } from "../../modules/communications/service/communication-draft-service.js";
import { CommunicationTemplateService } from "../../modules/communications/service/communication-template-service.js";
import { ResponseOverdueService } from "../../modules/communications/service/response-overdue-service.js";
import { AccessProfileService } from "../../modules/access/service/access-profile-service.js";
import { registerDashboardRoutes } from "../../modules/dashboard/controller/register-dashboard-routes.js";
import { DashboardReadService } from "../../modules/dashboard/service/dashboard-read-service.js";
import { registerWorkflowRoutes } from "../../modules/workflows/controller/register-workflow-routes.js";
import { WorkflowDefinitionService } from "../../modules/workflows/service/workflow-definition-service.js";
import { registerDeviceRoutes } from "../../modules/devices/controller/register-device-routes.js";
import { DeviceActionService } from "../../modules/devices/service/device-action-service.js";
import { DeviceReadService } from "../../modules/devices/service/device-read-service.js";
import { registerHealthRoutes } from "../../modules/health/controller/register-health-routes.js";
import { registerOrganizationRoutes } from "../../modules/organization/controller/register-organization-routes.js";
import { OrganizationReadService } from "../../modules/organization/service/organization-read-service.js";
import { createLogger } from "../../shared/observability/logger.js";

export async function createBackendApp() {
  const env = loadEnv();
  validateSecuritySensitiveEnv(env);
  const enabledDeliveryChannels = resolveEnabledDeliveryChannels(env);
  const logger = createLogger(env.LOG_LEVEL);
  const startedAt = new Date();

  const database = bootstrapDatabase(env, logger);
  await database.client.ping();
  const accessProfileService = new AccessProfileService();
  const adminSessionStore = new AdminSessionStore(env.ADMIN_SESSION_TTL_MINUTES * 60 * 1000);
  const agentSessionStore = new AgentSessionStore(
    database.client,
    env.AGENT_SESSION_TTL_MINUTES * 60 * 1000,
  );
  const ldapAuthenticator = new LdapAuthenticator(env, logger);
  const organizationReadService = new OrganizationReadService(database.client);
  const deviceReadService = new DeviceReadService(database.client);
  const dashboardReadService = new DashboardReadService(database.client);
  const auditLogService = new AuditLogService(database.client);
  const workflowDefinitionService = new WorkflowDefinitionService(database.client);
  await workflowDefinitionService.ensureManagedWorkflowDefinitions();
  const responseOverdueService = new ResponseOverdueService(database.client, auditLogService);
  const agentService = new AgentService(
    database.client,
    agentSessionStore,
    auditLogService,
    responseOverdueService,
    env,
    logger,
  );
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
    auditLogService,
    workflowDefinitionService,
    enabledDeliveryChannels,
  );
  const deviceActionService = new DeviceActionService(
    database.client,
    communicationDraftService,
    auditLogService,
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
        database: database.client,
        adminSessionStore,
        agentSessionStore,
        agentService,
        enabledDeliveryChannels,
      }),
      ...registerAuthRoutes({
        authService,
      }),
      ...registerOrganizationRoutes({
        organizationReadService,
      }),
      ...registerDeviceRoutes({
        deviceReadService,
        deviceActionService,
        agentService,
      }),
      ...registerDashboardRoutes({
        dashboardReadService,
      }),
      ...registerWorkflowRoutes({
        workflowDefinitionService,
      }),
      ...registerAuditRoutes({
        auditLogService,
      }),
      ...registerAgentRoutes({
        agentService,
      }),
      ...registerCommunicationRoutes({
        communicationDraftService,
        communicationTemplateService,
        auditLogService,
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
