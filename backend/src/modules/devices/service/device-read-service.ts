import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { createPageMeta } from "../../../shared/http/list-query.js";
import type { DeviceHealthThresholds } from "../../../app/config/env.js";
import { buildDeviceHealthStatusSql } from "./device-health-sql.js";

type DeviceReadOptions = {
  page: number;
  pageSize: number;
  search?: string;
  siteId?: string;
  areaId?: string;
  status?: "Online" | "Offline" | "Stale";
};

type DeviceRow = {
  id: string;
  primaryEmployeeId: string | null;
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
};

export class DeviceReadService {
  private readonly statusSql: string;

  constructor(
    private readonly database: DatabaseClient,
    thresholds: DeviceHealthThresholds,
  ) {
    this.statusSql = buildDeviceHealthStatusSql(thresholds);
  }

  async listDevices(options: DeviceReadOptions) {
    const where = buildDeviceWhereClause(options);
    const params = buildPaginationParams(options, where.params);

    const [items, totalRows] = await Promise.all([
      this.database.maybeQuery<DeviceRow>(
        "devices",
        `
          select
            d.id::text as id,
            d.primary_employee_id::text as "primaryEmployeeId",
            d.device_identifier::text as "deviceIdentifier",
            d.hostname::text as hostname,
            d.site_id::text as "siteId",
            d.area_id::text as "areaId",
            d.location_label::text as "locationLabel",
            d.ownership_mode::text as "ownershipMode",
            d.agent_version::text as "agentVersion",
            d.last_heartbeat_at::text as "lastHeartbeatAt",
            d.last_connection_at::text as "lastConnectionAt",
            ${this.statusSql}::text as status
          from public.devices d
          ${where.clause.replace("status::text", `${this.statusSql}::text`)}
          order by hostname asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.maybeQuery<{ totalItems: number }>(
        "devices",
        `
          select count(*)::int as "totalItems"
          from public.devices d
          ${where.clause.replace("status::text", `${this.statusSql}::text`)}
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
}

function buildDeviceWhereClause(options: DeviceReadOptions) {
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (options.siteId) {
    values.push(options.siteId);
    conditions.push(`d.site_id::text = $${values.length}`);
  }

  if (options.areaId) {
    values.push(options.areaId);
    conditions.push(`d.area_id::text = $${values.length}`);
  }

  if (options.status) {
    values.push(options.status);
    conditions.push(`status::text = $${values.length}`);
  }

  if (options.search) {
    const term = `%${options.search}%`;
    values.push(term, term, term);
    conditions.push(
      `(d.hostname::text ilike $${values.length - 2} or d.device_identifier::text ilike $${values.length - 1} or d.location_label::text ilike $${values.length})`,
    );
  }

  return {
    clause: conditions.length > 0 ? `where ${conditions.join(" and ")}` : "",
    params: values,
  };
}

function buildPaginationParams(
  options: {
    page: number;
    pageSize: number;
  },
  baseParams: unknown[],
) {
  const values = [...baseParams, options.pageSize, (options.page - 1) * options.pageSize];

  return {
    values,
    limitIndex: baseParams.length + 1,
    offsetIndex: baseParams.length + 2,
  };
}
