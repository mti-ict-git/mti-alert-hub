import { checkAccessReadiness } from "../../modules/access/service/access-readiness.js";
import { createContextualDatabase } from "../../infrastructure/db/contextual-database.js";
import { PersistentAccessSessionStore } from "../../modules/access/service/persistent-access-session-store.js";
import { PersistentAuthService } from "../../modules/auth/service/persistent-auth-service.js";
import { DirectoryUserRepository } from "../../modules/access/service/directory-user-repository.js";
import { AccessDirectoryService } from "../../modules/access/service/access-directory-service.js";
import { UserAccessService } from "../../modules/access/service/user-access-service.js";
import { registerAccessRoutes } from "../../modules/access/controller/register-access-routes.js";
import { protectAdministrativeRoutes } from "../../modules/access/service/administrative-route-policy.js";
import { createAccessResourceEnforcer } from "../../modules/access/service/access-resource-enforcer.js";
import { OrganizationManagementService } from "../../modules/organization/service/organization-management-service.js";
import {
  loadEnv,
  resolveDeviceHealthThresholds,
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
import { LdapAuthenticator } from "../../modules/auth/service/ldap-authenticator.js";
import { registerCommunicationRoutes } from "../../modules/communications/controller/register-communication-routes.js";
import { AudiencePreviewService } from "../../modules/communications/service/audience-preview-service.js";
import { CommunicationDraftService } from "../../modules/communications/service/communication-draft-service.js";
import { CommunicationTemplateService } from "../../modules/communications/service/communication-template-service.js";
import { ResponseOverdueService } from "../../modules/communications/service/response-overdue-service.js";
import { registerDashboardRoutes } from "../../modules/dashboard/controller/register-dashboard-routes.js";
import { DashboardReadService } from "../../modules/dashboard/service/dashboard-read-service.js";
import { registerWorkflowRoutes } from "../../modules/workflows/controller/register-workflow-routes.js";
import { WorkflowDefinitionService } from "../../modules/workflows/service/workflow-definition-service.js";
import { registerDeviceRoutes } from "../../modules/devices/controller/register-device-routes.js";
import { DeviceActionService } from "../../modules/devices/service/device-action-service.js";
import { DeviceEnrollmentService } from "../../modules/devices/service/device-enrollment-service.js";
import { DeviceReadService } from "../../modules/devices/service/device-read-service.js";
import { registerHealthRoutes } from "../../modules/health/controller/register-health-routes.js";
import { registerOrganizationRoutes } from "../../modules/organization/controller/register-organization-routes.js";
import { OrganizationReadService } from "../../modules/organization/service/organization-read-service.js";
import { createLogger } from "../../shared/observability/logger.js";

export async function createBackendApp() {
  const env = loadEnv();
  validateSecuritySensitiveEnv(env);
  const enabledDeliveryChannels = resolveEnabledDeliveryChannels(env);
  const deviceHealthThresholds = resolveDeviceHealthThresholds(env);
  const logger = createLogger(env.LOG_LEVEL);
  const startedAt = new Date();

  const database = bootstrapDatabase(env, logger);
  database.client = createContextualDatabase(database.client);
  try {
    await database.client.ping();
    await checkAccessReadiness(database.client);
  } catch (error) {
    await database.close();
    throw error;
  }
  const persistentSessionStore = new PersistentAccessSessionStore(
    database.client,
    env.ADMIN_SESSION_TTL_MINUTES * 60 * 1000,
  );
  const adminSessionStore = persistentSessionStore;
  const accessDirectory = new AccessDirectoryService(env);
  const agentSessionStore = new AgentSessionStore(
    database.client,
    env.AGENT_SESSION_TTL_MINUTES * 60 * 1000,
  );
  const ldapAuthenticator = new LdapAuthenticator(env, logger);
  const organizationReadService = new OrganizationReadService(database.client);
  const deviceReadService = new DeviceReadService(database.client, deviceHealthThresholds);
  const dashboardReadService = new DashboardReadService(database.client);
  const auditLogService = new AuditLogService(database.client);
  const deviceEnrollmentService = new DeviceEnrollmentService(database.client, auditLogService);
  const workflowDefinitionService = new WorkflowDefinitionService(database.client);
  await workflowDefinitionService.ensureManagedWorkflowDefinitions();
  const responseOverdueService = new ResponseOverdueService(database.client, auditLogService);
  const agentService = new AgentService(
    database.client,
    agentSessionStore,
    auditLogService,
    responseOverdueService,
    deviceEnrollmentService,
    ldapAuthenticator,
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
    deviceHealthThresholds,
  );
  agentService.managedAuthorization = true;
  const authService = new PersistentAuthService(
    ldapAuthenticator,
    accessDirectory,
    new DirectoryUserRepository(database.client),
    persistentSessionStore,
  );

  const protect = (routes: import("../http/create-server.js").AppRoute[]) =>
    protectAdministrativeRoutes(routes, createAccessResourceEnforcer(database.client));
  const server = createHttpServer({
    logger,
    resolveSession: (sessionToken) =>
      sessionToken ? authService.getCurrentSession(sessionToken) : undefined,
    routes: protect([
      ...registerAccessRoutes({
        service: new UserAccessService(database.client),
        directory: accessDirectory,
        resolveActor: (auth) => ({
          id: auth.session.user.id,
          authorizationVersion: auth.session.authorizationVersion!,
        }),
      }),
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
        organizationManagementService: new OrganizationManagementService(database.client),
        organizationReadService,
      }),
      ...registerDeviceRoutes({
        deviceReadService,
        deviceActionService,
        deviceEnrollmentService,
        agentService,
      }),
      ...registerDashboardRoutes({
        dashboardReadService,
        communicationDraftService,
      }),
      ...registerWorkflowRoutes({
        workflowDefinitionService,
      }),
      ...registerAuditRoutes({
        auditLogService,
      }),
      ...registerAgentRoutes({
        agentService,
        deviceActionService,
      }),
      ...registerCommunicationRoutes({
        communicationDraftService,
        communicationTemplateService,
        auditLogService,
        audiencePreviewService,
      }),
    ]),
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
