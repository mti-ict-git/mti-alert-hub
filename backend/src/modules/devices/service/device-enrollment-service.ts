import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";
import { createPageMeta } from "../../../shared/http/list-query.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { AuditLogService } from "../../audit/service/audit-log-service.js";

type EnrollmentActor = {
  userIdentifier: string;
  username: string;
  ipAddress?: string | null;
};

type PendingEnrollmentListOptions = {
  page: number;
  pageSize: number;
  search?: string;
};

type RecordEnrollmentAttemptInput = {
  deviceIdentifier: string;
  hostname?: string | null;
  agentVersion?: string | null;
  employeeNumber?: string | null;
  activeUserIdentifier?: string | null;
};

type ApproveEnrollmentInput = {
  siteId: string;
  areaId?: string | null;
  locationLabel?: string | null;
  ownershipMode?: "LocationOwned" | "EmployeeAssigned" | "Mixed" | null;
};

type RejectEnrollmentInput = {
  reason?: string | null;
};

type EnrollmentRow = {
  id: string;
  deviceIdentifier: string;
  hostname: string;
  agentVersion: string | null;
  employeeNumber: string | null;
  activeUserIdentifier: string | null;
  requestStatus: "Pending" | "Approved" | "Rejected";
  requestCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  decidedByUsername: string | null;
  decisionReason: string | null;
  approvedDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PendingEnrollmentListRow = EnrollmentRow;

type DeviceConflictRow = {
  id: string;
  hostname: string;
  deviceIdentifier: string | null;
};

type CreatedDeviceRow = {
  id: string;
  hostname: string;
  deviceIdentifier: string | null;
  siteId: string;
  areaId: string | null;
  locationLabel: string | null;
  ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
  agentVersion: string | null;
  status: "Online" | "Offline" | "Stale";
  createdAt: string;
};

export class DeviceEnrollmentService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly auditLogService: AuditLogService,
  ) {}

  async recordAgentEnrollmentAttempt(input: RecordEnrollmentAttemptInput) {
    const normalizedIdentifier = input.deviceIdentifier.trim();
    const normalizedHostname = normalizeHostname(input.hostname, normalizedIdentifier);
    const normalizedAgentVersion = normalizeOptionalText(input.agentVersion);
    const normalizedEmployeeNumber = normalizeOptionalText(input.employeeNumber);
    const normalizedActiveUserIdentifier = normalizeOptionalText(input.activeUserIdentifier);

    if (!normalizedIdentifier) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "deviceIdentifier is required.",
      });
    }

    return this.database.withTransaction(async (transaction) => {
      const existing = await this.findEnrollmentByIdentity(
        transaction,
        normalizedHostname,
        normalizedIdentifier,
      );

      if (!existing) {
        const createdRows = await transaction.query<EnrollmentRow>(
          `
            insert into public.device_enrollment_requests (
              device_identifier,
              hostname,
              agent_version,
              employee_number,
              active_user_identifier,
              request_status,
              request_count,
              first_seen_at,
              last_seen_at
            )
            values (
              $1,
              $2,
              $3,
              $4,
              $5,
              'Pending',
              1,
              now(),
              now()
            )
            returning
              id::text as id,
              device_identifier::text as "deviceIdentifier",
              hostname::text as hostname,
              agent_version::text as "agentVersion",
              employee_number::text as "employeeNumber",
              active_user_identifier::text as "activeUserIdentifier",
              request_status::text as "requestStatus",
              request_count,
              first_seen_at::text as "firstSeenAt",
              last_seen_at::text as "lastSeenAt",
              decided_at::text as "decidedAt",
              decided_by_user_id::text as "decidedByUserId",
              decided_by_username::text as "decidedByUsername",
              decision_reason::text as "decisionReason",
              approved_device_id::text as "approvedDeviceId",
              created_at::text as "createdAt",
              updated_at::text as "updatedAt"
          `,
          [
            normalizedIdentifier,
            normalizedHostname,
            normalizedAgentVersion,
            normalizedEmployeeNumber,
            normalizedActiveUserIdentifier,
          ],
        );

        return createdRows[0] ?? null;
      }

      const updatedRows = await transaction.query<EnrollmentRow>(
        `
          update public.device_enrollment_requests
          set
            device_identifier = $2,
            hostname = $3,
            agent_version = coalesce($4, agent_version),
            employee_number = coalesce($5, employee_number),
            active_user_identifier = coalesce($6, active_user_identifier),
            request_count = request_count + 1,
            last_seen_at = now()
          where id::text = $1
          returning
            id::text as id,
            device_identifier::text as "deviceIdentifier",
            hostname::text as hostname,
            agent_version::text as "agentVersion",
            employee_number::text as "employeeNumber",
            active_user_identifier::text as "activeUserIdentifier",
            request_status::text as "requestStatus",
            request_count,
            first_seen_at::text as "firstSeenAt",
            last_seen_at::text as "lastSeenAt",
            decided_at::text as "decidedAt",
            decided_by_user_id::text as "decidedByUserId",
            decided_by_username::text as "decidedByUsername",
            decision_reason::text as "decisionReason",
            approved_device_id::text as "approvedDeviceId",
            created_at::text as "createdAt",
            updated_at::text as "updatedAt"
        `,
        [
          existing.id,
          normalizedIdentifier,
          normalizedHostname,
          normalizedAgentVersion,
          normalizedEmployeeNumber,
          normalizedActiveUserIdentifier,
        ],
      );

      return updatedRows[0] ?? existing;
    });
  }

  async listPendingEnrollments(options: PendingEnrollmentListOptions) {
    const where = buildPendingEnrollmentWhereClause(options);
    const params = buildPaginationParams(options, where.params);

    const [items, totalRows] = await Promise.all([
      this.database.query<PendingEnrollmentListRow>(
        `
          select
            id::text as id,
            device_identifier::text as "deviceIdentifier",
            hostname::text as hostname,
            agent_version::text as "agentVersion",
            employee_number::text as "employeeNumber",
            active_user_identifier::text as "activeUserIdentifier",
            request_status::text as "requestStatus",
            request_count,
            first_seen_at::text as "firstSeenAt",
            last_seen_at::text as "lastSeenAt",
            decided_at::text as "decidedAt",
            decided_by_user_id::text as "decidedByUserId",
            decided_by_username::text as "decidedByUsername",
            decision_reason::text as "decisionReason",
            approved_device_id::text as "approvedDeviceId",
            created_at::text as "createdAt",
            updated_at::text as "updatedAt"
          from public.device_enrollment_requests
          ${where.clause}
          order by last_seen_at desc, created_at desc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.device_enrollment_requests
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: totalRows[0]?.totalItems ?? 0,
      }),
    };
  }

  async approvePendingEnrollment(
    requestId: string,
    input: ApproveEnrollmentInput,
    actor: EnrollmentActor,
  ) {
    return this.database.withTransaction(async (transaction) => {
      const request = await this.requireEnrollmentById(transaction, requestId);
      ensurePending(request);

      const normalizedLocationLabel = normalizeOptionalText(input.locationLabel);
      const normalizedOwnershipMode = input.ownershipMode ?? "LocationOwned";

      await requireSite(transaction, input.siteId);
      if (input.areaId) {
        await requireAreaForSite(transaction, input.areaId, input.siteId);
      }

      await ensureNoDeviceConflicts(transaction, request);

      const createdDeviceRows = await transaction.query<CreatedDeviceRow>(
        `
          insert into public.devices (
            device_identifier,
            hostname,
            site_id,
            area_id,
            location_label,
            ownership_mode,
            agent_version,
            status
          )
          values (
            $1,
            $2,
            $3::uuid,
            $4::uuid,
            $5,
            $6,
            $7,
            'Offline'
          )
          returning
            id::text as id,
            hostname::text as hostname,
            device_identifier::text as "deviceIdentifier",
            site_id::text as "siteId",
            area_id::text as "areaId",
            location_label::text as "locationLabel",
            ownership_mode::text as "ownershipMode",
            agent_version::text as "agentVersion",
            status::text as status,
            created_at::text as "createdAt"
        `,
        [
          request.deviceIdentifier,
          request.hostname,
          input.siteId,
          input.areaId ?? null,
          normalizedLocationLabel,
          normalizedOwnershipMode,
          request.agentVersion,
        ],
      );

      const createdDevice = createdDeviceRows[0];
      if (!createdDevice) {
        throw new AppError({
          statusCode: 500,
          code: "DEVICE_APPROVAL_FAILED",
          message: "The pending device could not be approved.",
        });
      }

      const updatedRequestRows = await transaction.query<EnrollmentRow>(
        `
          update public.device_enrollment_requests
          set
            request_status = 'Approved',
            approved_device_id = $2::uuid,
            decided_at = now(),
            decided_by_user_id = $3,
            decided_by_username = $4,
            decision_reason = null
          where id::text = $1
          returning
            id::text as id,
            device_identifier::text as "deviceIdentifier",
            hostname::text as hostname,
            agent_version::text as "agentVersion",
            employee_number::text as "employeeNumber",
            active_user_identifier::text as "activeUserIdentifier",
            request_status::text as "requestStatus",
            request_count,
            first_seen_at::text as "firstSeenAt",
            last_seen_at::text as "lastSeenAt",
            decided_at::text as "decidedAt",
            decided_by_user_id::text as "decidedByUserId",
            decided_by_username::text as "decidedByUsername",
            decision_reason::text as "decisionReason",
            approved_device_id::text as "approvedDeviceId",
            created_at::text as "createdAt",
            updated_at::text as "updatedAt"
        `,
        [requestId, createdDevice.id, actor.userIdentifier, actor.username],
      );

      const updatedRequest = updatedRequestRows[0] ?? request;

      await this.auditLogService.record(transaction, {
        actorUserId: actor.userIdentifier,
        actorUsername: actor.username,
        actionType: "ApproveDeviceEnrollment",
        moduleName: "Devices",
        entityType: "DeviceEnrollmentRequest",
        entityId: request.id,
        description: `Approved pending device ${request.hostname} into the devices baseline.`,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          hostname: request.hostname,
          deviceIdentifier: request.deviceIdentifier,
          approvedDeviceId: createdDevice.id,
          siteId: createdDevice.siteId,
          areaId: createdDevice.areaId,
          ownershipMode: createdDevice.ownershipMode,
        },
      });

      return {
        ok: true,
        request: updatedRequest,
        device: createdDevice,
      };
    });
  }

  async rejectPendingEnrollment(
    requestId: string,
    input: RejectEnrollmentInput,
    actor: EnrollmentActor,
  ) {
    return this.database.withTransaction(async (transaction) => {
      const request = await this.requireEnrollmentById(transaction, requestId);
      ensurePending(request);

      const normalizedReason = normalizeOptionalText(input.reason);
      const updatedRows = await transaction.query<EnrollmentRow>(
        `
          update public.device_enrollment_requests
          set
            request_status = 'Rejected',
            decided_at = now(),
            decided_by_user_id = $2,
            decided_by_username = $3,
            decision_reason = $4
          where id::text = $1
          returning
            id::text as id,
            device_identifier::text as "deviceIdentifier",
            hostname::text as hostname,
            agent_version::text as "agentVersion",
            employee_number::text as "employeeNumber",
            active_user_identifier::text as "activeUserIdentifier",
            request_status::text as "requestStatus",
            request_count,
            first_seen_at::text as "firstSeenAt",
            last_seen_at::text as "lastSeenAt",
            decided_at::text as "decidedAt",
            decided_by_user_id::text as "decidedByUserId",
            decided_by_username::text as "decidedByUsername",
            decision_reason::text as "decisionReason",
            approved_device_id::text as "approvedDeviceId",
            created_at::text as "createdAt",
            updated_at::text as "updatedAt"
        `,
        [requestId, actor.userIdentifier, actor.username, normalizedReason],
      );

      const updatedRequest = updatedRows[0] ?? request;

      await this.auditLogService.record(transaction, {
        actorUserId: actor.userIdentifier,
        actorUsername: actor.username,
        actionType: "RejectDeviceEnrollment",
        moduleName: "Devices",
        entityType: "DeviceEnrollmentRequest",
        entityId: request.id,
        description: `Rejected pending device ${request.hostname}.`,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          hostname: request.hostname,
          deviceIdentifier: request.deviceIdentifier,
          reason: normalizedReason,
        },
      });

      return {
        ok: true,
        request: updatedRequest,
      };
    });
  }

  private async findEnrollmentByIdentity(
    transaction: TransactionClient,
    hostname: string,
    deviceIdentifier: string,
  ) {
    const rows = await transaction.query<EnrollmentRow>(
      `
        select
          id::text as id,
          device_identifier::text as "deviceIdentifier",
          hostname::text as hostname,
          agent_version::text as "agentVersion",
          employee_number::text as "employeeNumber",
          active_user_identifier::text as "activeUserIdentifier",
          request_status::text as "requestStatus",
          request_count,
          first_seen_at::text as "firstSeenAt",
          last_seen_at::text as "lastSeenAt",
          decided_at::text as "decidedAt",
          decided_by_user_id::text as "decidedByUserId",
          decided_by_username::text as "decidedByUsername",
          decision_reason::text as "decisionReason",
          approved_device_id::text as "approvedDeviceId",
          created_at::text as "createdAt",
          updated_at::text as "updatedAt"
        from public.device_enrollment_requests
        where lower(hostname) = lower($1)
           or device_identifier = $2
        order by
          case when lower(hostname) = lower($1) then 0 else 1 end,
          updated_at desc
        limit 1
      `,
      [hostname, deviceIdentifier],
    );

    return rows[0] ?? null;
  }

  private async requireEnrollmentById(transaction: TransactionClient, requestId: string) {
    const rows = await transaction.query<EnrollmentRow>(
      `
        select
          id::text as id,
          device_identifier::text as "deviceIdentifier",
          hostname::text as hostname,
          agent_version::text as "agentVersion",
          employee_number::text as "employeeNumber",
          active_user_identifier::text as "activeUserIdentifier",
          request_status::text as "requestStatus",
          request_count,
          first_seen_at::text as "firstSeenAt",
          last_seen_at::text as "lastSeenAt",
          decided_at::text as "decidedAt",
          decided_by_user_id::text as "decidedByUserId",
          decided_by_username::text as "decidedByUsername",
          decision_reason::text as "decisionReason",
          approved_device_id::text as "approvedDeviceId",
          created_at::text as "createdAt",
          updated_at::text as "updatedAt"
        from public.device_enrollment_requests
        where id::text = $1
        limit 1
      `,
      [requestId],
    );

    const request = rows[0];
    if (!request) {
      throw new AppError({
        statusCode: 404,
        code: "DEVICE_ENROLLMENT_REQUEST_NOT_FOUND",
        message: "The requested pending device record was not found.",
      });
    }

    return request;
  }
}

function normalizeOptionalText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHostname(hostname: string | null | undefined, deviceIdentifier: string) {
  return normalizeOptionalText(hostname) ?? deviceIdentifier;
}

function buildPendingEnrollmentWhereClause(options: Pick<PendingEnrollmentListOptions, "search">) {
  const conditions = [`request_status = 'Pending'`];
  const params: unknown[] = [];

  if (options.search?.trim()) {
    params.push(`%${options.search.trim()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(
        hostname ilike ${searchParam}
        or device_identifier ilike ${searchParam}
        or coalesce(agent_version, '') ilike ${searchParam}
        or coalesce(active_user_identifier, '') ilike ${searchParam}
      )`,
    );
  }

  return {
    clause: `where ${conditions.join(" and ")}`,
    params,
  };
}

function buildPaginationParams(
  options: Pick<PendingEnrollmentListOptions, "page" | "pageSize">,
  existingParams: unknown[],
) {
  const values = [...existingParams, options.pageSize, (options.page - 1) * options.pageSize];
  return {
    values,
    limitIndex: existingParams.length + 1,
    offsetIndex: existingParams.length + 2,
  };
}

function ensurePending(request: EnrollmentRow) {
  if (request.requestStatus !== "Pending") {
    throw new AppError({
      statusCode: 409,
      code: "DEVICE_ENROLLMENT_REQUEST_NOT_PENDING",
      message: `The device enrollment request is already ${request.requestStatus.toLowerCase()}.`,
    });
  }
}

async function requireSite(transaction: TransactionClient, siteId: string) {
  const rows = await transaction.query<{ id: string }>(
    `
      select id::text as id
      from public.sites
      where id::text = $1
      limit 1
    `,
    [siteId],
  );

  if (!rows[0]) {
    throw new AppError({
      statusCode: 422,
      code: "SITE_NOT_FOUND",
      message: "The selected site does not exist.",
    });
  }
}

async function requireAreaForSite(transaction: TransactionClient, areaId: string, siteId: string) {
  const rows = await transaction.query<{ id: string }>(
    `
      select id::text as id
      from public.areas
      where id::text = $1
        and site_id::text = $2
      limit 1
    `,
    [areaId, siteId],
  );

  if (!rows[0]) {
    throw new AppError({
      statusCode: 422,
      code: "AREA_NOT_FOUND",
      message: "The selected area does not belong to the selected site.",
    });
  }
}

async function ensureNoDeviceConflicts(transaction: TransactionClient, request: EnrollmentRow) {
  const hostnameConflicts = await transaction.query<DeviceConflictRow>(
    `
      select
        id::text as id,
        hostname::text as hostname,
        device_identifier::text as "deviceIdentifier"
      from public.devices
      where lower(hostname) = lower($1)
      limit 1
    `,
    [request.hostname],
  );

  if (hostnameConflicts[0]) {
    throw new AppError({
      statusCode: 409,
      code: "DEVICE_HOSTNAME_CONFLICT",
      message: "A device with the same hostname already exists in the approved devices baseline.",
    });
  }

  const normalizedIdentifier = normalizeOptionalText(request.deviceIdentifier);
  if (!normalizedIdentifier) {
    return;
  }

  const identifierConflicts = await transaction.query<DeviceConflictRow>(
    `
      select
        id::text as id,
        hostname::text as hostname,
        device_identifier::text as "deviceIdentifier"
      from public.devices
      where device_identifier = $1
      limit 1
    `,
    [normalizedIdentifier],
  );

  if (identifierConflicts[0]) {
    throw new AppError({
      statusCode: 409,
      code: "DEVICE_IDENTIFIER_CONFLICT",
      message: "A device with the same device identifier already exists in the approved devices baseline.",
    });
  }
}
