import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { createPageMeta } from "../../../shared/http/list-query.js";
import type { AgentService } from "../../agent/service/agent-service.js";
import type {
  ChannelPlanItem,
  ExecutionAudienceResolution,
} from "./audience-preview-service.js";
import { AudiencePreviewService } from "./audience-preview-service.js";
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

type PublishMode = "Now" | "Scheduled" | "Recurring";
type ScheduleExecutionMode = "ServerGenerated" | "AgentLocalRoutine";

type PublishCommunicationInput = {
  publishMode: PublishMode;
  scheduledAt?: string | null;
  recurrenceRule?: string | null;
  timezone?: string | null;
  executionMode?: ScheduleExecutionMode | null;
  validUntil?: string | null;
  confirmedPreview: boolean;
};

type PublicationActor = {
  userIdentifier: string;
  username: string;
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
    private readonly audiencePreviewService: AudiencePreviewService,
    private readonly agentService: AgentService,
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

  async publishCommunication(
    communicationId: string,
    input: PublishCommunicationInput,
    actor: PublicationActor,
  ) {
    const existing = await this.getCommunicationDetailRow(communicationId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "COMMUNICATION_NOT_FOUND",
        message: "The requested communication was not found.",
      });
    }

    assertDraftStatus(existing.status, "published");

    const targets = await this.listTargets(communicationId);
    validateTargets(targets);

    const channelSelections = normalizeChannelArray(existing.channelSelections);
    validateChannelSelections(channelSelections);
    validatePublishRequest(existing, input, channelSelections);

    const template = await this.resolveActiveTemplatePolicy(existing);
    validatePublishTemplatePolicy({
      communication: existing,
      template,
      targets,
      channelSelections,
    });
    const executionAudience = await this.audiencePreviewService.resolveExecutionAudience(
      communicationId,
    );
    validateAgentLocalRoutineAudience(input, executionAudience);
    const workflowSnapshot = existing.workflowId
      ? await this.getWorkflowSummary(existing.workflowId)
      : null;
    const templatePolicySnapshot = buildTemplatePolicySnapshot({
      communication: existing,
      template,
      workflow: workflowSnapshot,
      selectedChannels: executionAudience.selectedChannels,
      channelPlan: executionAudience.channelPlan,
    });

    const acceptedAt = new Date().toISOString();
    await this.database.withTransaction(async (transaction) => {
      await deactivateActiveSchedules(transaction, communicationId, acceptedAt);

      if (input.publishMode === "Now") {
        await transaction.query(
          `
            update public.communications
            set
              status = 'Queued',
              published_at = $2::timestamptz,
              scheduled_at = null,
              cancelled_at = null
            where id::text = $1
          `,
          [communicationId, acceptedAt],
        );

        const scheduleId = await insertCommunicationSchedule(transaction, {
          communicationId,
          scheduleType: "Immediate",
          scheduledAt: null,
          recurrenceRule: null,
          timezone: null,
          executionMode: null,
          validFrom: acceptedAt,
          validUntil: null,
          publishRequest: input,
          actor,
          requestedAt: acceptedAt,
        });

        await persistPublishExecutionFoundation(transaction, {
          communicationId,
          communicationScheduleId: scheduleId,
          acceptedAt,
          recipients: executionAudience,
          communication: existing,
          workflowSnapshot,
          templatePolicySnapshot,
        });

        return;
      }

      if (input.publishMode === "Scheduled") {
        await transaction.query(
          `
            update public.communications
            set
              status = 'Scheduled',
              scheduled_at = $2::timestamptz,
              cancelled_at = null
            where id::text = $1
          `,
          [communicationId, input.scheduledAt ?? null],
        );

        const scheduleId = await insertCommunicationSchedule(transaction, {
          communicationId,
          scheduleType: "Scheduled",
          scheduledAt: input.scheduledAt ?? null,
          recurrenceRule: null,
          timezone: input.timezone ?? null,
          executionMode: null,
          validFrom: input.scheduledAt ?? null,
          validUntil: null,
          publishRequest: input,
          actor,
          requestedAt: acceptedAt,
        });

        await persistPublishExecutionFoundation(transaction, {
          communicationId,
          communicationScheduleId: scheduleId,
          acceptedAt,
          recipients: executionAudience,
          communication: existing,
          workflowSnapshot,
          templatePolicySnapshot,
        });

        return;
      }

      await transaction.query(
        `
          update public.communications
          set
            status = 'Scheduled',
            scheduled_at = $2::timestamptz,
            cancelled_at = null
          where id::text = $1
        `,
        [communicationId, input.scheduledAt ?? null],
      );

      const scheduleId = await insertCommunicationSchedule(transaction, {
        communicationId,
        scheduleType: "Recurring",
        scheduledAt: input.scheduledAt ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
        timezone: input.timezone ?? null,
        executionMode: input.executionMode ?? null,
        validFrom: input.scheduledAt ?? acceptedAt,
        validUntil: input.validUntil ?? null,
        publishRequest: input,
        actor,
        requestedAt: acceptedAt,
      });

      await persistPublishExecutionFoundation(transaction, {
        communicationId,
        communicationScheduleId: scheduleId,
        acceptedAt,
        recipients: executionAudience,
        communication: existing,
        workflowSnapshot,
        templatePolicySnapshot,
      });

      await materializeAgentReminderPolicies(transaction, {
        communicationScheduleId: scheduleId,
        communicationId,
        executionMode: input.executionMode ?? null,
        recipients: executionAudience,
        communication: existing,
        scheduleVersion: 1,
        recurrenceRule: input.recurrenceRule ?? null,
        timezone: input.timezone ?? null,
        validFrom: input.scheduledAt ?? acceptedAt,
        validUntil: input.validUntil ?? null,
      });
    });

    if (input.publishMode === "Now") {
      await this.agentService.notifyPendingMessagesForDevices(
        collectWindowsAgentDeviceIds(executionAudience.recipients),
      );
    }

    return this.getCommunicationDetail(communicationId);
  }

  async cancelCommunication(communicationId: string) {
    const existing = await this.getCommunicationDetailRow(communicationId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "COMMUNICATION_NOT_FOUND",
        message: "The requested communication was not found.",
      });
    }

    assertCancelableStatus(existing.status);
    const cancelledAt = new Date().toISOString();

    await this.database.withTransaction(async (transaction) => {
      await deactivateActiveSchedules(transaction, communicationId, cancelledAt);
      await markDeliveryJobsCancelled(transaction, communicationId, cancelledAt);
      await transaction.query(
        `
          update public.communications
          set
            status = 'Cancelled',
            cancelled_at = $2::timestamptz
          where id::text = $1
        `,
        [communicationId, cancelledAt],
      );
    });

    return this.getCommunicationDetail(communicationId);
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

  private async resolveActiveTemplatePolicy(detail: CommunicationDetailRow) {
    if (!detail.templateId) {
      if (detail.deliveryStrategy === "TemplatePolicy") {
        throw new AppError({
          statusCode: 422,
          code: "TEMPLATE_POLICY_REFERENCE_REQUIRED",
          message:
            "A communication using TemplatePolicy delivery strategy must reference an active template.",
        });
      }

      return null;
    }

    const template = await this.templateService.findTemplateById(detail.templateId);
    if (template) {
      return template;
    }

    throw new AppError({
      statusCode: 409,
      code: "TEMPLATE_POLICY_UNAVAILABLE",
      message:
        "The referenced communication template is not currently available for publish-time policy validation.",
    });
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

function assertDraftStatus(status: CommunicationStatus, action = "updated") {
  if (status === "Draft") {
    return;
  }

  throw new AppError({
    statusCode: 409,
    code: "COMMUNICATION_NOT_DRAFT",
    message: `Only draft communications may be ${action}.`,
  });
}

function assertCancelableStatus(status: CommunicationStatus) {
  if (["Scheduled", "Queued", "Sending", "Active"].includes(status)) {
    return;
  }

  throw new AppError({
    statusCode: 409,
    code: "COMMUNICATION_CANNOT_BE_CANCELLED",
    message: "Only scheduled or active communications may be cancelled.",
  });
}

function validatePublishRequest(
  communication: CommunicationDetailRow,
  input: PublishCommunicationInput,
  channelSelections: Channel[],
) {
  if (input.confirmedPreview !== true) {
    throw new AppError({
      statusCode: 422,
      code: "PREVIEW_CONFIRMATION_REQUIRED",
      message: "Publish requests must confirm the latest audience preview before continuing.",
    });
  }

  const scheduledAt = parseOptionalIsoDate(input.scheduledAt, "scheduledAt");
  const validUntil = parseOptionalIsoDate(input.validUntil, "validUntil");
  const recurrenceRule = normalizeNullableText(input.recurrenceRule ?? null);
  const timezone = normalizeNullableText(input.timezone ?? null);
  const now = new Date();

  switch (input.publishMode) {
    case "Now": {
      assertPublishFieldAbsent(scheduledAt, "scheduledAt", input.publishMode);
      assertPublishFieldAbsent(recurrenceRule, "recurrenceRule", input.publishMode);
      assertPublishFieldAbsent(timezone, "timezone", input.publishMode);
      assertPublishFieldAbsent(input.executionMode ?? null, "executionMode", input.publishMode);
      assertPublishFieldAbsent(validUntil, "validUntil", input.publishMode);
      return;
    }
    case "Scheduled": {
      if (!scheduledAt) {
        throw new AppError({
          statusCode: 422,
          code: "SCHEDULED_AT_REQUIRED",
          message: "Scheduled publish mode requires a scheduledAt timestamp.",
        });
      }
      if (scheduledAt <= now) {
        throw new AppError({
          statusCode: 422,
          code: "SCHEDULED_AT_IN_PAST",
          message: "Scheduled publish mode requires a future scheduledAt timestamp.",
        });
      }
      if (!timezone) {
        throw new AppError({
          statusCode: 422,
          code: "TIMEZONE_REQUIRED",
          message: "Scheduled publish mode requires a timezone value.",
        });
      }
      assertValidTimeZone(timezone);
      assertPublishFieldAbsent(recurrenceRule, "recurrenceRule", input.publishMode);
      assertPublishFieldAbsent(input.executionMode ?? null, "executionMode", input.publishMode);
      assertPublishFieldAbsent(validUntil, "validUntil", input.publishMode);
      return;
    }
    case "Recurring": {
      if (communication.communicationType !== "Reminder") {
        throw new AppError({
          statusCode: 422,
          code: "RECURRING_ONLY_FOR_REMINDERS",
          message: "Recurring publication is currently supported only for reminder communications.",
        });
      }
      if (!recurrenceRule) {
        throw new AppError({
          statusCode: 422,
          code: "RECURRENCE_RULE_REQUIRED",
          message: "Recurring publish mode requires a recurrenceRule value.",
        });
      }
      if (!timezone) {
        throw new AppError({
          statusCode: 422,
          code: "TIMEZONE_REQUIRED",
          message: "Recurring publish mode requires a timezone value.",
        });
      }
      if (!input.executionMode) {
        throw new AppError({
          statusCode: 422,
          code: "EXECUTION_MODE_REQUIRED",
          message: "Recurring publish mode requires an executionMode value.",
        });
      }
      assertValidTimeZone(timezone);
      if (scheduledAt && scheduledAt <= now) {
        throw new AppError({
          statusCode: 422,
          code: "SCHEDULED_AT_IN_PAST",
          message: "Recurring publish mode requires scheduledAt to be in the future when provided.",
        });
      }
      if (validUntil) {
        const effectiveStart = scheduledAt ?? now;
        if (validUntil <= effectiveStart) {
          throw new AppError({
            statusCode: 422,
            code: "VALID_UNTIL_INVALID",
            message: "validUntil must be later than the recurring schedule start.",
          });
        }
      }
      if (
        input.executionMode === "AgentLocalRoutine" &&
        !channelSelections.includes("WindowsAgent")
      ) {
        throw new AppError({
          statusCode: 422,
          code: "WINDOWS_AGENT_CHANNEL_REQUIRED",
          message:
            "AgentLocalRoutine execution mode requires the WindowsAgent channel to remain selected.",
        });
      }
      return;
    }
  }
}

function validatePublishTemplatePolicy(options: {
  communication: CommunicationDetailRow;
  template: CommunicationTemplatePolicy | null;
  targets: TargetRule[];
  channelSelections: Channel[];
}) {
  const { communication, template, targets, channelSelections } = options;

  if (communication.requiresResponse && !communication.workflowId) {
    throw new AppError({
      statusCode: 422,
      code: "WORKFLOW_REQUIRED",
      message: "A workflow is required for this communication before publishing.",
    });
  }

  if (!template) {
    return;
  }

  validateAllowedTargetTypes(template, targets);
  validateMandatoryChannels(template, channelSelections);
  validateTemplateLockedField("priority", template, communication.priority, template.defaultPriority);
  validateTemplateLockedField(
    "workflowId",
    template,
    communication.workflowId,
    template.defaultWorkflowId,
  );
  validateTemplateLockedField(
    "deliveryStrategy",
    template,
    communication.deliveryStrategy,
    template.defaultDeliveryStrategy,
  );
  validateTemplateLockedField(
    "windowsAgentPresentation",
    template,
    communication.windowsAgentPresentation,
    template.defaultWindowsAgentPresentation,
  );

  if (template.lockedFields.includes("channelSelections")) {
    const allowedChannels = new Set([...template.mandatoryChannels, ...template.optionalChannels]);
    const hasUnsupportedChannel = channelSelections.some((channel) => !allowedChannels.has(channel));
    if (hasUnsupportedChannel) {
      throw new AppError({
        statusCode: 422,
        code: "TEMPLATE_CHANNEL_OVERRIDE_REJECTED",
        message: "The selected channels override a template-locked channel policy.",
      });
    }
  }

  if (
    template.dualPathRule?.enabled &&
    template.dualPathRule.mode === "DesktopFirstShortDelayWhatsApp" &&
    channelSelections.includes("WhatsApp") &&
    !channelSelections.includes("WindowsAgent")
  ) {
    throw new AppError({
      statusCode: 422,
      code: "DUAL_PATH_WINDOWS_AGENT_REQUIRED",
      message:
        "Desktop-first dual-path execution requires the WindowsAgent channel when WhatsApp follow-up is selected.",
    });
  }
}

function assertPublishFieldAbsent(value: unknown, field: string, publishMode: PublishMode) {
  if (value === null || value === undefined) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "PUBLISH_FIELD_NOT_ALLOWED",
    message: `${field} is not allowed when publishMode is ${publishMode}.`,
  });
}

function parseOptionalIsoDate(value: string | null | undefined, field: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_DATE_TIME",
      message: `${field} must be a valid ISO 8601 date-time value.`,
    });
  }

  return parsed;
}

function assertValidTimeZone(timezone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_TIMEZONE",
      message: "timezone must be a valid IANA time zone identifier.",
    });
  }
}

async function insertCommunicationSchedule(
  transaction: TransactionClient,
  options: {
    communicationId: string;
    scheduleType: "Immediate" | "Scheduled" | "Recurring";
    scheduledAt: string | null;
    recurrenceRule: string | null;
    timezone: string | null;
    executionMode: ScheduleExecutionMode | null;
    validFrom: string | null;
    validUntil: string | null;
    publishRequest: PublishCommunicationInput;
    actor: PublicationActor;
    requestedAt: string;
  },
) {
  const rows = await transaction.query<{ id: string }>(
    `
      insert into public.communication_schedules (
        communication_id,
        schedule_type,
        scheduled_at,
        recurrence_rule,
        timezone,
        execution_mode,
        valid_from,
        valid_until,
        publish_request_json,
        requested_by_user_identifier,
        requested_by_username,
        requested_at
      )
      values (
        $1::uuid,
        $2,
        $3::timestamptz,
        $4,
        $5,
        $6,
        $7::timestamptz,
        $8::timestamptz,
        $9::jsonb,
        $10,
        $11,
        $12::timestamptz
      )
      returning id::text as id
    `,
    [
      options.communicationId,
      options.scheduleType,
      options.scheduledAt,
      options.recurrenceRule,
      options.timezone,
      options.executionMode,
      options.validFrom,
      options.validUntil,
      JSON.stringify(options.publishRequest),
      options.actor.userIdentifier,
      options.actor.username,
      options.requestedAt,
    ],
  );

  const scheduleId = rows[0]?.id;
  if (!scheduleId) {
    throw new AppError({
      statusCode: 500,
      code: "COMMUNICATION_SCHEDULE_CREATE_FAILED",
      message: "The publish schedule could not be persisted.",
    });
  }

  return scheduleId;
}

function buildTemplatePolicySnapshot(options: {
  communication: CommunicationDetailRow;
  template: CommunicationTemplatePolicy | null;
  workflow: WorkflowSummary | null;
  selectedChannels: Channel[];
  channelPlan: ChannelPlanItem[];
}) {
  return {
    templateId: options.template?.id ?? options.communication.templateId,
    templateVersion: options.communication.templateVersion,
    workflowId: options.communication.workflowId,
    workflow: options.workflow,
    communicationType: options.communication.communicationType,
    priority: options.communication.priority,
    requiresResponse: options.communication.requiresResponse,
    windowsAgentPresentation: options.communication.windowsAgentPresentation,
    deliveryStrategy: options.communication.deliveryStrategy,
    criticalBehaviorMode: options.template?.criticalBehaviorMode ?? null,
    defaultChannels: options.template?.defaultChannels ?? [],
    mandatoryChannels: options.template?.mandatoryChannels ?? [],
    optionalChannels: options.template?.optionalChannels ?? [],
    allowedTargetTypes: options.template?.allowedTargetTypes ?? [],
    lockedFields: options.template?.lockedFields ?? [],
    editableFields: options.template?.editableFields ?? [],
    dualPathRule: options.template?.dualPathRule ?? null,
    selectedChannels: options.selectedChannels,
    channelPlan: options.channelPlan,
  };
}

async function persistPublishExecutionFoundation(
  transaction: TransactionClient,
  options: {
    communicationId: string;
    communicationScheduleId: string;
    acceptedAt: string;
    recipients: ExecutionAudienceResolution;
    communication: CommunicationDetailRow;
    workflowSnapshot: WorkflowSummary | null;
    templatePolicySnapshot: ReturnType<typeof buildTemplatePolicySnapshot>;
  },
) {
  const recipientSeeds = buildRecipientSeeds({
    recipients: options.recipients,
    communication: options.communication,
  });

  for (const recipient of recipientSeeds) {
    const recipientRows = await transaction.query<{ id: string }>(
      `
        insert into public.communication_recipients (
          communication_id,
          communication_schedule_id,
          recipient_type,
          device_id,
          employee_id,
          channel_endpoint,
          site_id,
          area_id,
          site_name_snapshot,
          area_name_snapshot,
          department_name_snapshot,
          section_name_snapshot,
          recipient_name_snapshot,
          response_state,
          ack_state,
          template_version_snapshot,
          workflow_reference_id,
          workflow_snapshot_json,
          template_policy_snapshot_json
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4::uuid,
          $5::uuid,
          $6,
          $7::uuid,
          $8::uuid,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17::uuid,
          $18::jsonb,
          $19::jsonb
        )
        returning id::text as id
      `,
      [
        options.communicationId,
        options.communicationScheduleId,
        recipient.recipientType,
        recipient.deviceId,
        recipient.employeeId,
        recipient.channelEndpoint,
        recipient.siteId,
        recipient.areaId,
        recipient.siteName,
        recipient.areaName,
        recipient.departmentName,
        recipient.sectionName,
        recipient.recipientName,
        options.communication.requiresResponse ? "AwaitingResponse" : "NotRequired",
        "Pending",
        options.communication.templateVersion,
        options.communication.workflowId,
        JSON.stringify(options.workflowSnapshot),
        JSON.stringify(options.templatePolicySnapshot),
      ],
    );

    const communicationRecipientId = recipientRows[0]?.id;
    if (!communicationRecipientId) {
      throw new AppError({
        statusCode: 500,
        code: "COMMUNICATION_RECIPIENT_CREATE_FAILED",
        message: "The recipient execution snapshot could not be persisted.",
      });
    }

    for (const job of recipient.jobs) {
      const jobSnapshot = {
        ...options.templatePolicySnapshot,
        channel: job.channel,
        channelPlan: job.channelPlan,
        channelEndpoint: recipient.channelEndpoint,
      };

      const deliveryJobRows = await transaction.query<{ id: string }>(
        `
          insert into public.delivery_jobs (
            communication_id,
            communication_schedule_id,
            communication_recipient_id,
            channel,
            delivery_strategy,
            template_policy_snapshot_json,
            job_status,
            retry_limit,
            attempt_count,
            queued_at
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5,
            $6::jsonb,
            'Pending',
            $7,
            1,
            $8::timestamptz
          )
          returning id::text as id
        `,
        [
          options.communicationId,
          options.communicationScheduleId,
          communicationRecipientId,
          job.channel,
          options.communication.deliveryStrategy,
          JSON.stringify(jobSnapshot),
          job.retryLimit,
          options.acceptedAt,
        ],
      );

      const deliveryJobId = deliveryJobRows[0]?.id;
      if (!deliveryJobId) {
        throw new AppError({
          statusCode: 500,
          code: "DELIVERY_JOB_CREATE_FAILED",
          message: "The delivery job foundation could not be persisted.",
        });
      }

      await transaction.query(
        `
          insert into public.delivery_attempts (
            delivery_job_id,
            attempt_number,
            attempt_status,
            attempted_at,
            response_payload_json
          )
          values (
            $1::uuid,
            1,
            'Pending',
            $2::timestamptz,
            $3::jsonb
          )
        `,
        [
          deliveryJobId,
          options.acceptedAt,
          JSON.stringify({
            seededAt: options.acceptedAt,
            foundation: "Phase2Slice26",
          }),
        ],
      );

      await transaction.query(
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
            'Queued',
            'System',
            $2::jsonb,
            $3::timestamptz
          )
        `,
        [
          deliveryJobId,
          JSON.stringify({
            communicationRecipientId,
            channel: job.channel,
            strategy: job.channelPlan.strategy,
            plannedDelaySeconds: job.channelPlan.plannedDelaySeconds,
          }),
          options.acceptedAt,
        ],
      );
    }
  }
}

function buildRecipientSeeds(options: {
  recipients: ExecutionAudienceResolution;
  communication: CommunicationDetailRow;
}) {
  const channelPlanByChannel = new Map(
    options.recipients.channelPlan.map((item) => [item.channel, item]),
  );

  return options.recipients.recipients.flatMap((recipient) => {
    const recipientName = resolveRecipientName(recipient);
    const seeds: Array<{
      recipientType: "Device" | "Employee" | "ContactEndpoint";
      deviceId: string | null;
      employeeId: string | null;
      channelEndpoint: string | null;
      siteId: string | null;
      areaId: string | null;
      siteName: string | null;
      areaName: string | null;
      departmentName: string | null;
      sectionName: string | null;
      recipientName: string | null;
      jobs: Array<{
        channel: Channel;
        retryLimit: number;
        channelPlan: ChannelPlanItem;
      }>;
    }> = [];

    if (
      recipient.recipientType === "Device" &&
      options.recipients.selectedChannels.includes("WindowsAgent") &&
      recipient.availableChannels.includes("WindowsAgent")
    ) {
      const channelPlan = channelPlanByChannel.get("WindowsAgent");
      if (channelPlan) {
        seeds.push({
          recipientType: "Device",
          deviceId: recipient.deviceId,
          employeeId: recipient.employeeId,
          channelEndpoint:
            recipient.deviceIdentifier ?? recipient.hostname ?? recipient.deviceId ?? null,
          siteId: recipient.siteId,
          areaId: recipient.areaId,
          siteName: recipient.siteName,
          areaName: recipient.areaName,
          departmentName: recipient.departmentName,
          sectionName: recipient.sectionName,
          recipientName,
          jobs: [
            {
              channel: "WindowsAgent",
              retryLimit: determineRetryLimit("WindowsAgent"),
              channelPlan,
            },
          ],
        });
      }
    }

    if (
      recipient.recipientType === "Employee" &&
      options.recipients.selectedChannels.includes("WindowsAgent") &&
      recipient.availableChannels.includes("WindowsAgent")
    ) {
      const channelPlan = channelPlanByChannel.get("WindowsAgent");
      if (channelPlan) {
        seeds.push({
          recipientType: "Employee",
          deviceId: recipient.deviceId,
          employeeId: recipient.employeeId,
          channelEndpoint: recipient.employeeNumber ?? recipient.employeeId ?? null,
          siteId: recipient.siteId,
          areaId: recipient.areaId,
          siteName: recipient.siteName,
          areaName: recipient.areaName,
          departmentName: recipient.departmentName,
          sectionName: recipient.sectionName,
          recipientName,
          jobs: [
            {
              channel: "WindowsAgent",
              retryLimit: determineRetryLimit("WindowsAgent"),
              channelPlan,
            },
          ],
        });
      }
    }

    for (const contactChannel of ["WhatsApp", "Email"] as const) {
      if (
        !options.recipients.selectedChannels.includes(contactChannel) ||
        !recipient.availableChannels.includes(contactChannel)
      ) {
        continue;
      }

      const channelEndpoint =
        contactChannel === "WhatsApp" ? recipient.whatsappNumber : recipient.email;
      const channelPlan = channelPlanByChannel.get(contactChannel);
      if (!channelEndpoint || !channelPlan) {
        continue;
      }

      seeds.push({
        recipientType: "ContactEndpoint",
        deviceId: null,
        employeeId: recipient.employeeId,
        channelEndpoint,
        siteId: recipient.siteId,
        areaId: recipient.areaId,
        siteName: recipient.siteName,
        areaName: recipient.areaName,
        departmentName: recipient.departmentName,
        sectionName: recipient.sectionName,
        recipientName,
        jobs: [
          {
            channel: contactChannel,
            retryLimit: determineRetryLimit(contactChannel),
            channelPlan,
          },
        ],
      });
    }

    return seeds;
  });
}

function resolveRecipientName(recipient: ExecutionAudienceResolution["recipients"][number]) {
  return (
    recipient.fullName ??
    recipient.hostname ??
    recipient.deviceIdentifier ??
    recipient.employeeNumber ??
    recipient.employeeId ??
    recipient.deviceId
  );
}

function determineRetryLimit(channel: Channel) {
  switch (channel) {
    case "WindowsAgent":
      return 3;
    case "WhatsApp":
      return 2;
    case "Email":
    case "DigitalSignage":
      return 1;
  }
}

function validateAgentLocalRoutineAudience(
  input: PublishCommunicationInput,
  executionAudience: ExecutionAudienceResolution,
) {
  if (input.publishMode !== "Recurring" || input.executionMode !== "AgentLocalRoutine") {
    return;
  }

  const hasDeviceBoundWindowsAgentRecipient = executionAudience.recipients.some(
    (recipient) =>
      recipient.deviceId &&
      recipient.availableChannels.includes("WindowsAgent") &&
      recipient.recipientType === "Device",
  );

  if (hasDeviceBoundWindowsAgentRecipient) {
    return;
  }

  throw new AppError({
    statusCode: 422,
    code: "AGENT_LOCAL_ROUTINE_DEVICE_REQUIRED",
    message:
      "AgentLocalRoutine execution mode requires at least one device-bound Windows Agent recipient.",
  });
}

async function materializeAgentReminderPolicies(
  transaction: TransactionClient,
  options: {
    communicationScheduleId: string;
    communicationId: string;
    executionMode: ScheduleExecutionMode | null;
    recipients: ExecutionAudienceResolution;
    communication: CommunicationDetailRow;
    scheduleVersion: number;
    recurrenceRule: string | null;
    timezone: string | null;
    validFrom: string | null;
    validUntil: string | null;
  },
) {
  if (
    options.executionMode !== "AgentLocalRoutine" ||
    !options.recurrenceRule ||
    !options.timezone
  ) {
    return;
  }

  const deviceRecipients = dedupeAgentReminderDevices(options.recipients.recipients);
  for (const recipient of deviceRecipients) {
    await transaction.query(
      `
        insert into public.agent_reminder_policies (
          communication_schedule_id,
          communication_id,
          device_id,
          schedule_version,
          recurrence_rule,
          timezone,
          title_snapshot,
          body_snapshot,
          windows_agent_presentation,
          valid_from,
          valid_until,
          is_active
        )
        values (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::timestamptz,
          $11::timestamptz,
          true
        )
      `,
      [
        options.communicationScheduleId,
        options.communicationId,
        recipient.deviceId,
        options.scheduleVersion,
        options.recurrenceRule,
        options.timezone,
        options.communication.title,
        options.communication.body,
        options.communication.windowsAgentPresentation,
        options.validFrom,
        options.validUntil,
      ],
    );
  }
}

function dedupeAgentReminderDevices(
  recipients: ExecutionAudienceResolution["recipients"],
) {
  const devices = new Map<string, AgentReminderDeviceRecipient>();

  for (const recipient of recipients) {
    if (!isAgentReminderDeviceRecipient(recipient)) {
      continue;
    }

    devices.set(recipient.deviceId, recipient);
  }

  return [...devices.values()];
}

function collectWindowsAgentDeviceIds(
  recipients: ExecutionAudienceResolution["recipients"],
) {
  return [...new Set(dedupeAgentReminderDevices(recipients).map((recipient) => recipient.deviceId))];
}

type AgentReminderDeviceRecipient = ExecutionAudienceResolution["recipients"][number] & {
  recipientType: "Device";
  deviceId: string;
};

function isAgentReminderDeviceRecipient(
  recipient: ExecutionAudienceResolution["recipients"][number],
): recipient is AgentReminderDeviceRecipient {
  return (
    recipient.recipientType === "Device" &&
    typeof recipient.deviceId === "string" &&
    recipient.deviceId.length > 0 &&
    recipient.availableChannels.includes("WindowsAgent")
  );
}

async function deactivateActiveSchedules(
  transaction: TransactionClient,
  communicationId: string,
  cancelledAt: string,
) {
  await transaction.query(
    `
      update public.communication_schedules
      set
        is_active = false,
        cancelled_at = coalesce(cancelled_at, $2::timestamptz)
      where communication_id::text = $1
        and is_active = true
    `,
    [communicationId, cancelledAt],
  );

  await transaction.query(
    `
      update public.agent_reminder_policies
      set
        is_active = false
      where communication_id::text = $1
        and is_active = true
    `,
    [communicationId],
  );
}

async function markDeliveryJobsCancelled(
  transaction: TransactionClient,
  communicationId: string,
  cancelledAt: string,
) {
  const jobRows = await transaction.query<{ id: string }>(
    `
      update public.delivery_jobs
      set
        job_status = 'Failed',
        completed_at = coalesce(completed_at, $2::timestamptz),
        last_error_message = coalesce(
          last_error_message,
          'Cancelled by operator before delivery execution completed.'
        )
      where communication_id::text = $1
        and job_status = 'Pending'
      returning id::text as id
    `,
    [communicationId, cancelledAt],
  );

  for (const job of jobRows) {
    await transaction.query(
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
          'Failed',
          'AdminApi',
          $2::jsonb,
          $3::timestamptz
        )
      `,
      [
        job.id,
        JSON.stringify({
          reason: "CommunicationCancelled",
        }),
        cancelledAt,
      ],
    );
  }
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
