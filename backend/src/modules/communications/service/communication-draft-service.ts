import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { createPageMeta } from "../../../shared/http/list-query.js";
import type {
  Channel,
  CommunicationTemplatePolicy,
  CommunicationType,
  DeliveryStrategy,
  Priority,
  TargetType,
  WindowsAgentPresentation,
} from "./communication-template-service.js";
import { CommunicationTemplateService } from "./communication-template-service.js";

type CommunicationStatus =
  | "Draft"
  | "Scheduled"
  | "Queued"
  | "Sending"
  | "Active"
  | "Completed"
  | "Cancelled"
  | "Failed";

type WorkflowSummary = {
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

type TargetRule = {
  targetType: TargetType;
  targetValue: string;
};

type CreateCommunicationDraftInput = {
  communicationType: CommunicationType;
  priority: Priority;
  category?: string | null;
  templateId?: string | null;
  title: string;
  body: string;
  channelSelections: Channel[];
  targets: TargetRule[];
  workflowId?: string | null;
  windowsAgentPresentation?: WindowsAgentPresentation | null;
  deliveryStrategy?: DeliveryStrategy | null;
  confirmLockedFieldPolicy?: boolean | null;
};

type UpdateCommunicationDraftInput = {
  category?: string | null;
  templateId?: string | null;
  title?: string;
  body?: string;
  channelSelections?: Channel[];
  targets?: TargetRule[];
  workflowId?: string | null;
  windowsAgentPresentation?: WindowsAgentPresentation | null;
  deliveryStrategy?: DeliveryStrategy | null;
};

type ListCommunicationOptions = {
  page: number;
  pageSize: number;
  search?: string;
  status?: CommunicationStatus;
  communicationType?: CommunicationType;
  priority?: Priority;
  templateId?: string;
};

type CommunicationSummaryRow = {
  id: string;
  communicationType: CommunicationType;
  priority: Priority;
  title: string;
  status: CommunicationStatus;
  scheduledAt: string | null;
  templateId: string | null;
  templateVersion: number | null;
  channelSelections: unknown;
};

type CommunicationDetailRow = CommunicationSummaryRow & {
  category: string | null;
  body: string;
  requiresResponse: boolean;
  workflowId: string | null;
  windowsAgentPresentation: WindowsAgentPresentation | null;
  deliveryStrategy: DeliveryStrategy | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type WorkflowRow = {
  id: string;
  name: string;
  allowFreeText: boolean;
  requireFreeText: boolean;
  escalationTimeoutMinutes: number | null;
  escalationMode: "RecipientOnly" | null;
  responseImpliesAck: boolean;
};

type WorkflowOptionRow = {
  key: string;
  label: string;
};

type CommunicationWriteModel = {
  templateId: string | null;
  templateVersion: number | null;
  communicationType: CommunicationType;
  priority: Priority;
  category: string | null;
  title: string;
  body: string;
  channelSelections: Channel[];
  requiresResponse: boolean;
  workflowId: string | null;
  windowsAgentPresentation: WindowsAgentPresentation | null;
  deliveryStrategy: DeliveryStrategy | null;
  targets: TargetRule[];
};

export class CommunicationDraftService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly templateService: CommunicationTemplateService,
  ) {}

  async listCommunications(options: ListCommunicationOptions) {
    const where = buildCommunicationListWhereClause(options);
    const params = buildPaginationParams(options, where.params);

    const [rows, totalRows] = await Promise.all([
      this.database.query<CommunicationSummaryRow>(
        `
          select
            id::text as id,
            communication_type::text as "communicationType",
            priority::text as priority,
            title::text as title,
            status::text as status,
            scheduled_at::text as "scheduledAt",
            template_id::text as "templateId",
            template_version as "templateVersion",
            channel_selections_json as "channelSelections"
          from public.communications
          ${where.clause}
          order by updated_at desc, created_at desc
          limit $${params.limitIndex}
          offset $${params.offsetIndex}
        `,
        params.values,
      ),
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.communications
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        communicationType: row.communicationType,
        priority: row.priority,
        title: row.title,
        status: row.status,
        scheduledAt: row.scheduledAt,
        templateId: row.templateId,
        templateVersion: row.templateVersion,
        channelSelections: normalizeChannelArray(row.channelSelections),
      })),
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: totalRows[0]?.totalItems ?? 0,
      }),
    };
  }

  async createDraft(input: CreateCommunicationDraftInput) {
    const writeModel = await this.resolveWriteModelForCreate(input);
    const insertedRows = await this.database.query<{ id: string }>(
      `
        insert into public.communications (
          template_id,
          template_version,
          communication_type,
          priority,
          category,
          title,
          body,
          channel_selections_json,
          status,
          requires_response,
          workflow_id,
          windows_agent_presentation,
          delivery_strategy
        )
        values (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          'Draft',
          $9,
          $10::uuid,
          $11,
          $12
        )
        returning id::text as id
      `,
      [
        writeModel.templateId,
        writeModel.templateVersion,
        writeModel.communicationType,
        writeModel.priority,
        writeModel.category,
        writeModel.title,
        writeModel.body,
        JSON.stringify(writeModel.channelSelections),
        writeModel.requiresResponse,
        writeModel.workflowId,
        writeModel.windowsAgentPresentation,
        writeModel.deliveryStrategy,
      ],
    );
    const communicationId = insertedRows[0]?.id;
    if (!communicationId) {
      throw new AppError({
        statusCode: 500,
        code: "COMMUNICATION_CREATE_FAILED",
        message: "The communication draft could not be created.",
      });
    }

    await this.replaceTargets(communicationId, writeModel.targets);
    return this.getCommunicationDetail(communicationId);
  }

  async getCommunicationDetail(communicationId: string) {
    const detail = await this.getCommunicationDetailRow(communicationId);
    if (!detail) {
      throw new AppError({
        statusCode: 404,
        code: "COMMUNICATION_NOT_FOUND",
        message: "The requested communication was not found.",
      });
    }

    return this.serializeCommunicationDetail(detail);
  }

  async updateDraft(communicationId: string, input: UpdateCommunicationDraftInput) {
    const existing = await this.getCommunicationDetailRow(communicationId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "COMMUNICATION_NOT_FOUND",
        message: "The requested communication was not found.",
      });
    }

    assertDraftStatus(existing.status);
    const existingTargets = await this.listTargets(communicationId);
    const writeModel = await this.resolveWriteModelForUpdate(existing, existingTargets, input);

    await this.database.query(
      `
        update public.communications
        set
          template_id = $2::uuid,
          template_version = $3,
          category = $4,
          title = $5,
          body = $6,
          channel_selections_json = $7::jsonb,
          requires_response = $8,
          workflow_id = $9::uuid,
          windows_agent_presentation = $10,
          delivery_strategy = $11
        where id::text = $1
      `,
      [
        communicationId,
        writeModel.templateId,
        writeModel.templateVersion,
        writeModel.category,
        writeModel.title,
        writeModel.body,
        JSON.stringify(writeModel.channelSelections),
        writeModel.requiresResponse,
        writeModel.workflowId,
        writeModel.windowsAgentPresentation,
        writeModel.deliveryStrategy,
      ],
    );

    await this.replaceTargets(communicationId, writeModel.targets);
    return this.getCommunicationDetail(communicationId);
  }

  async duplicateDraft(communicationId: string) {
    const existing = await this.getCommunicationDetailRow(communicationId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "COMMUNICATION_NOT_FOUND",
        message: "The requested communication was not found.",
      });
    }

    const targets = await this.listTargets(communicationId);
    const insertedRows = await this.database.query<{ id: string }>(
      `
        insert into public.communications (
          template_id,
          template_version,
          communication_type,
          priority,
          category,
          title,
          body,
          channel_selections_json,
          status,
          requires_response,
          workflow_id,
          windows_agent_presentation,
          delivery_strategy
        )
        values (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          'Draft',
          $9,
          $10::uuid,
          $11,
          $12
        )
        returning id::text as id
      `,
      [
        existing.templateId,
        existing.templateVersion,
        existing.communicationType,
        existing.priority,
        existing.category,
        existing.title,
        existing.body,
        JSON.stringify(normalizeChannelArray(existing.channelSelections)),
        existing.requiresResponse,
        existing.workflowId,
        existing.windowsAgentPresentation,
        existing.deliveryStrategy,
      ],
    );
    const duplicatedId = insertedRows[0]?.id;
    if (!duplicatedId) {
      throw new AppError({
        statusCode: 500,
        code: "COMMUNICATION_DUPLICATE_FAILED",
        message: "The communication draft could not be duplicated.",
      });
    }

    await this.replaceTargets(duplicatedId, targets);
    return this.getCommunicationDetail(duplicatedId);
  }

  private async serializeCommunicationDetail(detail: CommunicationDetailRow) {
    const [targets, workflow] = await Promise.all([
      this.listTargets(detail.id),
      detail.workflowId ? this.getWorkflowSummary(detail.workflowId) : Promise.resolve(null),
    ]);

    return {
      id: detail.id,
      communicationType: detail.communicationType,
      priority: detail.priority,
      title: detail.title,
      status: detail.status,
      scheduledAt: detail.scheduledAt,
      templateId: detail.templateId,
      templateVersion: detail.templateVersion,
      channelSelections: normalizeChannelArray(detail.channelSelections),
      body: detail.body,
      category: detail.category,
      requiresResponse: detail.requiresResponse,
      windowsAgentPresentation: detail.windowsAgentPresentation,
      deliveryStrategy: detail.deliveryStrategy,
      workflow,
      targets,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  }

  private async getCommunicationDetailRow(communicationId: string) {
    const rows = await this.database.query<CommunicationDetailRow>(
      `
        select
          id::text as id,
          communication_type::text as "communicationType",
          priority::text as priority,
          title::text as title,
          status::text as status,
          scheduled_at::text as "scheduledAt",
          template_id::text as "templateId",
          template_version as "templateVersion",
          channel_selections_json as "channelSelections",
          category::text as category,
          body::text as body,
          requires_response as "requiresResponse",
          workflow_id::text as "workflowId",
          windows_agent_presentation::text as "windowsAgentPresentation",
          delivery_strategy::text as "deliveryStrategy",
          created_at::text as "createdAt",
          updated_at::text as "updatedAt"
        from public.communications
        where id::text = $1
        limit 1
      `,
      [communicationId],
    );

    return rows[0];
  }

  private async listTargets(communicationId: string) {
    const rows = await this.database.query<TargetRule>(
      `
        select
          target_type::text as "targetType",
          target_value::text as "targetValue"
        from public.communication_targets
        where communication_id::text = $1
        order by sort_order asc, created_at asc
      `,
      [communicationId],
    );

    return rows;
  }

  private async replaceTargets(communicationId: string, targets: TargetRule[]) {
    await this.database.query(`delete from public.communication_targets where communication_id::text = $1`, [
      communicationId,
    ]);

    for (const [index, target] of targets.entries()) {
      await this.database.query(
        `
          insert into public.communication_targets (
            communication_id,
            target_type,
            target_value,
            sort_order
          )
          values ($1::uuid, $2, $3, $4)
        `,
        [communicationId, target.targetType, target.targetValue, index + 1],
      );
    }
  }

  private async getWorkflowSummary(workflowId: string): Promise<WorkflowSummary | null> {
    const workflowRows = await this.database.query<WorkflowRow>(
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
    const workflow = workflowRows[0];
    if (!workflow) {
      return null;
    }

    const optionRows = await this.database.query<WorkflowOptionRow>(
      `
        select
          option_key::text as key,
          option_label::text as label
        from public.response_workflow_options
        where workflow_id::text = $1
        order by sort_order asc, option_key asc
      `,
      [workflowId],
    );

    return {
      id: workflow.id,
      name: workflow.name,
      allowFreeText: workflow.allowFreeText,
      requireFreeText: workflow.requireFreeText,
      escalationTimeoutMinutes: workflow.escalationTimeoutMinutes,
      escalationMode: workflow.escalationMode,
      responseImpliesAck: workflow.responseImpliesAck,
      options: optionRows.map((option) => ({
        key: option.key,
        label: option.label,
      })),
    };
  }

  private async resolveWriteModelForCreate(
    input: CreateCommunicationDraftInput,
  ): Promise<CommunicationWriteModel> {
    const template = input.templateId ? await this.templateService.getTemplateById(input.templateId) : null;

    const communicationType = template?.communicationType ?? input.communicationType;
    if (template && input.communicationType !== template.communicationType) {
      throw new AppError({
        statusCode: 422,
        code: "TEMPLATE_COMMUNICATION_TYPE_MISMATCH",
        message: "The selected template cannot be used with a different communication type.",
      });
    }

    return this.validateAndBuildWriteModel({
      communicationType,
      priority: input.priority,
      category: input.category ?? null,
      template,
      title: input.title,
      body: input.body,
      channelSelections: input.channelSelections,
      targets: input.targets,
      workflowId: input.workflowId ?? null,
      windowsAgentPresentation: input.windowsAgentPresentation ?? null,
      deliveryStrategy: input.deliveryStrategy ?? null,
    });
  }

  private async resolveWriteModelForUpdate(
    existing: CommunicationDetailRow,
    existingTargets: TargetRule[],
    input: UpdateCommunicationDraftInput,
  ): Promise<CommunicationWriteModel> {
    const templateId =
      input.templateId === undefined ? existing.templateId : input.templateId;
    const template = templateId ? await this.templateService.getTemplateById(templateId) : null;

    return this.validateAndBuildWriteModel({
      communicationType: existing.communicationType,
      priority: existing.priority,
      category: input.category === undefined ? existing.category : input.category,
      template,
      title: input.title ?? existing.title,
      body: input.body ?? existing.body,
      channelSelections:
        input.channelSelections ?? normalizeChannelArray(existing.channelSelections),
      targets: input.targets ?? existingTargets,
      workflowId: input.workflowId === undefined ? existing.workflowId : input.workflowId,
      windowsAgentPresentation:
        input.windowsAgentPresentation === undefined
          ? existing.windowsAgentPresentation
          : input.windowsAgentPresentation,
      deliveryStrategy:
        input.deliveryStrategy === undefined ? existing.deliveryStrategy : input.deliveryStrategy,
    });
  }

  private async validateAndBuildWriteModel(input: {
    communicationType: CommunicationType;
    priority: Priority;
    category: string | null;
    template: CommunicationTemplatePolicy | null;
    title: string;
    body: string;
    channelSelections: Channel[];
    targets: TargetRule[];
    workflowId: string | null;
    windowsAgentPresentation: WindowsAgentPresentation | null;
    deliveryStrategy: DeliveryStrategy | null;
  }): Promise<CommunicationWriteModel> {
    validateTargets(input.targets);
    validateChannelSelections(input.channelSelections);

    const template = input.template;
    const finalWorkflowId = template?.defaultWorkflowId ?? input.workflowId;
    const finalWindowsAgentPresentation =
      template?.defaultWindowsAgentPresentation ?? input.windowsAgentPresentation;
    const finalDeliveryStrategy = template?.defaultDeliveryStrategy ?? input.deliveryStrategy;
    const requiresResponse = template?.defaultRequiresResponse ?? false;

    if (template) {
      validateAllowedTargetTypes(template, input.targets);
      validateMandatoryChannels(template, input.channelSelections);
      validateTemplateLockedField("priority", template, input.priority, template.defaultPriority);
      validateTemplateLockedField(
        "workflowId",
        template,
        finalWorkflowId,
        template.defaultWorkflowId,
      );
      validateTemplateLockedField(
        "deliveryStrategy",
        template,
        finalDeliveryStrategy,
        template.defaultDeliveryStrategy,
      );
      validateTemplateLockedField(
        "windowsAgentPresentation",
        template,
        finalWindowsAgentPresentation,
        template.defaultWindowsAgentPresentation,
      );

      if (template.lockedFields.includes("channelSelections")) {
        const allowedChannels = new Set([...template.mandatoryChannels, ...template.optionalChannels]);
        const hasUnsupportedChannel = input.channelSelections.some((channel) => !allowedChannels.has(channel));
        if (hasUnsupportedChannel) {
          throw new AppError({
            statusCode: 422,
            code: "TEMPLATE_CHANNEL_OVERRIDE_REJECTED",
            message: "The selected channels override a template-locked channel policy.",
          });
        }
      }
    }

    if (requiresResponse && !finalWorkflowId) {
      throw new AppError({
        statusCode: 422,
        code: "WORKFLOW_REQUIRED",
        message: "A workflow is required for this communication template.",
      });
    }

    if (finalWorkflowId) {
      await assertWorkflowExists(this.database, finalWorkflowId);
    }

    return {
      templateId: template?.id ?? null,
      templateVersion: template?.version ?? null,
      communicationType: input.communicationType,
      priority: input.priority,
      category: normalizeNullableText(input.category),
      title: input.title.trim(),
      body: input.body.trim(),
      channelSelections: dedupeChannels(input.channelSelections),
      requiresResponse,
      workflowId: finalWorkflowId,
      windowsAgentPresentation: finalWindowsAgentPresentation,
      deliveryStrategy: finalDeliveryStrategy,
      targets: input.targets.map((target) => ({
        targetType: target.targetType,
        targetValue: target.targetValue.trim(),
      })),
    };
  }
}

function normalizeNullableText(value: string | null) {
  const trimmed = value?.trim() ?? null;
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function validateTargets(targets: TargetRule[]) {
  if (targets.length === 0) {
    throw new AppError({
      statusCode: 422,
      code: "TARGET_REQUIRED",
      message: "At least one target rule is required.",
    });
  }

  for (const target of targets) {
    if (!target.targetValue.trim()) {
      throw new AppError({
        statusCode: 422,
        code: "TARGET_VALUE_REQUIRED",
        message: "Target values must not be empty.",
      });
    }
  }
}

function validateChannelSelections(channels: Channel[]) {
  if (channels.length === 0) {
    throw new AppError({
      statusCode: 422,
      code: "CHANNEL_REQUIRED",
      message: "At least one delivery channel must be selected.",
    });
  }
}

function validateAllowedTargetTypes(template: CommunicationTemplatePolicy, targets: TargetRule[]) {
  if (template.allowedTargetTypes.length === 0) {
    return;
  }

  const allowedTargetTypes = new Set(template.allowedTargetTypes);
  const invalidTarget = targets.find((target) => !allowedTargetTypes.has(target.targetType));
  if (!invalidTarget) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "TARGET_TYPE_NOT_ALLOWED",
    message: `Target type "${invalidTarget.targetType}" is not allowed by the selected template.`,
  });
}

function validateMandatoryChannels(template: CommunicationTemplatePolicy, channels: Channel[]) {
  const selectedChannels = new Set(channels);
  const missingMandatoryChannel = template.mandatoryChannels.find(
    (channel) => !selectedChannels.has(channel),
  );
  if (!missingMandatoryChannel) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "MANDATORY_CHANNEL_REQUIRED",
    message: `The selected template requires channel "${missingMandatoryChannel}".`,
  });
}

function validateTemplateLockedField(
  lockedFieldName: string,
  template: CommunicationTemplatePolicy,
  candidateValue: string | null,
  lockedValue: string | null,
) {
  if (!template.lockedFields.includes(lockedFieldName)) {
    return;
  }

  if ((candidateValue ?? null) === (lockedValue ?? null)) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "LOCKED_TEMPLATE_FIELD_OVERRIDE",
    message: `The field "${lockedFieldName}" is locked by the selected template.`,
  });
}

function normalizeChannelArray(value: unknown): Channel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((channel): channel is Channel => typeof channel === "string");
}

function dedupeChannels(channels: Channel[]) {
  return [...new Set(channels)];
}

function assertDraftStatus(status: CommunicationStatus) {
  if (status === "Draft") {
    return;
  }

  throw new AppError({
    statusCode: 409,
    code: "COMMUNICATION_NOT_DRAFT",
    message: "Only draft communications may be updated.",
  });
}

async function assertWorkflowExists(database: DatabaseClient, workflowId: string) {
  const rows = await database.query<{ id: string }>(
    `
      select id::text as id
      from public.response_workflows
      where id::text = $1
      limit 1
    `,
    [workflowId],
  );

  if (rows[0]) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "WORKFLOW_NOT_FOUND",
    message: "The selected workflow does not exist.",
  });
}

function buildCommunicationListWhereClause(options: ListCommunicationOptions) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.status) {
    params.push(options.status);
    conditions.push(`status::text = $${params.length}`);
  }

  if (options.communicationType) {
    params.push(options.communicationType);
    conditions.push(`communication_type::text = $${params.length}`);
  }

  if (options.priority) {
    params.push(options.priority);
    conditions.push(`priority::text = $${params.length}`);
  }

  if (options.templateId) {
    params.push(options.templateId);
    conditions.push(`template_id::text = $${params.length}`);
  }

  if (options.search) {
    const term = `%${options.search}%`;
    params.push(term, term, term);
    conditions.push(
      `(title::text ilike $${params.length - 2} or body::text ilike $${params.length - 1} or category::text ilike $${params.length})`,
    );
  }

  return {
    clause: conditions.length > 0 ? `where ${conditions.join(" and ")}` : "",
    params,
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
