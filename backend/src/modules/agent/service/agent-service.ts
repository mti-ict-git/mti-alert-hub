import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/errors/app-error.js";
import type { Logger } from "../../../shared/observability/logger.js";
import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";
import type { BackendEnv } from "../../../app/config/env.js";
import { resolveDeviceHealthThresholds } from "../../../app/config/env.js";
import { resolveWindowsAgentPendingMessageTtlMinutes } from "../../../app/config/env.js";
import type { AuditLogService } from "../../audit/service/audit-log-service.js";
import type { LdapAuthenticator, DirectoryUserProfile } from "../../auth/service/ldap-authenticator.js";
import type { AgentSession } from "./agent-session-store.js";
import { AgentSessionStore } from "./agent-session-store.js";
import type { WindowsAgentPresentation } from "../../communications/service/communication-template-service.js";
import type { ResponseOverdueService } from "../../communications/service/response-overdue-service.js";
import type { DeviceEnrollmentService } from "../../devices/service/device-enrollment-service.js";
import { buildDeviceHealthStatusSql } from "../../devices/service/device-health-sql.js";

type DeviceRecord = {
  id: string;
  deviceIdentifier: string | null;
  hostname: string;
  siteId: string;
  areaId: string | null;
  locationLabel: string | null;
  ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
  agentVersion: string | null;
  lastHeartbeatAt: string | null;
  lastConnectionAt: string | null;
  status: "Online" | "Offline" | "Stale";
  siteName: string | null;
  areaName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  lastActiveUserIdentifier: string | null;
  lastDirectoryUserType: "Employee" | "NonEmployee" | "Unknown";
  lastDirectoryUsername: string | null;
  lastDirectoryDisplayName: string | null;
  lastDirectoryEmployeeNumber: string | null;
  lastDirectoryDepartment: string | null;
  lastDirectoryTitle: string | null;
  lastDirectoryMobile: string | null;
  lastDirectoryEmail: string | null;
  lastDirectoryLookupAt: string | null;
};

type DeviceDirectorySnapshot = {
  activeUserIdentifier: string | null;
  userType: "Employee" | "NonEmployee" | "Unknown";
  username: string | null;
  displayName: string | null;
  employeeNumber: string | null;
  department: string | null;
  title: string | null;
  mobile: string | null;
  email: string | null;
  lookupAt: string | null;
};

type WorkflowSnapshot = {
  id: string;
  name: string;
  allowFreeText: boolean;
  requireFreeText: boolean;
  escalationTimeoutMinutes: number | null;
  escalationMode: "RecipientOnly" | null;
  responseImpliesAck: boolean;
  options: Array<{
    key: string;
    label: string;
  }>;
};

type AgentMessageRow = {
  messageId: string;
  communicationId: string;
  title: string;
  body: string;
  instruction: string | null;
  priority: "Info" | "Warning" | "Critical";
  windowsAgentPresentation: WindowsAgentPresentation | null;
  toastAutoDismissSeconds: number | null;
  requiresResponse: boolean;
  templateVersion: number | null;
  workflowSnapshot: unknown;
  templatePolicySnapshot: unknown;
  updatedAt: string;
};

type OwnedAgentMessageRow = {
  messageId: string;
  communicationRecipientId: string;
  communicationId: string;
  title: string;
  body: string;
  priority: "Info" | "Warning" | "Critical";
  windowsAgentPresentation: WindowsAgentPresentation | null;
  toastAutoDismissSeconds: number | null;
  requiresResponse: boolean;
  templateVersion: number | null;
  workflowSnapshot: unknown;
  templatePolicySnapshot: unknown;
  jobStatus: "Pending" | "Sent" | "Delivered" | "Displayed" | "Read" | "Responded" | "Failed";
  responseState: string;
  ackState: string;
};

type DeliveryEventRow = {
  id: string;
  occurredAt: string;
  eventPayload: unknown;
};

type ReminderEventType =
  | "Triggered"
  | "Displayed"
  | "Read"
  | "Dismissed"
  | "Snoozed"
  | "Responded"
  | "Started"
  | "StepAdvanced"
  | "Completed"
  | "TimedOut";

type WellnessProgramPayload = {
  programType: "SimpleReminder" | "GuidedRoutine";
  theme: "Blue" | "Green";
  layoutVariant:
    | "ReminderCard"
    | "CountdownCard"
    | "GuidedRoutine"
    | "CompletionCard"
    | "OverviewCard";
  heroAssetUrl: string | null;
  countdownSeconds: number | null;
  rotationMode: "Fixed" | "Sequential" | "Random" | null;
  actions: Array<{
    actionKey: string;
    kind: "GotIt" | "Done" | "Start" | "Next" | "Close" | "RemindMeLater";
    label: string;
    style: "Primary" | "Secondary" | "Ghost" | null;
    snoozeMinutes: number | null;
  }>;
  steps: Array<{
    stepKey: string;
    title: string;
    description: string | null;
    assetUrl: string | null;
    durationSeconds: number | null;
    sortOrder: number;
  }>;
  localizations: Array<{
    locale: string;
    title: string | null;
    body: string | null;
    instruction: string | null;
  }>;
};

type AgentReminderPolicyRow = {
  policyId: string;
  communicationId: string;
  scheduleVersion: number;
  recurrenceRule: string;
  timezone: string;
  validFrom: string | null;
  validUntil: string | null;
  title: string;
  body: string;
  instruction: string | null;
  windowsAgentPresentation: WindowsAgentPresentation | null;
  toastAutoDismissSeconds: number | null;
  requiresResponse: boolean;
  workflowId: string | null;
  isActive: boolean;
  updatedAt: string;
  wellnessProgram: unknown;
};

type OwnedReminderPolicyRow = {
  policyId: string;
  deviceId: string;
  communicationId: string;
  isActive: boolean;
  validUntil: string | null;
};

type CreateAgentSessionInput = {
  deviceIdentifier: string;
  employeeNumber?: string | null;
  agentVersion?: string | null;
  activeUserIdentifier?: string | null;
  hostname?: string | null;
};

type NegotiateRealtimeInput = {
  deviceIdentifier: string;
  requestBaseUrl?: string;
};

type HeartbeatInput = {
  deviceIdentifier: string;
  heartbeatAt: string;
  status?: "Online" | "Offline" | "Stale" | null;
  agentVersion?: string | null;
  activeUserIdentifier?: string | null;
};

type LifecycleEventInput = {
  occurredAt: string;
  activeUserIdentifier?: string | null;
};

type MessageResponseInput = {
  responseOptionKey: string;
  responseNote?: string | null;
  occurredAt?: string | null;
  activeUserIdentifier?: string | null;
};

type ReminderEventInput = {
  eventType: ReminderEventType;
  occurredAt: string;
  activeUserIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RolloutAction = "Upgrade" | "Repair" | "Uninstall";

type RolloutState =
  | "UpdateAvailable"
  | "Downloading"
  | "Staged"
  | "InstallPending"
  | "Installing"
  | "Succeeded"
  | "Failed"
  | "UninstallPending"
  | "Uninstalling"
  | "Uninstalled";

type RolloutStatusInput = {
  rolloutId: string;
  state: RolloutState;
  installedVersion?: string | null;
  targetVersion?: string | null;
  updaterVersion?: string | null;
  startupRegistered?: boolean | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  occurredAt: string;
  metadataJson?: Record<string, unknown> | null;
};

type ActiveRealtimeConnection = {
  deviceId: string;
  connectionId: string;
  sessionToken: string;
  response: ServerResponse;
  keepAliveTimer: ReturnType<typeof setInterval>;
};

type RealtimeStreamInput = {
  sessionToken: string;
  deviceIdentifier: string;
  connectionId: string;
  request: IncomingMessage;
  response: ServerResponse;
};

type AgentAuditContext = {
  ipAddress?: string | null;
};

type AgentRolloutIntentRow = {
  rolloutId: string;
  action: RolloutAction;
  rolloutChannel: string | null;
  targetVersion: string;
  mandatory: boolean;
  deadlineAt: string | null;
  notes: string | null;
  createdAt: string;
  packageType: "MSI";
  packageUrl: string;
  sha256: string;
  signature: string;
  releaseNotes: string | null;
};

type AgentOwnedRolloutIntentRow = {
  rolloutId: string;
  deviceId: string;
};

export class AgentService {
  private readonly realtimeConnections = new Map<string, ActiveRealtimeConnection>();
  private readonly deviceStatusSql: string;
  private readonly pendingMessageTtlMinutes: number;

  constructor(
    private readonly database: DatabaseClient,
    private readonly sessionStore: AgentSessionStore,
    private readonly auditLogService: AuditLogService,
    private readonly responseOverdueService: ResponseOverdueService,
    private readonly deviceEnrollmentService: DeviceEnrollmentService,
    private readonly ldapAuthenticator: LdapAuthenticator,
    private readonly env: BackendEnv,
    private readonly logger: Logger,
  ) {
    this.deviceStatusSql = buildDeviceHealthStatusSql(resolveDeviceHealthThresholds(env));
    this.pendingMessageTtlMinutes = resolveWindowsAgentPendingMessageTtlMinutes(env);
  }

  async createSession(input: CreateAgentSessionInput) {
    let device: DeviceRecord;
    try {
      device = await this.requireKnownDevice({
        deviceIdentifier: input.deviceIdentifier,
        hostname: input.hostname ?? null,
      });
    } catch (error) {
      if (isDeviceNotRegisteredError(error)) {
        const enrollmentRequest = await this.deviceEnrollmentService.recordAgentEnrollmentAttempt({
          deviceIdentifier: input.deviceIdentifier,
          hostname: input.hostname ?? null,
          agentVersion: input.agentVersion ?? null,
          employeeNumber: input.employeeNumber ?? null,
          activeUserIdentifier: input.activeUserIdentifier ?? null,
        });

        if (enrollmentRequest?.requestStatus === "Rejected") {
          throw new AppError({
            statusCode: 409,
            code: "DEVICE_ENROLLMENT_REJECTED",
            message:
              "This Windows Agent device was rejected by an administrator and cannot create a trusted session.",
          });
        }

        throw new AppError({
          statusCode: 409,
          code: "DEVICE_PENDING_APPROVAL",
          message:
            "This Windows Agent device is waiting for admin approval before it can create a trusted session.",
        });
      }

      throw error;
    }

    const session = await this.sessionStore.createSession({
      device: {
        id: device.id,
        deviceIdentifier: device.deviceIdentifier,
        hostname: device.hostname,
      },
      activeUserIdentifier: normalizeOptionalText(input.activeUserIdentifier),
    });

    const directorySnapshot = await this.resolveDirectorySnapshot(
      input.activeUserIdentifier ?? null,
      input.employeeNumber ?? null,
    );

    await this.database.query(
      `
        update public.devices
        set
          device_identifier = coalesce($2, device_identifier),
          agent_version = coalesce($3, agent_version),
          hostname = coalesce($4, hostname),
          last_connection_at = now(),
          status = 'Online',
          last_active_user_identifier = $5,
          last_directory_user_type = $6,
          last_directory_username = $7,
          last_directory_display_name = $8,
          last_directory_employee_number = $9,
          last_directory_department = $10,
          last_directory_title = $11,
          last_directory_mobile = $12,
          last_directory_email = $13,
          last_directory_lookup_at = $14::timestamptz
        where id::text = $1
      `,
      [
        device.id,
        input.deviceIdentifier,
        input.agentVersion ?? null,
        input.hostname ?? null,
        directorySnapshot.activeUserIdentifier,
        directorySnapshot.userType,
        directorySnapshot.username,
        directorySnapshot.displayName,
        directorySnapshot.employeeNumber,
        directorySnapshot.department,
        directorySnapshot.title,
        directorySnapshot.mobile,
        directorySnapshot.email,
        directorySnapshot.lookupAt,
      ],
    );

    this.logger.info("agent.session.created", {
      deviceId: device.id,
      deviceIdentifier: input.deviceIdentifier,
      hostname: device.hostname,
      hasEmployeeNumber: Boolean(input.employeeNumber),
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });

    const refreshedDevice = await this.requireDeviceById(device.id);

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      device: this.serializeDevice(refreshedDevice),
    };
  }

  getSession(sessionToken: string): Promise<AgentSession | undefined> {
    return this.sessionStore.getSession(sessionToken);
  }

  async negotiateRealtime(sessionToken: string, input: NegotiateRealtimeInput) {
    const session = await this.requireSession(sessionToken, { renew: true });
    await this.ensureSessionOwnsDevice(session, input.deviceIdentifier);

    const connectionIdentifier = randomUUID();
    await this.database.withTransaction(async (transaction) => {
      await transaction.query(
        `
          update public.device_realtime_connections
          set
            status = 'Expired',
            disconnected_at = coalesce(disconnected_at, now()),
            last_seen_at = now()
          where device_id = $1::uuid
            and status = 'Connected'
        `,
        [session.device.id],
      );
      await transaction.query(
        `
          insert into public.device_realtime_connections (
            device_id,
            connection_identifier,
            status
          )
          values (
            $1::uuid,
            $2,
            'Connected'
          )
        `,
        [session.device.id, connectionIdentifier],
      );
    });

    return {
      connectionUrl: this.buildRealtimeUrl(
        connectionIdentifier,
        input.deviceIdentifier,
        input.requestBaseUrl,
      ),
      accessToken: session.sessionToken,
      connectionId: connectionIdentifier,
      transport: "SSE",
    };
  }

  async openRealtimeStream(input: RealtimeStreamInput) {
    const session = await this.requireSession(input.sessionToken, { renew: true });
    await this.ensureSessionOwnsDevice(session, input.deviceIdentifier);
    await this.requireActiveRealtimeConnection(session.device.id, input.connectionId);

    this.registerRealtimeStream({
      connectionId: input.connectionId,
      deviceId: session.device.id,
      sessionToken: input.sessionToken,
      request: input.request,
      response: input.response,
    });

    await this.touchRealtimeConnection(session.device.id, input.connectionId);
    this.writeRealtimeEvent(input.response, "connected", {
      connectionId: input.connectionId,
      deviceId: session.device.id,
      connectedAt: new Date().toISOString(),
      transport: "SSE",
    });

    const pendingMessages = await this.listPendingMessagesByDeviceId(
      session.device.id,
      null,
      session.activeUserIdentifier,
    );
    this.writeRealtimeEvent(input.response, "messages.snapshot", {
      items: pendingMessages.items,
      nextCursor: pendingMessages.nextCursor,
    });
  }

  async reportHeartbeat(sessionToken: string, input: HeartbeatInput) {
    const session = await this.requireSession(sessionToken, { renew: true });
    await this.ensureSessionOwnsDevice(session, input.deviceIdentifier);
    this.ensureIsoDate(input.heartbeatAt, "heartbeatAt");
    const normalizedActiveUserIdentifier = normalizeOptionalText(input.activeUserIdentifier);
    const shouldRefreshDirectorySnapshot =
      normalizedActiveUserIdentifier !== normalizeOptionalText(session.activeUserIdentifier);
    const directorySnapshot = shouldRefreshDirectorySnapshot
      ? await this.resolveDirectorySnapshot(normalizedActiveUserIdentifier, null)
      : null;

    await this.sessionStore.updateSessionActiveUser(sessionToken, normalizedActiveUserIdentifier);

    await this.database.query(
      `
        update public.devices
        set
          device_identifier = coalesce($2, device_identifier),
          last_heartbeat_at = $3::timestamptz,
          status = coalesce($4, status),
          agent_version = coalesce($5, agent_version),
          last_active_user_identifier = case when $6 then $7 else last_active_user_identifier end,
          last_directory_user_type = case when $6 then $8 else last_directory_user_type end,
          last_directory_username = case when $6 then $9 else last_directory_username end,
          last_directory_display_name = case when $6 then $10 else last_directory_display_name end,
          last_directory_employee_number = case when $6 then $11 else last_directory_employee_number end,
          last_directory_department = case when $6 then $12 else last_directory_department end,
          last_directory_title = case when $6 then $13 else last_directory_title end,
          last_directory_mobile = case when $6 then $14 else last_directory_mobile end,
          last_directory_email = case when $6 then $15 else last_directory_email end,
          last_directory_lookup_at = case when $6 then $16::timestamptz else last_directory_lookup_at end,
          updated_at = now()
        where id::text = $1
      `,
      [
        session.device.id,
        input.deviceIdentifier,
        input.heartbeatAt,
        input.status ?? null,
        normalizeOptionalText(input.agentVersion),
        shouldRefreshDirectorySnapshot,
        directorySnapshot?.activeUserIdentifier ?? null,
        directorySnapshot?.userType ?? null,
        directorySnapshot?.username ?? null,
        directorySnapshot?.displayName ?? null,
        directorySnapshot?.employeeNumber ?? null,
        directorySnapshot?.department ?? null,
        directorySnapshot?.title ?? null,
        directorySnapshot?.mobile ?? null,
        directorySnapshot?.email ?? null,
        directorySnapshot?.lookupAt ?? null,
      ],
    );

    this.logger.info("agent.heartbeat.recorded", {
      deviceId: session.device.id,
      deviceIdentifier: input.deviceIdentifier,
      status: input.status ?? "unchanged",
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });
  }

  async listPendingMessages(sessionToken: string, since?: string | null) {
    const session = await this.requireSession(sessionToken, { renew: true });
    return this.listPendingMessagesByDeviceId(session.device.id, since, session.activeUserIdentifier);
  }

  async notifyPendingMessagesForDevices(deviceIds: string[]) {
    const uniqueDeviceIds = [...new Set(deviceIds.filter((deviceId) => deviceId.trim().length > 0))];
    await Promise.all(
      uniqueDeviceIds.map(async (deviceId) => {
        const connection = this.findConnectionForDevice(deviceId);
        if (!connection) {
          return;
        }

        const session = await this.sessionStore.getSession(connection.sessionToken);
        const pendingMessages = await this.listPendingMessagesByDeviceId(
          deviceId,
          null,
          session?.activeUserIdentifier ?? null,
        );
        this.writeRealtimeEvent(connection.response, "messages.available", {
          items: pendingMessages.items,
          nextCursor: pendingMessages.nextCursor,
        });
        await this.touchRealtimeConnection(deviceId, connection.connectionId);
      }),
    );
  }

  async listReminderPolicies(sessionToken: string, since?: string | null) {
    const session = await this.requireSession(sessionToken, { renew: true });
    if (since) {
      this.ensureOptionalIsoDate(since, "since");
    }

    const params: unknown[] = [session.device.id];
    const sinceClause = since
      ? `and arp.updated_at >= $${params.push(since)}::timestamptz`
      : "";
    const rows = await this.database.query<AgentReminderPolicyRow>(
      `
        select
          arp.id::text as "policyId",
          arp.communication_id::text as "communicationId",
          arp.schedule_version as "scheduleVersion",
          arp.recurrence_rule::text as "recurrenceRule",
          arp.timezone::text as timezone,
          coalesce(arp.valid_from, cs.valid_from)::text as "validFrom",
          arp.valid_until::text as "validUntil",
          arp.title_snapshot::text as title,
          arp.body_snapshot::text as body,
          arp.instruction_snapshot::text as instruction,
          arp.windows_agent_presentation::text as "windowsAgentPresentation",
          arp.toast_auto_dismiss_seconds as "toastAutoDismissSeconds",
          c.requires_response as "requiresResponse",
          c.workflow_id::text as "workflowId",
          arp.is_active as "isActive",
          arp.updated_at::text as "updatedAt",
          arp.wellness_program_json as "wellnessProgram"
        from public.agent_reminder_policies arp
        inner join public.communication_schedules cs on cs.id = arp.communication_schedule_id
        inner join public.communications c on c.id = arp.communication_id
        where arp.device_id = $1::uuid
          ${sinceClause}
        order by arp.updated_at asc, arp.created_at asc
      `,
      params,
    );

    if (rows.length > 0) {
      await this.database.query(
        `
          update public.agent_reminder_policies
          set last_synced_at = now()
          where id = any($1::uuid[])
        `,
        [rows.map((row) => row.policyId)],
      );
    }

    const workflowCache = new Map<string, WorkflowSnapshot | null>();

    return {
      items: await Promise.all(
        rows.map(async (row) => {
          const workflow = row.workflowId
            ? await this.getWorkflowSnapshotCached(workflowCache, row.workflowId)
            : null;

          return {
            policyId: row.policyId,
            communicationId: row.communicationId,
            scheduleVersion: row.scheduleVersion,
            recurrenceRule: row.recurrenceRule,
            timezone: row.timezone,
            validFrom: row.validFrom,
            validUntil: row.validUntil,
            title: row.title,
            body: row.body,
            instruction: row.instruction,
            windowsAgentPresentation: row.windowsAgentPresentation,
            toastAutoDismissSeconds: row.toastAutoDismissSeconds,
            wellnessProgram: parseWellnessProgramPayload(row.wellnessProgram),
            requiresResponse: row.requiresResponse,
            workflow,
            isActive: row.isActive,
            updatedAt: row.updatedAt,
          };
        }),
      ),
    };
  }

  async getRolloutIntent(sessionToken: string) {
    const session = await this.requireSession(sessionToken, { renew: true });
    const rows = await this.database.query<AgentRolloutIntentRow>(
      `
        select
          ari.id::text as "rolloutId",
          ari.action::text as action,
          ari.rollout_channel::text as "rolloutChannel",
          ari.target_version::text as "targetVersion",
          ari.mandatory as mandatory,
          ari.deadline_at::text as "deadlineAt",
          ari.notes::text as notes,
          ari.created_at::text as "createdAt",
          arp.package_type::text as "packageType",
          arp.package_url::text as "packageUrl",
          arp.sha256::text as sha256,
          arp.signature::text as signature,
          arp.release_notes::text as "releaseNotes"
        from public.agent_rollout_intents ari
        inner join public.agent_release_packages arp on arp.id = ari.release_package_id
        where ari.device_id = $1::uuid
          and ari.is_active = true
        order by ari.created_at desc
        limit 1
      `,
      [session.device.id],
    );

    const intent = rows[0];

    return {
      generatedAt: new Date().toISOString(),
      intent: intent
        ? {
            rolloutId: intent.rolloutId,
            action: intent.action,
            rolloutChannel: intent.rolloutChannel,
            targetVersion: intent.targetVersion,
            package: {
              packageType: intent.packageType,
              packageUrl: intent.packageUrl,
              sha256: intent.sha256,
              signature: intent.signature,
              releaseNotes: intent.releaseNotes,
            },
            mandatory: intent.mandatory,
            deadlineAt: intent.deadlineAt,
            notes: intent.notes,
            createdAt: intent.createdAt,
          }
        : null,
    };
  }

  async reportRolloutStatus(sessionToken: string, input: RolloutStatusInput) {
    const session = await this.requireSession(sessionToken, { renew: true });
    this.ensureIsoDate(input.occurredAt, "occurredAt");

    const rollout = await this.requireOwnedRolloutIntent(session, input.rolloutId);
    await this.database.query(
      `
        insert into public.agent_rollout_status_events (
          rollout_intent_id,
          device_id,
          state,
          installed_version,
          target_version,
          updater_version,
          startup_registered,
          error_code,
          error_message,
          occurred_at,
          metadata_json
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::timestamptz,
          $11::jsonb
        )
      `,
      [
        rollout.rolloutId,
        rollout.deviceId,
        input.state,
        input.installedVersion ?? null,
        input.targetVersion ?? null,
        input.updaterVersion ?? null,
        input.startupRegistered ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.occurredAt,
        JSON.stringify(input.metadataJson ?? {}),
      ],
    );

    this.logger.info("agent.rollout.status_recorded", {
      rolloutId: input.rolloutId,
      deviceId: rollout.deviceId,
      state: input.state,
      hasErrorCode: Boolean(input.errorCode),
      hasMetadata: Boolean(input.metadataJson && Object.keys(input.metadataJson).length > 0),
    });
  }

  async reportDisplayed(sessionToken: string, messageId: string, input: LifecycleEventInput) {
    const session = await this.requireSession(sessionToken, { renew: true });
    this.requireMessageId(messageId);
    this.ensureIsoDate(input.occurredAt, "occurredAt");
    await this.sessionStore.updateSessionActiveUser(sessionToken, input.activeUserIdentifier ?? null);
    await this.recordLifecycleEvent(session, messageId, input, "Displayed");

    this.logger.info("agent.message.displayed", {
      messageId,
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });
  }

  async reportRead(sessionToken: string, messageId: string, input: LifecycleEventInput) {
    const session = await this.requireSession(sessionToken, { renew: true });
    this.requireMessageId(messageId);
    this.ensureIsoDate(input.occurredAt, "occurredAt");
    await this.sessionStore.updateSessionActiveUser(sessionToken, input.activeUserIdentifier ?? null);
    await this.recordLifecycleEvent(session, messageId, input, "Read");

    this.logger.info("agent.message.read", {
      messageId,
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });
  }

  async submitResponse(
    sessionToken: string,
    messageId: string,
    input: MessageResponseInput,
    auditContext: AgentAuditContext = {},
  ) {
    const session = await this.requireSession(sessionToken, { renew: true });
    this.requireMessageId(messageId);
    if (input.occurredAt) {
      this.ensureOptionalIsoDate(input.occurredAt, "occurredAt");
    }
    await this.sessionStore.updateSessionActiveUser(sessionToken, input.activeUserIdentifier ?? null);

    const respondedAt = input.occurredAt ?? new Date().toISOString();
    const message = await this.requireOwnedMessage(session, messageId);
    if (!message.requiresResponse) {
      throw new AppError({
        statusCode: 409,
        code: "RESPONSE_NOT_REQUIRED",
        message: "This Windows Agent message does not require a response.",
      });
    }

    const workflow = parseWorkflowSnapshot(message.workflowSnapshot);
    if (!workflow) {
      throw new AppError({
        statusCode: 409,
        code: "WORKFLOW_NOT_AVAILABLE",
        message: "The response workflow snapshot is not available for this message.",
      });
    }

    validateWorkflowResponse(workflow, input);
    const existingResponse = await this.findExistingResponse(message.messageId);
    if (existingResponse) {
      return serializeRecipientResponse(
        existingResponse.id,
        message.communicationRecipientId,
        input.responseOptionKey,
        readResponseNote(existingResponse.eventPayload),
        readActorUserIdentifier(existingResponse.eventPayload),
        existingResponse.occurredAt,
      );
    }

    const responseEvent = await this.database.withTransaction(async (transaction) => {
      const event = await insertDeliveryEvent(transaction, {
        deliveryJobId: message.messageId,
        eventType: "Responded",
        occurredAt: respondedAt,
        payload: {
          responseOptionKey: input.responseOptionKey,
          responseNote: input.responseNote ?? null,
          activeUserIdentifier: input.activeUserIdentifier ?? null,
        },
      });
      await updateDeliveryAttemptStatus(transaction, message.messageId, "Responded", respondedAt, {
        source: "WindowsAgentResponse",
        responseOptionKey: input.responseOptionKey,
        responseNote: input.responseNote ?? null,
        activeUserIdentifier: input.activeUserIdentifier ?? null,
      });
      await advanceDeliveryJobStatus(transaction, message.messageId, "Responded", respondedAt);
      await transaction.query(
        `
          update public.communication_recipients
          set
            response_state = 'Responded',
            ack_state = case when $2 then 'Acknowledged' else ack_state end
          where id::text = $1
        `,
        [message.communicationRecipientId, workflow.responseImpliesAck],
      );
      await this.auditLogService.record(transaction, {
        actorUserId: input.activeUserIdentifier ?? null,
        actorUsername: input.activeUserIdentifier ?? session.device.deviceIdentifier ?? "windows-agent",
        actionType: "RecordResponse",
        moduleName: "Communications",
        entityType: "CommunicationRecipient",
        entityId: message.communicationRecipientId,
        description: `Recorded workflow response "${input.responseOptionKey}" for communication ${message.communicationId} recipient ${message.communicationRecipientId}.`,
        ipAddress: auditContext.ipAddress ?? null,
        metadata: {
          communicationId: message.communicationId,
          deliveryJobId: message.messageId,
          responseOptionKey: input.responseOptionKey,
          responseImpliesAck: workflow.responseImpliesAck,
          hasResponseNote: Boolean(input.responseNote),
          activeUserIdentifier: input.activeUserIdentifier ?? null,
        },
        createdAt: respondedAt,
      });
      await this.auditLogService.record(transaction, {
        actorUserId: input.activeUserIdentifier ?? null,
        actorUsername: input.activeUserIdentifier ?? session.device.deviceIdentifier ?? "windows-agent",
        actionType: "RecipientResponseStateChanged",
        moduleName: "Communications",
        entityType: "CommunicationRecipient",
        entityId: message.communicationRecipientId,
        description: `Communication ${message.communicationId} recipient ${message.communicationRecipientId} response state changed from AwaitingResponse to Responded.`,
        ipAddress: auditContext.ipAddress ?? null,
        metadata: {
          communicationId: message.communicationId,
          deliveryJobId: message.messageId,
          previousResponseState: "AwaitingResponse",
          nextResponseState: "Responded",
          responseOptionKey: input.responseOptionKey,
          ackStateChanged: workflow.responseImpliesAck,
        },
        createdAt: respondedAt,
      });
      return event;
    });

    this.logger.info("agent.message.response_recorded", {
      messageId,
      responseOptionKey: input.responseOptionKey,
      hasResponseNote: Boolean(input.responseNote),
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });

    return serializeRecipientResponse(
      responseEvent.id,
      message.communicationRecipientId,
      input.responseOptionKey,
      input.responseNote ?? null,
      input.activeUserIdentifier ?? null,
      respondedAt,
    );
  }

  async reportReminderEvent(sessionToken: string, policyId: string, input: ReminderEventInput) {
    const session = await this.requireSession(sessionToken, { renew: true });
    await this.sessionStore.updateSessionActiveUser(sessionToken, input.activeUserIdentifier ?? null);
    if (!policyId.trim()) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "policyId is required.",
      });
    }

    this.ensureIsoDate(input.occurredAt, "occurredAt");
    assertReminderEventType(input.eventType);
    const policy = await this.requireOwnedReminderPolicy(session, policyId);

    await this.database.query(
      `
        insert into public.agent_reminder_events (
          agent_reminder_policy_id,
          device_id,
          event_type,
          occurred_at,
          active_user_identifier,
          metadata_json
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4::timestamptz,
          $5,
          $6::jsonb
        )
        on conflict (
          agent_reminder_policy_id,
          device_id,
          event_type,
          occurred_at
        ) do nothing
      `,
      [
        policy.policyId,
        session.device.id,
        input.eventType,
        input.occurredAt,
        input.activeUserIdentifier ?? null,
        JSON.stringify(input.metadata ?? null),
      ],
    );

    this.logger.info("agent.reminder.event_recorded", {
      policyId,
      eventType: input.eventType,
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
      hasMetadata: Boolean(input.metadata),
    });
  }

  async getOperationalDiagnostics() {
    const deviceStatusSql = this.deviceStatusSql;
    const [realtimeRows, deviceStatusRows] = await Promise.all([
      this.database.query<{
        connectedCount: number;
        staleConnectedCount: number;
      }>(
        `
          select
            count(*) filter (where status = 'Connected')::int as "connectedCount",
            count(*) filter (
              where status = 'Connected'
                and coalesce(last_seen_at, connected_at) < now() - interval '2 minutes'
            )::int as "staleConnectedCount"
          from public.device_realtime_connections
        `,
      ),
      this.database.query<{
        onlineCount: number;
        staleCount: number;
        offlineCount: number;
      }>(
        `
          select
            count(*) filter (where ${deviceStatusSql} = 'Online')::int as "onlineCount",
            count(*) filter (where ${deviceStatusSql} = 'Stale')::int as "staleCount",
            count(*) filter (where ${deviceStatusSql} = 'Offline')::int as "offlineCount"
          from public.devices d
        `,
      ),
    ]);

    return {
      realtimeHub: {
        inMemoryActiveStreams: this.realtimeConnections.size,
        persistedConnectedCount: realtimeRows[0]?.connectedCount ?? 0,
        stalePersistedConnectedCount: realtimeRows[0]?.staleConnectedCount ?? 0,
      },
      devices: {
        onlineCount: deviceStatusRows[0]?.onlineCount ?? 0,
        staleCount: deviceStatusRows[0]?.staleCount ?? 0,
        offlineCount: deviceStatusRows[0]?.offlineCount ?? 0,
      },
    };
  }

  async revokeDeviceAccess(
    deviceId: string,
    actor: { userIdentifier: string; username: string; ipAddress?: string | null },
  ) {
    const device = await this.requireDeviceById(deviceId);
    const activeConnection = this.findConnectionForDevice(deviceId);
    if (activeConnection) {
      this.writeRealtimeEvent(activeConnection.response, "session.revoked", {
        deviceId,
        revokedAt: new Date().toISOString(),
      });
      activeConnection.response.end();
      clearInterval(activeConnection.keepAliveTimer);
      this.realtimeConnections.delete(activeConnection.connectionId);
    }

    const revokedAt = new Date().toISOString();
    const [revokedSessionCount, disconnectedConnectionRows] = await Promise.all([
      this.sessionStore.revokeDeviceSessions(deviceId),
      this.database.query<{ id: string }>(
        `
          update public.device_realtime_connections
          set
            status = 'Disconnected',
            disconnected_at = coalesce(disconnected_at, $2::timestamptz),
            last_seen_at = coalesce(last_seen_at, $2::timestamptz)
          where device_id = $1::uuid
            and status = 'Connected'
          returning id::text as id
        `,
        [deviceId, revokedAt],
      ),
    ]);

    await this.database.query(
      `
        update public.devices
        set
          status = 'Offline',
          updated_at = now()
        where id::text = $1
      `,
      [deviceId],
    );

    await this.auditLogService.recordNow({
      actorUserId: actor.userIdentifier,
      actorUsername: actor.username,
      actionType: "RevokeDeviceSession",
      moduleName: "Devices",
      entityType: "Device",
      entityId: deviceId,
      description: `Revoked active access for device ${device.deviceIdentifier ?? device.hostname}.`,
      ipAddress: actor.ipAddress ?? null,
      metadata: {
        deviceIdentifier: device.deviceIdentifier,
        hostname: device.hostname,
        revokedSessionCount,
        disconnectedRealtimeConnectionCount: disconnectedConnectionRows.length,
      },
      createdAt: revokedAt,
    });

    return {
      deviceId,
      deviceIdentifier: device.deviceIdentifier,
      revokedSessionCount,
      disconnectedRealtimeConnectionCount: disconnectedConnectionRows.length,
      resultingStatus: "Offline" as const,
      revokedAt,
    };
  }

  private async requireSession(sessionToken: string, options?: { renew?: boolean }) {
    const session = options?.renew
      ? await this.sessionStore.renewSession(sessionToken)
      : await this.sessionStore.getSession(sessionToken);
    if (!session) {
      throw new AppError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "A valid agent session is required.",
      });
    }

    return session;
  }

  private async recordLifecycleEvent(
    session: AgentSession,
    messageId: string,
    input: LifecycleEventInput,
    eventType: "Displayed" | "Read",
  ) {
    const message = await this.requireOwnedMessage(session, messageId);
    if (message.jobStatus === "Failed") {
      throw new AppError({
        statusCode: 409,
        code: "MESSAGE_NOT_ACTIVE",
        message: "The Windows Agent message is no longer active.",
      });
    }

    const existingEvent = await this.findExistingLifecycleEvent(messageId, eventType);
    if (existingEvent) {
      return;
    }

    await this.database.withTransaction(async (transaction) => {
      await insertDeliveryEvent(transaction, {
        deliveryJobId: messageId,
        eventType,
        occurredAt: input.occurredAt,
        payload: {
          activeUserIdentifier: input.activeUserIdentifier ?? null,
        },
      });
      await updateDeliveryAttemptStatus(transaction, messageId, eventType, input.occurredAt, {
        source: "WindowsAgentLifecycle",
        activeUserIdentifier: input.activeUserIdentifier ?? null,
      });
      await advanceDeliveryJobStatus(transaction, messageId, eventType, input.occurredAt);
    });
  }

  private async requireOwnedMessage(session: AgentSession, messageId: string) {
    const rows = await this.database.query<OwnedAgentMessageRow>(
      `
        select
          dj.id::text as "messageId",
          cr.id::text as "communicationRecipientId",
          c.id::text as "communicationId",
          c.title::text as title,
          c.body::text as body,
          c.priority::text as priority,
          c.windows_agent_presentation::text as "windowsAgentPresentation",
          c.toast_auto_dismiss_seconds as "toastAutoDismissSeconds",
          c.requires_response as "requiresResponse",
          cr.template_version_snapshot as "templateVersion",
          cr.workflow_snapshot_json as "workflowSnapshot",
          dj.template_policy_snapshot_json as "templatePolicySnapshot",
          dj.job_status::text as "jobStatus",
          cr.response_state::text as "responseState",
          cr.ack_state::text as "ackState"
        from public.delivery_jobs dj
        inner join public.communication_recipients cr on cr.id = dj.communication_recipient_id
        inner join public.communications c on c.id = dj.communication_id
        where dj.id::text = $1
          and dj.channel = 'WindowsAgent'
          and cr.device_id = $2::uuid
        limit 1
      `,
      [messageId, session.device.id],
    );

    const message = rows[0];
    if (!message) {
      throw new AppError({
        statusCode: 404,
        code: "MESSAGE_NOT_FOUND",
        message: "The Windows Agent message was not found for this device.",
      });
    }

    return message;
  }

  private async findExistingLifecycleEvent(messageId: string, eventType: "Displayed" | "Read") {
    const rows = await this.database.query<DeliveryEventRow>(
      `
        select
          id::text as id,
          occurred_at::text as "occurredAt",
          event_payload_json as "eventPayload"
        from public.delivery_events
        where delivery_job_id::text = $1
          and event_type = $2
        order by occurred_at asc
        limit 1
      `,
      [messageId, eventType],
    );

    return rows[0];
  }

  private async findExistingResponse(messageId: string) {
    const rows = await this.database.query<DeliveryEventRow>(
      `
        select
          id::text as id,
          occurred_at::text as "occurredAt",
          event_payload_json as "eventPayload"
        from public.delivery_events
        where delivery_job_id::text = $1
          and event_type = 'Responded'
        order by occurred_at asc
        limit 1
      `,
      [messageId],
    );

    return rows[0];
  }

  private async requireOwnedReminderPolicy(session: AgentSession, policyId: string) {
    const rows = await this.database.query<OwnedReminderPolicyRow>(
      `
        select
          arp.id::text as "policyId",
          arp.device_id::text as "deviceId",
          arp.communication_id::text as "communicationId",
          arp.is_active as "isActive",
          arp.valid_until::text as "validUntil"
        from public.agent_reminder_policies arp
        where arp.id::text = $1
          and arp.device_id = $2::uuid
        limit 1
      `,
      [policyId, session.device.id],
    );

    const policy = rows[0];
    if (!policy) {
      throw new AppError({
        statusCode: 404,
        code: "REMINDER_POLICY_NOT_FOUND",
        message: "The reminder policy was not found for this device.",
      });
    }

    if (!policy.isActive || isExpiredReminderPolicy(policy.validUntil)) {
      throw new AppError({
        statusCode: 409,
        code: "REMINDER_POLICY_INACTIVE",
        message: "The reminder policy is no longer active for this device.",
      });
    }

    return policy;
  }

  private async requireOwnedRolloutIntent(session: AgentSession, rolloutId: string) {
    const rows = await this.database.query<AgentOwnedRolloutIntentRow>(
      `
        select
          ari.id::text as "rolloutId",
          ari.device_id::text as "deviceId"
        from public.agent_rollout_intents ari
        where ari.id::text = $1
          and ari.device_id = $2::uuid
          and ari.is_active = true
        limit 1
      `,
      [rolloutId, session.device.id],
    );

    const rollout = rows[0];
    if (!rollout) {
      throw new AppError({
        statusCode: 404,
        code: "ROLLOUT_NOT_FOUND",
        message: "The rollout intent was not found for this device.",
      });
    }

    return rollout;
  }

  private registerRealtimeStream(options: {
    connectionId: string;
    deviceId: string;
    sessionToken: string;
    request: IncomingMessage;
    response: ServerResponse;
  }) {
    const existingConnection = this.realtimeConnections.get(options.connectionId);
    if (existingConnection) {
      clearInterval(existingConnection.keepAliveTimer);
      existingConnection.response.end();
      this.realtimeConnections.delete(options.connectionId);
    }

    options.response.statusCode = 200;
    options.response.setHeader("content-type", "text/event-stream; charset=utf-8");
    options.response.setHeader("cache-control", "no-cache, no-transform");
    options.response.setHeader("connection", "keep-alive");
    options.response.setHeader("x-accel-buffering", "no");
    options.response.flushHeaders?.();
    options.response.write(": connected\n\n");

    const keepAliveTimer = setInterval(() => {
      if (options.response.writableEnded) {
        return;
      }

      options.response.write(`: keepalive ${Date.now()}\n\n`);
      void this.touchRealtimeConnection(options.deviceId, options.connectionId);
    }, 15000);

    this.realtimeConnections.set(options.connectionId, {
      connectionId: options.connectionId,
      deviceId: options.deviceId,
      sessionToken: options.sessionToken,
      response: options.response,
      keepAliveTimer,
    });

    const closeConnection = () => {
      const activeConnection = this.realtimeConnections.get(options.connectionId);
      if (!activeConnection) {
        return;
      }

      clearInterval(activeConnection.keepAliveTimer);
      this.realtimeConnections.delete(options.connectionId);
      void this.markRealtimeConnectionClosed(options.deviceId, options.connectionId);
    };

    options.request.on("close", closeConnection);
    options.response.on("close", closeConnection);
  }

  private findConnectionForDevice(deviceId: string) {
    for (const connection of this.realtimeConnections.values()) {
      if (connection.deviceId === deviceId && !connection.response.writableEnded) {
        return connection;
      }
    }

    return null;
  }

  private writeRealtimeEvent(
    response: ServerResponse,
    eventName: "connected" | "messages.snapshot" | "messages.available" | "session.revoked",
    payload: unknown,
  ) {
    if (response.writableEnded) {
      return;
    }

    response.write(`event: ${eventName}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  private async listPendingMessagesByDeviceId(
    deviceId: string,
    since?: string | null,
    activeUserIdentifier?: string | null,
  ) {
    await this.responseOverdueService.evaluateRecipientOnlyOverdueForDevice(deviceId);

    if (since) {
      this.ensureOptionalIsoDate(since, "since");
    }

    const params: unknown[] = [deviceId, this.pendingMessageTtlMinutes];
    const sinceClause = since
      ? `and dj.updated_at >= $${params.push(since)}::timestamptz`
      : "";
    const activeUserClause = `and (
      latest_actor.active_user_identifier is null
      or latest_actor.active_user_identifier = $${params.push(activeUserIdentifier ?? null)}
    )`;
    const rows = await this.database.query<AgentMessageRow>(
      `
        select
          dj.id::text as "messageId",
          c.id::text as "communicationId",
          c.title::text as title,
          c.body::text as body,
          c.instruction::text as instruction,
          c.priority::text as priority,
          c.windows_agent_presentation::text as "windowsAgentPresentation",
          c.toast_auto_dismiss_seconds as "toastAutoDismissSeconds",
          c.requires_response as "requiresResponse",
          cr.template_version_snapshot as "templateVersion",
          cr.workflow_snapshot_json as "workflowSnapshot",
          dj.template_policy_snapshot_json as "templatePolicySnapshot",
          dj.updated_at::text as "updatedAt"
        from public.delivery_jobs dj
        inner join public.communication_recipients cr on cr.id = dj.communication_recipient_id
        inner join public.communications c on c.id = dj.communication_id
        inner join public.communication_schedules cs on cs.id = dj.communication_schedule_id
        left join lateral (
          select
            (de.event_payload_json ->> 'activeUserIdentifier')::text as active_user_identifier
          from public.delivery_events de
          where de.delivery_job_id = dj.id
            and de.event_type in ('Displayed', 'Read', 'Responded')
          order by de.occurred_at desc, de.created_at desc
          limit 1
        ) latest_actor on true
        where dj.channel = 'WindowsAgent'
          and cr.device_id = $1::uuid
          and dj.job_status in ('Pending', 'Sent', 'Delivered', 'Displayed')
          and cs.is_active = true
          and cs.cancelled_at is null
          and coalesce(
            cs.valid_from,
            cs.scheduled_at,
            c.published_at,
            dj.queued_at,
            dj.created_at
          ) <= now()
          and coalesce(
            cs.valid_until,
            case
              when cs.schedule_type in ('Immediate', 'Scheduled') and $2::int > 0 then
                coalesce(
                  cs.valid_from,
                  cs.scheduled_at,
                  c.published_at,
                  dj.queued_at,
                  dj.created_at
                ) + ($2::int * interval '1 minute')
              else 'infinity'::timestamptz
            end
          ) > now()
          ${activeUserClause}
          ${sinceClause}
        order by coalesce(dj.queued_at, dj.created_at) asc, dj.created_at asc
      `,
      params,
    );

    return {
      items: rows.map((row) => ({
        messageId: row.messageId,
        communicationId: row.communicationId,
        title: row.title,
        body: row.body,
        instruction: row.instruction,
        priority: row.priority,
        windowsAgentPresentation: row.windowsAgentPresentation,
        toastAutoDismissSeconds: row.toastAutoDismissSeconds,
        requiresResponse: row.requiresResponse,
        templateVersion: row.templateVersion,
        workflow: parseWorkflowSnapshot(row.workflowSnapshot),
        criticalBehaviorMode: parseCriticalBehaviorMode(row.templatePolicySnapshot),
      })),
      nextCursor: rows.at(-1)?.updatedAt ?? null,
    };
  }

  private async requireActiveRealtimeConnection(deviceId: string, connectionId: string) {
    const rows = await this.database.query<{ id: string }>(
      `
        select id::text as id
        from public.device_realtime_connections
        where device_id = $1::uuid
          and connection_identifier = $2
          and status = 'Connected'
        limit 1
      `,
      [deviceId, connectionId],
    );

    if (rows[0]) {
      return rows[0];
    }

    throw new AppError({
      statusCode: 404,
      code: "REALTIME_CONNECTION_NOT_FOUND",
      message: "The negotiated realtime connection was not found for this device.",
    });
  }

  private async touchRealtimeConnection(deviceId: string, connectionId: string) {
    await this.database.query(
      `
        update public.device_realtime_connections
        set
          last_seen_at = now(),
          status = 'Connected',
          disconnected_at = null
        where device_id = $1::uuid
          and connection_identifier = $2
      `,
      [deviceId, connectionId],
    );
  }

  private async markRealtimeConnectionClosed(deviceId: string, connectionId: string) {
    await this.database.query(
      `
        update public.device_realtime_connections
        set
          status = 'Disconnected',
          disconnected_at = now(),
          last_seen_at = now()
        where device_id = $1::uuid
          and connection_identifier = $2
      `,
      [deviceId, connectionId],
    );
  }

  private async getWorkflowSnapshotCached(
    cache: Map<string, WorkflowSnapshot | null>,
    workflowId: string,
  ) {
    const cached = cache.get(workflowId);
    if (cached !== undefined) {
      return cached;
    }

    const workflow = await this.getWorkflowSnapshot(workflowId);
    cache.set(workflowId, workflow);
    return workflow;
  }

  private async getWorkflowSnapshot(workflowId: string): Promise<WorkflowSnapshot | null> {
    const rows = await this.database.query<{
      id: string;
      name: string;
      allowFreeText: boolean;
      requireFreeText: boolean;
      escalationTimeoutMinutes: number | null;
      escalationMode: "RecipientOnly" | null;
      responseImpliesAck: boolean;
    }>(
      `
        select
          id::text as id,
          name::text as name,
          allow_free_text as "allowFreeText",
          require_free_text as "requireFreeText",
          escalation_timeout_minutes as "escalationTimeoutMinutes",
          escalation_mode::text as "escalationMode",
          response_implies_ack as "responseImpliesAck"
        from public.response_workflows
        where id::text = $1
        limit 1
      `,
      [workflowId],
    );

    const workflow = rows[0];
    if (!workflow) {
      return null;
    }

    const optionRows = await this.database.query<{ key: string; label: string }>(
      `
        select
          option_key::text as key,
          option_label::text as label
        from public.response_workflow_options
        where workflow_id::text = $1
        order by sort_order asc, created_at asc
      `,
      [workflowId],
    );

    return {
      ...workflow,
      options: optionRows,
    };
  }

  private async ensureSessionOwnsDevice(session: AgentSession, requestedDeviceIdentifier: string) {
    const requestedDevice = await this.requireDeviceByIdentifier(requestedDeviceIdentifier);
    if (requestedDevice.id !== session.device.id) {
      throw new AppError({
        statusCode: 409,
        code: "DEVICE_SESSION_MISMATCH",
        message: "The agent session is bound to a different device identifier.",
      });
    }
  }

  private async resolveDirectorySnapshot(
    activeUserIdentifier?: string | null,
    fallbackEmployeeNumber?: string | null,
  ): Promise<DeviceDirectorySnapshot> {
    const normalizedActiveUserIdentifier = normalizeOptionalText(activeUserIdentifier);
    const normalizedFallbackEmployeeNumber = normalizeOptionalText(fallbackEmployeeNumber);

    if (!normalizedActiveUserIdentifier) {
      return {
        activeUserIdentifier: null,
        userType: "Unknown",
        username: null,
        displayName: null,
        employeeNumber: null,
        department: null,
        title: null,
        mobile: null,
        email: null,
        lookupAt: null,
      };
    }

    const lookupAt = new Date().toISOString();

    try {
      const directoryUser = await this.ldapAuthenticator.lookupUserProfile(normalizedActiveUserIdentifier);
      if (!directoryUser) {
        return {
          activeUserIdentifier: normalizedActiveUserIdentifier,
          userType: "NonEmployee",
          username: normalizedActiveUserIdentifier,
          displayName: null,
          employeeNumber: null,
          department: null,
          title: null,
          mobile: null,
          email: null,
          lookupAt,
        };
      }

      return this.mapDirectoryUserSnapshot(
        normalizedActiveUserIdentifier,
        directoryUser,
        normalizedFallbackEmployeeNumber,
        lookupAt,
      );
    } catch (error) {
      this.logger.warn("agent.directory_lookup.unavailable", {
        activeUserIdentifier: normalizedActiveUserIdentifier,
        error: error instanceof Error ? error.message : "Unknown directory lookup error",
      });

      return {
        activeUserIdentifier: normalizedActiveUserIdentifier,
        userType: "Unknown",
        username: normalizedActiveUserIdentifier,
        displayName: null,
        employeeNumber: normalizedFallbackEmployeeNumber,
        department: null,
        title: null,
        mobile: null,
        email: null,
        lookupAt,
      };
    }
  }

  private mapDirectoryUserSnapshot(
    activeUserIdentifier: string,
    directoryUser: DirectoryUserProfile,
    fallbackEmployeeNumber: string | null,
    lookupAt: string,
  ): DeviceDirectorySnapshot {
    return {
      activeUserIdentifier,
      userType: "Employee",
      username: directoryUser.username,
      displayName: directoryUser.fullName,
      employeeNumber: directoryUser.employeeNumber ?? fallbackEmployeeNumber,
      department: directoryUser.department,
      title: directoryUser.title,
      mobile: directoryUser.mobile,
      email: directoryUser.email,
      lookupAt,
    };
  }

  private async requireKnownDevice(options: {
    deviceIdentifier: string;
    hostname: string | null;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.deviceIdentifier.trim()) {
      params.push(options.deviceIdentifier.trim());
      conditions.push(`d.device_identifier::text = $${params.length}`);
    }

    if (options.hostname?.trim()) {
      params.push(options.hostname.trim());
      conditions.push(`d.hostname::text = $${params.length}`);
    }

    if (conditions.length === 0) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "deviceIdentifier or hostname is required.",
      });
    }

    const rows = await this.database.query<DeviceRecord>(
      `
        select
          d.id::text as id,
          d.device_identifier::text as "deviceIdentifier",
          d.hostname::text as hostname,
          d.site_id::text as "siteId",
          d.area_id::text as "areaId",
          d.location_label::text as "locationLabel",
          d.ownership_mode::text as "ownershipMode",
          d.agent_version::text as "agentVersion",
          d.last_heartbeat_at::text as "lastHeartbeatAt",
          d.last_connection_at::text as "lastConnectionAt",
          d.status::text as status,
          s.name::text as "siteName",
          a.name::text as "areaName",
          dept.id::text as "departmentId",
          dept.name::text as "departmentName",
          sec.id::text as "sectionId",
          sec.name::text as "sectionName",
          d.last_active_user_identifier::text as "lastActiveUserIdentifier",
          d.last_directory_user_type::text as "lastDirectoryUserType",
          d.last_directory_username::text as "lastDirectoryUsername",
          d.last_directory_display_name::text as "lastDirectoryDisplayName",
          d.last_directory_employee_number::text as "lastDirectoryEmployeeNumber",
          d.last_directory_department::text as "lastDirectoryDepartment",
          d.last_directory_title::text as "lastDirectoryTitle",
          d.last_directory_mobile::text as "lastDirectoryMobile",
          d.last_directory_email::text as "lastDirectoryEmail",
          d.last_directory_lookup_at::text as "lastDirectoryLookupAt"
        from public.devices d
        inner join public.sites s on s.id = d.site_id
        left join public.areas a on a.id = d.area_id
        left join public.employees e on e.id = d.primary_employee_id
        left join public.departments dept on dept.id = e.department_id
        left join public.sections sec on sec.id = e.section_id
        where ${conditions.join(" or ")}
        order by d.updated_at desc
        limit 1
      `,
      params,
    );

    const device = rows[0];
    if (!device) {
      throw new AppError({
        statusCode: 409,
        code: "DEVICE_NOT_REGISTERED",
        message:
          "The Windows Agent device is not registered in the server-side devices baseline yet.",
      });
    }

    return device;
  }

  private async requireDeviceByIdentifier(deviceIdentifier: string) {
    const trimmedIdentifier = deviceIdentifier.trim();
    if (!trimmedIdentifier) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "deviceIdentifier is required.",
      });
    }

    const rows = await this.database.query<DeviceRecord>(
      `
        select
          d.id::text as id,
          d.device_identifier::text as "deviceIdentifier",
          d.hostname::text as hostname,
          d.site_id::text as "siteId",
          d.area_id::text as "areaId",
          d.location_label::text as "locationLabel",
          d.ownership_mode::text as "ownershipMode",
          d.agent_version::text as "agentVersion",
          d.last_heartbeat_at::text as "lastHeartbeatAt",
          d.last_connection_at::text as "lastConnectionAt",
          d.status::text as status,
          s.name::text as "siteName",
          a.name::text as "areaName",
          dept.id::text as "departmentId",
          dept.name::text as "departmentName",
          sec.id::text as "sectionId",
          sec.name::text as "sectionName",
          d.last_active_user_identifier::text as "lastActiveUserIdentifier",
          d.last_directory_user_type::text as "lastDirectoryUserType",
          d.last_directory_username::text as "lastDirectoryUsername",
          d.last_directory_display_name::text as "lastDirectoryDisplayName",
          d.last_directory_employee_number::text as "lastDirectoryEmployeeNumber",
          d.last_directory_department::text as "lastDirectoryDepartment",
          d.last_directory_title::text as "lastDirectoryTitle",
          d.last_directory_mobile::text as "lastDirectoryMobile",
          d.last_directory_email::text as "lastDirectoryEmail",
          d.last_directory_lookup_at::text as "lastDirectoryLookupAt"
        from public.devices d
        inner join public.sites s on s.id = d.site_id
        left join public.areas a on a.id = d.area_id
        left join public.employees e on e.id = d.primary_employee_id
        left join public.departments dept on dept.id = e.department_id
        left join public.sections sec on sec.id = e.section_id
        where d.device_identifier::text = $1
        limit 1
      `,
      [trimmedIdentifier],
    );

    const device = rows[0];
    if (!device) {
      throw new AppError({
        statusCode: 409,
        code: "DEVICE_NOT_REGISTERED",
        message:
          "The Windows Agent device is not registered in the server-side devices baseline yet.",
      });
    }

    return device;
  }

  private async requireDeviceById(deviceId: string) {
    const rows = await this.database.query<DeviceRecord>(
      `
        select
          d.id::text as id,
          d.device_identifier::text as "deviceIdentifier",
          d.hostname::text as hostname,
          d.site_id::text as "siteId",
          d.area_id::text as "areaId",
          d.location_label::text as "locationLabel",
          d.ownership_mode::text as "ownershipMode",
          d.agent_version::text as "agentVersion",
          d.last_heartbeat_at::text as "lastHeartbeatAt",
          d.last_connection_at::text as "lastConnectionAt",
          d.status::text as status,
          s.name::text as "siteName",
          a.name::text as "areaName",
          dept.id::text as "departmentId",
          dept.name::text as "departmentName",
          sec.id::text as "sectionId",
          sec.name::text as "sectionName",
          d.last_active_user_identifier::text as "lastActiveUserIdentifier",
          d.last_directory_user_type::text as "lastDirectoryUserType",
          d.last_directory_username::text as "lastDirectoryUsername",
          d.last_directory_display_name::text as "lastDirectoryDisplayName",
          d.last_directory_employee_number::text as "lastDirectoryEmployeeNumber",
          d.last_directory_department::text as "lastDirectoryDepartment",
          d.last_directory_title::text as "lastDirectoryTitle",
          d.last_directory_mobile::text as "lastDirectoryMobile",
          d.last_directory_email::text as "lastDirectoryEmail",
          d.last_directory_lookup_at::text as "lastDirectoryLookupAt"
        from public.devices d
        inner join public.sites s on s.id = d.site_id
        left join public.areas a on a.id = d.area_id
        left join public.employees e on e.id = d.primary_employee_id
        left join public.departments dept on dept.id = e.department_id
        left join public.sections sec on sec.id = e.section_id
        where d.id::text = $1
        limit 1
      `,
      [deviceId],
    );

    const device = rows[0];
    if (!device) {
      throw new AppError({
        statusCode: 404,
        code: "DEVICE_NOT_FOUND",
        message: "The registered device could not be reloaded from the database.",
      });
    }

    return device;
  }

  private requireMessageId(messageId: string) {
    if (!messageId.trim()) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "messageId is required.",
      });
    }
  }

  private ensureIsoDate(value: string, fieldName: string) {
    if (Number.isNaN(Date.parse(value))) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: `${fieldName} must be a valid ISO-8601 date-time string.`,
      });
    }
  }

  private ensureOptionalIsoDate(value: string | null | undefined, fieldName: string) {
    if (!value) {
      return;
    }

    this.ensureIsoDate(value, fieldName);
  }

  private buildRealtimeUrl(
    connectionId: string,
    deviceIdentifier: string,
    requestBaseUrl?: string,
  ) {
    const configuredBaseUrl = normalizeBaseUrl(this.env.BACKEND_PUBLIC_BASE_URL);
    const resolvedRequestBaseUrl = normalizeBaseUrl(requestBaseUrl);
    const baseUrl = selectRealtimeBaseUrl({
      configuredBaseUrl,
      requestBaseUrl: resolvedRequestBaseUrl,
      backendPort: this.env.BACKEND_PORT,
    });
    const url = new URL(`${baseUrl}/agent/realtime-hub`);
    url.searchParams.set("connectionId", connectionId);
    url.searchParams.set("deviceIdentifier", deviceIdentifier);
    return url.toString();
  }

  private serializeDevice(device: DeviceRecord) {
    return {
      id: device.id,
      deviceIdentifier: device.deviceIdentifier,
      deviceName: device.hostname,
      hostname: device.hostname,
      siteId: device.siteId,
      siteName: device.siteName,
      areaId: device.areaId,
      areaName: device.areaName,
      departmentId: device.departmentId,
      departmentName: device.departmentName,
      sectionId: device.sectionId,
      sectionName: device.sectionName,
      locationLabel: device.locationLabel,
      ownershipMode: device.ownershipMode,
      status: device.status,
      lastHeartbeatAt: device.lastHeartbeatAt,
    };
  }
}

function selectRealtimeBaseUrl(options: {
  configuredBaseUrl?: string;
  requestBaseUrl?: string;
  backendPort: number;
}) {
  const fallbackBaseUrl = `http://localhost:${options.backendPort}`;

  if (options.configuredBaseUrl) {
    if (
      options.requestBaseUrl &&
      isLoopbackBaseUrl(options.configuredBaseUrl) &&
      !isLoopbackBaseUrl(options.requestBaseUrl)
    ) {
      return options.requestBaseUrl;
    }

    return options.configuredBaseUrl;
  }

  return options.requestBaseUrl ?? fallbackBaseUrl;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeBaseUrl(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  return value.replace(/\/+$/, "");
}

function isLoopbackBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

async function insertDeliveryEvent(
  transaction: TransactionClient,
  options: {
    deliveryJobId: string;
    eventType: "Displayed" | "Read" | "Responded";
    occurredAt: string;
    payload: Record<string, unknown>;
  },
) {
  const rows = await transaction.query<{ id: string }>(
    `
      insert into public.delivery_events (
        delivery_job_id,
        event_type,
        event_source,
        event_payload_json,
        occurred_at
      )
      values (
        $1::uuid,
        $2,
        'Agent',
        $3::jsonb,
        $4::timestamptz
      )
      returning id::text as id
    `,
    [options.deliveryJobId, options.eventType, JSON.stringify(options.payload), options.occurredAt],
  );

  const eventId = rows[0]?.id;
  if (!eventId) {
    throw new AppError({
      statusCode: 500,
      code: "DELIVERY_EVENT_CREATE_FAILED",
      message: "The delivery lifecycle event could not be recorded.",
    });
  }

  return { id: eventId };
}

async function updateDeliveryAttemptStatus(
  transaction: TransactionClient,
  deliveryJobId: string,
  attemptStatus: "Displayed" | "Read" | "Responded",
  occurredAt: string,
  payload: Record<string, unknown>,
) {
  await transaction.query(
    `
      update public.delivery_attempts
      set
        attempt_status = $2,
        attempted_at = $3::timestamptz,
        response_payload_json = $4::jsonb
      where id = (
        select id
        from public.delivery_attempts
        where delivery_job_id = $1::uuid
        order by attempt_number desc
        limit 1
      )
    `,
    [deliveryJobId, attemptStatus, occurredAt, JSON.stringify(payload)],
  );
}

async function advanceDeliveryJobStatus(
  transaction: TransactionClient,
  deliveryJobId: string,
  nextStatus: "Displayed" | "Read" | "Responded",
  occurredAt: string,
) {
  const statusRank = deliveryStatusRank(nextStatus);
  await transaction.query(
    `
      update public.delivery_jobs
      set
        job_status = case
          when $2::int > case job_status
            when 'Pending' then 0
            when 'Sent' then 1
            when 'Delivered' then 2
            when 'Displayed' then 3
            when 'Read' then 4
            when 'Responded' then 5
            else 99
          end then $3
          else job_status
        end,
        started_at = coalesce(started_at, $4::timestamptz),
        completed_at = case
          when $3 in ('Read', 'Responded') then coalesce(completed_at, $4::timestamptz)
          else completed_at
        end
      where id::text = $1
    `,
    [deliveryJobId, statusRank, nextStatus, occurredAt],
  );
}

function deliveryStatusRank(status: "Displayed" | "Read" | "Responded") {
  switch (status) {
    case "Displayed":
      return 3;
    case "Read":
      return 4;
    case "Responded":
      return 5;
  }
}

function parseWorkflowSnapshot(value: unknown): WorkflowSnapshot | null {
  const parsed = parseJsonObject<Partial<WorkflowSnapshot>>(value);
  if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string") {
    return null;
  }

  return {
    id: parsed.id,
    name: parsed.name,
    allowFreeText: parsed.allowFreeText ?? false,
    requireFreeText: parsed.requireFreeText ?? false,
    escalationTimeoutMinutes:
      typeof parsed.escalationTimeoutMinutes === "number" ? parsed.escalationTimeoutMinutes : null,
    escalationMode: parsed.escalationMode === "RecipientOnly" ? "RecipientOnly" : null,
    responseImpliesAck: parsed.responseImpliesAck ?? false,
    options: Array.isArray(parsed.options)
      ? parsed.options
          .filter(
            (option): option is { key: string; label: string } =>
              typeof option === "object" &&
              option !== null &&
              typeof option.key === "string" &&
              typeof option.label === "string",
          )
          .map((option) => ({
            key: option.key,
            label: option.label,
          }))
      : [],
  };
}

function assertReminderEventType(eventType: string): asserts eventType is ReminderEventType {
  if (
    eventType === "Triggered" ||
    eventType === "Displayed" ||
    eventType === "Read" ||
    eventType === "Dismissed" ||
    eventType === "Snoozed" ||
    eventType === "Responded" ||
    eventType === "Started" ||
    eventType === "StepAdvanced" ||
    eventType === "Completed" ||
    eventType === "TimedOut"
  ) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "VALIDATION_ERROR",
    message: "eventType is not supported for reminder policy reporting.",
  });
}

function parseCriticalBehaviorMode(value: unknown) {
  const parsed = parseJsonObject<{ criticalBehaviorMode?: string | null }>(value);
  const criticalBehaviorMode = parsed?.criticalBehaviorMode;
  return criticalBehaviorMode === "FullScreenPersistent" ||
    criticalBehaviorMode === "PersistentBanner" ||
    criticalBehaviorMode === "Standard"
    ? criticalBehaviorMode
    : null;
}

function parseWellnessProgramPayload(value: unknown): WellnessProgramPayload | null {
  const parsed = parseJsonObject<Partial<WellnessProgramPayload>>(value);
  if (
    !parsed ||
    (parsed.programType !== "SimpleReminder" && parsed.programType !== "GuidedRoutine") ||
    (parsed.theme !== "Blue" && parsed.theme !== "Green") ||
    (parsed.layoutVariant !== "ReminderCard" &&
      parsed.layoutVariant !== "CountdownCard" &&
      parsed.layoutVariant !== "GuidedRoutine" &&
      parsed.layoutVariant !== "CompletionCard" &&
      parsed.layoutVariant !== "OverviewCard") ||
    !Array.isArray(parsed.actions)
  ) {
    return null;
  }

  return {
    programType: parsed.programType,
    theme: parsed.theme,
    layoutVariant: parsed.layoutVariant,
    heroAssetUrl: typeof parsed.heroAssetUrl === "string" ? parsed.heroAssetUrl : null,
    countdownSeconds: typeof parsed.countdownSeconds === "number" ? parsed.countdownSeconds : null,
    rotationMode:
      parsed.rotationMode === "Fixed" ||
      parsed.rotationMode === "Sequential" ||
      parsed.rotationMode === "Random"
        ? parsed.rotationMode
        : null,
    actions: parsed.actions
      .filter(
        (action): action is WellnessProgramPayload["actions"][number] =>
          typeof action === "object" &&
          action !== null &&
          typeof action.actionKey === "string" &&
          typeof action.label === "string" &&
          (action.kind === "GotIt" ||
            action.kind === "Done" ||
            action.kind === "Start" ||
            action.kind === "Next" ||
            action.kind === "Close" ||
            action.kind === "RemindMeLater"),
      )
      .map((action) => ({
        actionKey: action.actionKey,
        kind: action.kind,
        label: action.label,
        style:
          action.style === "Primary" || action.style === "Secondary" || action.style === "Ghost"
            ? action.style
            : null,
        snoozeMinutes: typeof action.snoozeMinutes === "number" ? action.snoozeMinutes : null,
      })),
    steps: Array.isArray(parsed.steps)
      ? parsed.steps
          .filter(
            (step): step is WellnessProgramPayload["steps"][number] =>
              typeof step === "object" &&
              step !== null &&
              typeof step.stepKey === "string" &&
              typeof step.title === "string" &&
              typeof step.sortOrder === "number",
          )
          .map((step) => ({
            stepKey: step.stepKey,
            title: step.title,
            description: typeof step.description === "string" ? step.description : null,
            assetUrl: typeof step.assetUrl === "string" ? step.assetUrl : null,
            durationSeconds: typeof step.durationSeconds === "number" ? step.durationSeconds : null,
            sortOrder: step.sortOrder,
          }))
      : [],
    localizations: Array.isArray(parsed.localizations)
      ? parsed.localizations
          .filter(
            (localization): localization is WellnessProgramPayload["localizations"][number] =>
              typeof localization === "object" &&
              localization !== null &&
              typeof localization.locale === "string",
          )
          .map((localization) => ({
            locale: localization.locale,
            title: typeof localization.title === "string" ? localization.title : null,
            body: typeof localization.body === "string" ? localization.body : null,
            instruction:
              typeof localization.instruction === "string" ? localization.instruction : null,
          }))
      : [],
  };
}

function parseJsonObject<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value as T;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function validateWorkflowResponse(workflow: WorkflowSnapshot, input: MessageResponseInput) {
  const selectedOption = workflow.options.find((option) => option.key === input.responseOptionKey);
  if (!selectedOption) {
    throw new AppError({
      statusCode: 422,
      code: "RESPONSE_OPTION_INVALID",
      message: "The selected response option is not valid for this workflow.",
    });
  }

  const normalizedNote = input.responseNote?.trim() ?? "";
  if (!workflow.allowFreeText && normalizedNote) {
    throw new AppError({
      statusCode: 422,
      code: "RESPONSE_NOTE_NOT_ALLOWED",
      message: "This workflow does not allow a free-text response note.",
    });
  }

  if (workflow.requireFreeText && !normalizedNote) {
    throw new AppError({
      statusCode: 422,
      code: "RESPONSE_NOTE_REQUIRED",
      message: "This workflow requires a free-text response note.",
    });
  }
}

function serializeRecipientResponse(
  id: string,
  recipientId: string,
  responseOptionKey: string,
  responseNote: string | null,
  actorUserIdentifier: string | null,
  respondedAt: string,
) {
  return {
    id,
    recipientId,
    channel: "WindowsAgent",
    responseOptionKey,
    actorUserIdentifier,
    responseNote,
    respondedAt,
  };
}

function readResponseNote(value: unknown) {
  const parsed = parseJsonObject<{ responseNote?: string | null }>(value);
  return typeof parsed?.responseNote === "string" ? parsed.responseNote : null;
}

function readActorUserIdentifier(value: unknown) {
  const parsed = parseJsonObject<{ activeUserIdentifier?: string | null }>(value);
  return typeof parsed?.activeUserIdentifier === "string" ? parsed.activeUserIdentifier : null;
}

function isExpiredReminderPolicy(validUntil: string | null) {
  return validUntil ? Date.parse(validUntil) <= Date.now() : false;
}

function isDeviceNotRegisteredError(error: unknown) {
  return (
    error instanceof AppError &&
    error.statusCode === 409 &&
    error.code === "DEVICE_NOT_REGISTERED"
  );
}
