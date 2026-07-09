import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";
import { createPageMeta } from "../../../shared/http/list-query.js";

type AuditWriter = DatabaseClient | TransactionClient;

type RecordAuditLogInput = {
  actorUserId?: string | null;
  actorUsername?: string | null;
  actionType: string;
  moduleName: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  ipAddress?: string | null;
  metadata?: unknown;
  createdAt?: string;
};

type ListAuditLogsOptions = {
  page: number;
  pageSize: number;
  search?: string;
  module?: string;
};

type AuditLogRow = {
  id: string;
  time: string;
  user: string | null;
  action: string;
  module: string;
  description: string;
  ipAddress: string | null;
};

export class AuditLogService {
  constructor(private readonly database: DatabaseClient) {}

  async recordNow(input: RecordAuditLogInput) {
    await this.record(this.database, input);
  }

  async record(writer: AuditWriter, input: RecordAuditLogInput) {
    await writer.query(
      `
        insert into public.audit_logs (
          actor_user_id,
          actor_username,
          action_type,
          module_name,
          entity_type,
          entity_id,
          description,
          ip_address,
          metadata_json,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          coalesce($10::timestamptz, now())
        )
      `,
      [
        input.actorUserId ?? null,
        input.actorUsername ?? null,
        input.actionType,
        input.moduleName,
        input.entityType,
        input.entityId ?? null,
        input.description,
        input.ipAddress ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdAt ?? null,
      ],
    );
  }

  async listAuditLogs(options: ListAuditLogsOptions) {
    const where = buildAuditLogWhereClause(options);
    const pagination = buildPaginationParams(options, where.params);

    const [rows, totalRows] = await Promise.all([
      this.database.query<AuditLogRow>(
        `
          select
            id::text as id,
            created_at::text as time,
            coalesce(actor_username, actor_user_id, 'system')::text as user,
            action_type::text as action,
            module_name::text as module,
            description::text as description,
            ip_address::text as "ipAddress"
          from public.audit_logs
          ${where.clause}
          order by created_at desc
          limit $${pagination.limitIndex}
          offset $${pagination.offsetIndex}
        `,
        pagination.values,
      ),
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.audit_logs
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items: rows,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: totalRows[0]?.totalItems ?? 0,
      }),
    };
  }
}

function buildAuditLogWhereClause(options: Pick<ListAuditLogsOptions, "search" | "module">) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.module) {
    params.push(options.module.trim());
    conditions.push(`module_name = $${params.length}`);
  }

  if (options.search?.trim()) {
    params.push(`%${options.search.trim()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(
        description ilike ${searchParam}
        or action_type ilike ${searchParam}
        or coalesce(actor_username, actor_user_id, 'system') ilike ${searchParam}
      )`,
    );
  }

  if (conditions.length === 0) {
    return {
      clause: "",
      params,
    };
  }

  return {
    clause: `where ${conditions.join(" and ")}`,
    params,
  };
}

function buildPaginationParams(
  options: Pick<ListAuditLogsOptions, "page" | "pageSize">,
  existingParams: unknown[],
) {
  const values = [...existingParams, options.pageSize, (options.page - 1) * options.pageSize];
  return {
    values,
    limitIndex: existingParams.length + 1,
    offsetIndex: existingParams.length + 2,
  };
}
