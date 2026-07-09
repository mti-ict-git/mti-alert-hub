import { z } from "zod";

import type { AppRoute } from "../../../app/http/create-server.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import { CommunicationDraftService } from "../service/communication-draft-service.js";
import { CommunicationTemplateService } from "../service/communication-template-service.js";

const communicationTypeSchema = z.enum([
  "Alert",
  "Reminder",
  "OperationalNotice",
  "News",
  "Article",
  "KnowledgeUpdate",
]);
const prioritySchema = z.enum(["Info", "Warning", "Critical"]);
const channelSchema = z.enum(["WindowsAgent", "WhatsApp", "Email", "DigitalSignage"]);
const targetTypeSchema = z.enum([
  "All",
  "Site",
  "Area",
  "Department",
  "Section",
  "Role",
  "Employee",
  "Group",
  "Device",
]);
const windowsAgentPresentationSchema = z.enum(["Toast", "Modal", "Fullscreen"]);
const deliveryStrategySchema = z.enum([
  "UserPreference",
  "MultiSend",
  "PrimaryFallback",
  "TemplatePolicy",
]);
const scheduleExecutionModeSchema = z.enum(["ServerGenerated", "AgentLocalRoutine"]);

const communicationListQuerySchema = baseListQuerySchema.extend({
  status: z
    .enum(["Draft", "Scheduled", "Queued", "Sending", "Active", "Completed", "Cancelled", "Failed"])
    .optional(),
  communicationType: communicationTypeSchema.optional(),
  priority: prioritySchema.optional(),
  templateId: z.string().uuid().optional(),
});

const templateListQuerySchema = baseListQuerySchema;
const deliveryListQuerySchema = baseListQuerySchema;

const targetRuleSchema = z.object({
  targetType: targetTypeSchema,
  targetValue: z.string().trim().min(1),
});

const createCommunicationSchema = z.object({
  communicationType: communicationTypeSchema,
  priority: prioritySchema,
  category: z.string().trim().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  channelSelections: z.array(channelSchema).min(1),
  targets: z.array(targetRuleSchema).min(1),
  workflowId: z.string().uuid().optional().nullable(),
  windowsAgentPresentation: windowsAgentPresentationSchema.optional().nullable(),
  deliveryStrategy: deliveryStrategySchema.optional().nullable(),
  confirmLockedFieldPolicy: z.boolean().optional().nullable(),
});

const updateCommunicationSchema = z
  .object({
    category: z.string().trim().optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(1).optional(),
    body: z.string().trim().min(1).optional(),
    channelSelections: z.array(channelSchema).min(1).optional(),
    targets: z.array(targetRuleSchema).min(1).optional(),
    workflowId: z.string().uuid().optional().nullable(),
    windowsAgentPresentation: windowsAgentPresentationSchema.optional().nullable(),
    deliveryStrategy: deliveryStrategySchema.optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one draft field must be provided.",
    path: [],
  });

const publishCommunicationSchema = z.object({
  publishMode: z.enum(["Now", "Scheduled", "Recurring"]),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  recurrenceRule: z.string().trim().optional().nullable(),
  timezone: z.string().trim().optional().nullable(),
  executionMode: scheduleExecutionModeSchema.optional().nullable(),
  validUntil: z.string().datetime({ offset: true }).optional().nullable(),
  confirmedPreview: z.boolean(),
});

type RegisterCommunicationRoutesOptions = {
  communicationDraftService: CommunicationDraftService;
  communicationTemplateService: CommunicationTemplateService;
  audiencePreviewService: {
    previewCommunicationAudience(communicationId: string): Promise<unknown>;
  };
};

export function registerCommunicationRoutes(
  options: RegisterCommunicationRoutesOptions,
): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/templates",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(templateListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.communicationTemplateService.listTemplates(query),
        };
      },
    },
    {
      method: "GET",
      path: "/templates/{templateId}",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 200,
          body: await options.communicationTemplateService.getTemplateById(params.templateId ?? ""),
        };
      },
    },
    {
      method: "GET",
      path: "/communications",
      requiresAuth: true,
      async handler({ url }) {
        const query = parseListQuery(communicationListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.communicationDraftService.listCommunications(query),
        };
      },
    },
    {
      method: "POST",
      path: "/communications",
      requiresAuth: true,
      async handler({ json }) {
        const payload = validateWithSchema(createCommunicationSchema, await json());
        return {
          statusCode: 201,
          body: await options.communicationDraftService.createDraft(payload),
        };
      },
    },
    {
      method: "GET",
      path: "/communications/{communicationId}",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 200,
          body: await options.communicationDraftService.getCommunicationDetail(
            params.communicationId ?? "",
          ),
        };
      },
    },
    {
      method: "PATCH",
      path: "/communications/{communicationId}",
      requiresAuth: true,
      async handler({ params, json }) {
        const payload = validateWithSchema(updateCommunicationSchema, await json());
        return {
          statusCode: 200,
          body: await options.communicationDraftService.updateDraft(
            params.communicationId ?? "",
            payload,
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/communications/{communicationId}/audience-preview",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 200,
          body: await options.audiencePreviewService.previewCommunicationAudience(
            params.communicationId ?? "",
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/communications/{communicationId}/publish",
      requiresAuth: true,
      async handler({ params, json, auth }) {
        const payload = validateWithSchema(publishCommunicationSchema, await json());
        return {
          statusCode: 200,
          body: await options.communicationDraftService.publishCommunication(
            params.communicationId ?? "",
            payload,
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
            },
          ),
        };
      },
    },
    {
      method: "POST",
      path: "/communications/{communicationId}/cancel",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 200,
          body: await options.communicationDraftService.cancelCommunication(
            params.communicationId ?? "",
          ),
        };
      },
    },
    {
      method: "GET",
      path: "/communications/{communicationId}/deliveries",
      requiresAuth: true,
      async handler({ params, url }) {
        const query = parseListQuery(deliveryListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.communicationDraftService.listCommunicationDeliveries({
            communicationId: params.communicationId ?? "",
            page: query.page,
            pageSize: query.pageSize,
          }),
        };
      },
    },
    {
      method: "POST",
      path: "/communications/{communicationId}/duplicate",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 201,
          body: await options.communicationDraftService.duplicateDraft(
            params.communicationId ?? "",
          ),
        };
      },
    },
  ];
}
