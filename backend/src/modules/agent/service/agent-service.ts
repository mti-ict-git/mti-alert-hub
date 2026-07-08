import { randomUUID } from "node:crypto";

import { AppError } from "../../../shared/errors/app-error.js";
import type { Logger } from "../../../shared/observability/logger.js";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import type { BackendEnv } from "../../../app/config/env.js";
import type { AgentSession } from "./agent-session-store.js";
import { AgentSessionStore } from "./agent-session-store.js";

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
};

type HeartbeatInput = {
  deviceIdentifier: string;
  heartbeatAt: string;
  status?: "Online" | "Offline" | "Stale" | null;
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
  eventType: string;
  occurredAt: string;
  activeUserIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

export class AgentService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly sessionStore: AgentSessionStore,
    private readonly env: BackendEnv,
    private readonly logger: Logger,
  ) {}

  async createSession(input: CreateAgentSessionInput) {
    const device = await this.requireKnownDevice({
      deviceIdentifier: input.deviceIdentifier,
      hostname: input.hostname ?? null,
    });

    const session = await this.sessionStore.createSession({
      device: {
        id: device.id,
        deviceIdentifier: device.deviceIdentifier,
        hostname: device.hostname,
      },
    });

    await this.database.query(
      `
        update public.devices
        set
          device_identifier = coalesce($2, device_identifier),
          agent_version = coalesce($3, agent_version),
          hostname = coalesce($4, hostname),
          last_connection_at = now(),
          status = 'Online'
        where id::text = $1
      `,
      [device.id, input.deviceIdentifier, input.agentVersion ?? null, input.hostname ?? null],
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
    const session = await this.requireSession(sessionToken);
    this.ensureSessionMatchesDevice(session, input.deviceIdentifier);

    return {
      connectionUrl: this.buildRealtimeUrl(),
      accessToken: randomUUID(),
      transport: "SignalR",
    };
  }

  async reportHeartbeat(sessionToken: string, input: HeartbeatInput) {
    const session = await this.requireSession(sessionToken);
    this.ensureSessionMatchesDevice(session, input.deviceIdentifier);
    this.ensureIsoDate(input.heartbeatAt, "heartbeatAt");

    await this.database.query(
      `
        update public.devices
        set
          device_identifier = coalesce($2, device_identifier),
          last_heartbeat_at = $3::timestamptz,
          status = coalesce($4, status),
          updated_at = now()
        where id::text = $1
      `,
      [session.device.id, input.deviceIdentifier, input.heartbeatAt, input.status ?? null],
    );

    this.logger.info("agent.heartbeat.recorded", {
      deviceId: session.device.id,
      deviceIdentifier: input.deviceIdentifier,
      status: input.status ?? "unchanged",
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });
  }

  async listPendingMessages(sessionToken: string, since?: string | null) {
    await this.requireSession(sessionToken);
    if (since) {
      this.ensureOptionalIsoDate(since, "since");
    }

    return {
      items: [],
      nextCursor: null,
    };
  }

  async listReminderPolicies(sessionToken: string, since?: string | null) {
    await this.requireSession(sessionToken);
    if (since) {
      this.ensureOptionalIsoDate(since, "since");
    }

    return {
      items: [],
    };
  }

  async reportDisplayed(sessionToken: string, messageId: string, input: LifecycleEventInput) {
    await this.requireSession(sessionToken);
    this.requireMessageId(messageId);
    this.ensureIsoDate(input.occurredAt, "occurredAt");

    this.logger.info("agent.message.displayed", {
      messageId,
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });
  }

  async reportRead(sessionToken: string, messageId: string, input: LifecycleEventInput) {
    await this.requireSession(sessionToken);
    this.requireMessageId(messageId);
    this.ensureIsoDate(input.occurredAt, "occurredAt");

    this.logger.info("agent.message.read", {
      messageId,
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });
  }

  async submitResponse(sessionToken: string, messageId: string, input: MessageResponseInput) {
    await this.requireSession(sessionToken);
    this.requireMessageId(messageId);
    if (input.occurredAt) {
      this.ensureOptionalIsoDate(input.occurredAt, "occurredAt");
    }

    const respondedAt = input.occurredAt ?? new Date().toISOString();

    this.logger.info("agent.message.response_recorded", {
      messageId,
      responseOptionKey: input.responseOptionKey,
      hasResponseNote: Boolean(input.responseNote),
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
    });

    return {
      id: randomUUID(),
      recipientId: messageId,
      channel: "WindowsAgent",
      responseOptionKey: input.responseOptionKey,
      actorUserIdentifier: input.activeUserIdentifier ?? null,
      responseNote: input.responseNote ?? null,
      respondedAt,
    };
  }

  async reportReminderEvent(sessionToken: string, policyId: string, input: ReminderEventInput) {
    await this.requireSession(sessionToken);
    if (!policyId.trim()) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "policyId is required.",
      });
    }

    this.ensureIsoDate(input.occurredAt, "occurredAt");

    this.logger.info("agent.reminder.event_recorded", {
      policyId,
      eventType: input.eventType,
      hasActiveUserIdentifier: Boolean(input.activeUserIdentifier),
      hasMetadata: Boolean(input.metadata),
    });
  }

  private async requireSession(sessionToken: string) {
    const session = await this.sessionStore.getSession(sessionToken);
    if (!session) {
      throw new AppError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "A valid agent session is required.",
      });
    }

    return session;
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
          sec.name::text as "sectionName"
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
          sec.name::text as "sectionName"
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

  private ensureSessionMatchesDevice(session: AgentSession, requestedDeviceIdentifier: string) {
    const normalizedRequestedDeviceIdentifier = requestedDeviceIdentifier.trim();
    if (
      normalizedRequestedDeviceIdentifier.length > 0 &&
      session.device.deviceIdentifier &&
      session.device.deviceIdentifier !== normalizedRequestedDeviceIdentifier
    ) {
      throw new AppError({
        statusCode: 409,
        code: "DEVICE_SESSION_MISMATCH",
        message: "The agent session is bound to a different device identifier.",
      });
    }
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

  private buildRealtimeUrl() {
    const port = this.env.BACKEND_PORT;
    const host = this.env.NODE_ENV === "production" ? "localhost" : "localhost";
    return `http://${host}:${port}/agent/realtime-hub`;
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
