import { AppError } from "../../../shared/errors/app-error.js";
import { createPageMeta } from "../../../shared/http/list-query.js";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";

type ListTemplateOptions = {
  page: number;
  pageSize: number;
  search?: string;
};

export type CommunicationTemplatePolicy = {
  id: string;
  name: string;
  communicationType: CommunicationType;
  defaultPriority: Priority;
  defaultChannels: Channel[];
  version: number;
  mandatoryChannels: Channel[];
  optionalChannels: Channel[];
  defaultWorkflowId: string | null;
  defaultWindowsAgentPresentation: WindowsAgentPresentation | null;
  criticalBehaviorMode: CriticalBehaviorMode | null;
  defaultDeliveryStrategy: DeliveryStrategy | null;
  dualPathRule: DualPathRule | null;
  allowedTargetTypes: TargetType[];
  lockedFields: string[];
  editableFields: string[];
  defaultRequiresResponse: boolean;
  defaultTitle: string | null;
  defaultBody: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  communicationType: CommunicationType;
  defaultPriority: Priority;
  defaultChannels: unknown;
  version: number;
  mandatoryChannels: unknown;
  optionalChannels: unknown;
  defaultWorkflowId: string | null;
  defaultWindowsAgentPresentation: WindowsAgentPresentation | null;
  criticalBehaviorMode: CriticalBehaviorMode | null;
  defaultDeliveryStrategy: DeliveryStrategy | null;
  dualPathRule: unknown;
  allowedTargetTypes: unknown;
  lockedFields: unknown;
  editableFields: unknown;
  defaultRequiresResponse: boolean;
  defaultTitle: string | null;
  defaultBody: string | null;
};

export type CommunicationType =
  | "Alert"
  | "Reminder"
  | "OperationalNotice"
  | "News"
  | "Article"
  | "KnowledgeUpdate";

export type Priority = "Info" | "Warning" | "Critical";
export type Channel = "WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage";
export type DeliveryStrategy = "UserPreference" | "MultiSend" | "PrimaryFallback" | "TemplatePolicy";
export type WindowsAgentPresentation = "Toast" | "Modal" | "Fullscreen";
export type CriticalBehaviorMode = "ModalThenStronger" | "FixedModal" | "FullscreenImmediate";
export type TargetType = "All" | "Site" | "Area" | "Department" | "Section" | "Role" | "Employee" | "Group" | "Device";

type DualPathRule = {
  enabled?: boolean;
  mode?: "DesktopFirstShortDelayWhatsApp";
  delaySeconds?: number | null;
};

export class CommunicationTemplateService {
  constructor(private readonly database: DatabaseClient) {}

  async listTemplates(options: ListTemplateOptions) {
    const where = buildSearchWhereClause(options.search);
    const params = buildPaginationParams(options, where.params);

    const [rows, totalRows] = await Promise.all([
      this.database.query<TemplateRow>(
        `
          select
            id::text as id,
            name::text as name,
            communication_type::text as "communicationType",
            default_priority::text as "defaultPriority",
            coalesce(mandatory_channels_json, '[]'::jsonb) || coalesce(optional_channels_json, '[]'::jsonb) as "defaultChannels",
            version,
            mandatory_channels_json as "mandatoryChannels",
            optional_channels_json as "optionalChannels",
            workflow_id::text as "defaultWorkflowId",
            default_windows_agent_presentation::text as "defaultWindowsAgentPresentation",
            critical_behavior_mode::text as "criticalBehaviorMode",
            default_channel_strategy::text as "defaultDeliveryStrategy",
            dual_path_rule_json as "dualPathRule",
            allowed_target_types_json as "allowedTargetTypes",
            locked_fields_json as "lockedFields",
            editable_fields_json as "editableFields",
            default_requires_response as "defaultRequiresResponse",
            default_title::text as "defaultTitle",
            default_body::text as "defaultBody"
          from public.communication_templates
          where is_active = true
          ${where.clause}
          order by name asc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.communication_templates
          where is_active = true
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items: rows.map((row) => mapTemplateRow(row)),
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: totalRows[0]?.totalItems ?? 0,
      }),
    };
  }

  async getTemplateById(templateId: string) {
    const template = await this.findTemplateById(templateId);
    if (!template) {
      throw new AppError({
        statusCode: 404,
        code: "TEMPLATE_NOT_FOUND",
        message: "The requested communication template was not found.",
      });
    }

    return template;
  }

  async findTemplateById(templateId: string) {
    const rows = await this.database.query<TemplateRow>(
      `
        select
          id::text as id,
          name::text as name,
          communication_type::text as "communicationType",
          default_priority::text as "defaultPriority",
          coalesce(mandatory_channels_json, '[]'::jsonb) || coalesce(optional_channels_json, '[]'::jsonb) as "defaultChannels",
          version,
          mandatory_channels_json as "mandatoryChannels",
          optional_channels_json as "optionalChannels",
          workflow_id::text as "defaultWorkflowId",
          default_windows_agent_presentation::text as "defaultWindowsAgentPresentation",
          critical_behavior_mode::text as "criticalBehaviorMode",
          default_channel_strategy::text as "defaultDeliveryStrategy",
          dual_path_rule_json as "dualPathRule",
          allowed_target_types_json as "allowedTargetTypes",
          locked_fields_json as "lockedFields",
          editable_fields_json as "editableFields",
          default_requires_response as "defaultRequiresResponse",
          default_title::text as "defaultTitle",
          default_body::text as "defaultBody"
        from public.communication_templates
        where id::text = $1
          and is_active = true
        limit 1
      `,
      [templateId],
    );

    const row = rows[0];
    return row ? mapTemplateRow(row) : undefined;
  }
}

function mapTemplateRow(row: TemplateRow): CommunicationTemplatePolicy {
  return {
    id: row.id,
    name: row.name,
    communicationType: row.communicationType,
    defaultPriority: row.defaultPriority,
    defaultChannels: normalizeStringArray<Channel>(row.defaultChannels),
    version: row.version,
    mandatoryChannels: normalizeStringArray<Channel>(row.mandatoryChannels),
    optionalChannels: normalizeStringArray<Channel>(row.optionalChannels),
    defaultWorkflowId: row.defaultWorkflowId,
    defaultWindowsAgentPresentation: row.defaultWindowsAgentPresentation,
    criticalBehaviorMode: row.criticalBehaviorMode,
    defaultDeliveryStrategy: row.defaultDeliveryStrategy,
    dualPathRule: normalizeDualPathRule(row.dualPathRule),
    allowedTargetTypes: normalizeStringArray<TargetType>(row.allowedTargetTypes),
    lockedFields: normalizeStringArray(row.lockedFields),
    editableFields: normalizeStringArray(row.editableFields),
    defaultRequiresResponse: row.defaultRequiresResponse,
    defaultTitle: row.defaultTitle,
    defaultBody: row.defaultBody,
  };
}

function normalizeStringArray<T extends string = string>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is T => typeof item === "string");
}

function normalizeDualPathRule(value: unknown): DualPathRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : undefined,
    mode:
      candidate.mode === "DesktopFirstShortDelayWhatsApp"
        ? "DesktopFirstShortDelayWhatsApp"
        : undefined,
    delaySeconds:
      typeof candidate.delaySeconds === "number" || candidate.delaySeconds === null
        ? (candidate.delaySeconds as number | null)
        : undefined,
  };
}

function buildSearchWhereClause(search: string | undefined) {
  if (!search) {
    return {
      clause: "",
      params: [] as unknown[],
    };
  }

  const term = `%${search}%`;
  return {
    clause:
      "and (name::text ilike $1 or template_key::text ilike $2 or communication_type::text ilike $3)",
    params: [term, term, term],
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
