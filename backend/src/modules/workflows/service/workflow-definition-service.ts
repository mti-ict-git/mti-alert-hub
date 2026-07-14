import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { createPageMeta } from "../../../shared/http/list-query.js";

export type WorkflowDefinition = {
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
  workflowId: string;
  key: string;
  label: string;
};

type ListWorkflowDefinitionsOptions = {
  page: number;
  pageSize: number;
  search?: string;
};

type ManagedWorkflowSeed = {
  id: string;
  name: string;
  description: string;
  workflowType: "TemplateSelected";
  allowFreeText: boolean;
  requireFreeText: boolean;
  escalationTimeoutMinutes: number | null;
  escalationMode: "RecipientOnly" | null;
  responseImpliesAck: boolean;
  options: Array<{
    id: string;
    key: string;
    label: string;
    sortOrder: number;
  }>;
};

const managedWorkflowSeeds: ManagedWorkflowSeed[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Critical Acknowledgement",
    description: "Baseline critical workflow for alert acknowledgement and assistance requests.",
    workflowType: "TemplateSelected",
    allowFreeText: false,
    requireFreeText: false,
    escalationTimeoutMinutes: 15,
    escalationMode: "RecipientOnly",
    responseImpliesAck: true,
    options: [
      {
        id: "11111111-aaaa-1111-aaaa-111111111111",
        key: "safe",
        label: "Safe",
        sortOrder: 1,
      },
      {
        id: "11111111-bbbb-1111-bbbb-111111111111",
        key: "assist",
        label: "Need Assistance",
        sortOrder: 2,
      },
      {
        id: "11111111-cccc-1111-cccc-111111111111",
        key: "away",
        label: "Not In Area",
        sortOrder: 3,
      },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Reminder Confirmation",
    description: "Simple reminder confirmation workflow.",
    workflowType: "TemplateSelected",
    allowFreeText: false,
    requireFreeText: false,
    escalationTimeoutMinutes: null,
    escalationMode: "RecipientOnly",
    responseImpliesAck: true,
    options: [
      {
        id: "22222222-aaaa-2222-aaaa-222222222222",
        key: "done",
        label: "Acknowledged",
        sortOrder: 1,
      },
    ],
  },
];

export class WorkflowDefinitionService {
  constructor(private readonly database: DatabaseClient) {}

  async ensureManagedWorkflowDefinitions() {
    for (const seed of managedWorkflowSeeds) {
      assertValidWorkflowDefinition({
        id: seed.id,
        name: seed.name,
        allowFreeText: seed.allowFreeText,
        requireFreeText: seed.requireFreeText,
        escalationTimeoutMinutes: seed.escalationTimeoutMinutes,
        escalationMode: seed.escalationMode,
        responseImpliesAck: seed.responseImpliesAck,
        options: seed.options.map((option) => ({
          key: option.key,
          label: option.label,
        })),
      });
    }

    await this.database.withTransaction(async (transaction) => {
      for (const seed of managedWorkflowSeeds) {
        await transaction.query(
          `
            insert into public.response_workflows (
              id,
              name,
              description,
              workflow_type,
              allow_free_text,
              require_free_text,
              escalation_timeout_minutes,
              escalation_mode,
              response_implies_ack
            )
            values (
              $1::uuid,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9
            )
            on conflict (id) do update
            set
              name = excluded.name,
              description = excluded.description,
              workflow_type = excluded.workflow_type,
              allow_free_text = excluded.allow_free_text,
              require_free_text = excluded.require_free_text,
              escalation_timeout_minutes = excluded.escalation_timeout_minutes,
              escalation_mode = excluded.escalation_mode,
              response_implies_ack = excluded.response_implies_ack
          `,
          [
            seed.id,
            seed.name,
            seed.description,
            seed.workflowType,
            seed.allowFreeText,
            seed.requireFreeText,
            seed.escalationTimeoutMinutes,
            seed.escalationMode,
            seed.responseImpliesAck,
          ],
        );

        await transaction.query(
          `
            delete from public.response_workflow_options
            where workflow_id = $1::uuid
              and not (id::text = any($2::text[]))
          `,
          [seed.id, seed.options.map((option) => option.id)],
        );

        for (const option of seed.options) {
          await transaction.query(
            `
              insert into public.response_workflow_options (
                id,
                workflow_id,
                option_key,
                option_label,
                sort_order
              )
              values (
                $1::uuid,
                $2::uuid,
                $3,
                $4,
                $5
              )
              on conflict (id) do update
              set
                workflow_id = excluded.workflow_id,
                option_key = excluded.option_key,
                option_label = excluded.option_label,
                sort_order = excluded.sort_order
            `,
            [option.id, seed.id, option.key, option.label, option.sortOrder],
          );
        }
      }
    });
  }

  async listWorkflowDefinitions(options: ListWorkflowDefinitionsOptions) {
    const where = buildWorkflowWhereClause(options.search);
    const pagination = buildPaginationParams(options, where.params);

    const [rows, totalRows] = await Promise.all([
      this.database.query<WorkflowRow>(
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
          ${where.clause}
          order by name asc, created_at asc
          limit $${pagination.limitIndex}
          offset $${pagination.offsetIndex}
        `,
        pagination.values,
      ),
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.response_workflows
          ${where.clause}
        `,
        where.params,
      ),
    ]);

    const definitions = await this.attachOptions(rows);

    return {
      items: definitions,
      page: createPageMeta({
        page: options.page,
        pageSize: options.pageSize,
        totalItems: totalRows[0]?.totalItems ?? 0,
      }),
    };
  }

  async getWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
    const rows = await this.database.query<WorkflowRow>(
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

    const row = rows[0];
    if (!row) {
      return null;
    }

    const definitions = await this.attachOptions([row]);
    return definitions[0] ?? null;
  }

  async getWorkflowDefinitionOrThrow(workflowId: string): Promise<WorkflowDefinition> {
    const definition = await this.getWorkflowDefinition(workflowId);
    if (!definition) {
      throw new AppError({
        statusCode: 422,
        code: "WORKFLOW_NOT_FOUND",
        message: "The selected workflow definition was not found.",
      });
    }

    return definition;
  }

  private async attachOptions(rows: WorkflowRow[]) {
    if (rows.length === 0) {
      return [];
    }

    const workflowIds = rows.map((row) => row.id);
    const optionRows = await this.database.query<WorkflowOptionRow>(
      `
        select
          workflow_id::text as "workflowId",
          option_key::text as key,
          option_label::text as label
        from public.response_workflow_options
        where workflow_id::text = any($1::text[])
        order by workflow_id asc, sort_order asc, option_key asc
      `,
      [workflowIds],
    );

    const optionsByWorkflowId = new Map<string, WorkflowDefinition["options"]>();
    for (const option of optionRows) {
      const existing = optionsByWorkflowId.get(option.workflowId) ?? [];
      existing.push({
        key: option.key.trim(),
        label: option.label.trim(),
      });
      optionsByWorkflowId.set(option.workflowId, existing);
    }

    return rows.map((row) => {
      const definition: WorkflowDefinition = {
        id: row.id,
        name: row.name,
        allowFreeText: row.allowFreeText,
        requireFreeText: row.requireFreeText,
        escalationTimeoutMinutes: row.escalationTimeoutMinutes,
        escalationMode: row.escalationMode,
        responseImpliesAck: row.responseImpliesAck,
        options: optionsByWorkflowId.get(row.id) ?? [],
      };

      assertValidWorkflowDefinition(definition);
      return definition;
    });
  }
}

export function assertValidWorkflowDefinition(definition: WorkflowDefinition) {
  if (definition.requireFreeText && !definition.allowFreeText) {
    throw new AppError({
      statusCode: 500,
      code: "WORKFLOW_DEFINITION_INVALID",
      message: `Workflow ${definition.id} is invalid because requireFreeText cannot be enabled when allowFreeText is false.`,
    });
  }

  if (definition.options.length === 0) {
    throw new AppError({
      statusCode: 500,
      code: "WORKFLOW_DEFINITION_INVALID",
      message: `Workflow ${definition.id} is invalid because it has no response options.`,
    });
  }

  const optionKeys = new Set<string>();
  for (const option of definition.options) {
    if (!option.key || !option.label) {
      throw new AppError({
        statusCode: 500,
        code: "WORKFLOW_DEFINITION_INVALID",
        message: `Workflow ${definition.id} is invalid because one or more response options are blank.`,
      });
    }

    if (optionKeys.has(option.key)) {
      throw new AppError({
        statusCode: 500,
        code: "WORKFLOW_DEFINITION_INVALID",
        message: `Workflow ${definition.id} is invalid because response option keys must be unique.`,
      });
    }

    optionKeys.add(option.key);
  }

  if (
    definition.escalationTimeoutMinutes !== null &&
    (!Number.isInteger(definition.escalationTimeoutMinutes) || definition.escalationTimeoutMinutes <= 0)
  ) {
    throw new AppError({
      statusCode: 500,
      code: "WORKFLOW_DEFINITION_INVALID",
      message: `Workflow ${definition.id} is invalid because escalationTimeoutMinutes must be a positive integer when configured.`,
    });
  }

  if (definition.escalationTimeoutMinutes !== null && definition.escalationMode !== "RecipientOnly") {
    throw new AppError({
      statusCode: 500,
      code: "WORKFLOW_DEFINITION_INVALID",
      message: `Workflow ${definition.id} is invalid because escalationTimeoutMinutes requires escalationMode = RecipientOnly in the MVP baseline.`,
    });
  }
}

function buildWorkflowWhereClause(search?: string) {
  if (!search?.trim()) {
    return {
      clause: "",
      params: [] as unknown[],
    };
  }

  const like = `%${search.trim()}%`;
  return {
    clause: `
      where (
        name ilike $1
        or coalesce(description, '') ilike $1
      )
    `,
    params: [like] as unknown[],
  };
}

function buildPaginationParams(
  options: Pick<ListWorkflowDefinitionsOptions, "page" | "pageSize">,
  existingParams: unknown[],
) {
  const values = [...existingParams, options.pageSize, (options.page - 1) * options.pageSize];
  return {
    values,
    limitIndex: existingParams.length + 1,
    offsetIndex: existingParams.length + 2,
  };
}
