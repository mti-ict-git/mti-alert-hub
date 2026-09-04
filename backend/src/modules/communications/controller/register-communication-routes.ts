import { z } from "zod";
import type { IncomingMessage } from "node:http";

import type { AppRoute } from "../../../app/http/create-server.js";
import { baseListQuerySchema, parseListQuery } from "../../../shared/http/list-query.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import { isAppError } from "../../../shared/errors/app-error.js";
import type { AuditLogService } from "../../audit/service/audit-log-service.js";
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
const reminderDraftScheduleSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  recurrenceRule: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  executionMode: scheduleExecutionModeSchema,
  distributionMode: z.enum(["Synchronized", "Staggered"]).optional().nullable(),
  staggerWindowMinutes: z.number().int().min(5).max(720).optional().nullable(),
  validUntil: z.string().datetime({ offset: true }).optional().nullable(),
});
const toastAutoDismissSecondsSchema = z.number().int().min(1).max(60);
const wellnessActionKindSchema = z.enum([
  "GotIt",
  "Done",
  "Start",
  "Next",
  "Close",
  "RemindMeLater",
]);
const wellnessActionSchema = z.object({
  actionKey: z.string().trim().min(1),
  kind: wellnessActionKindSchema,
  label: z.string().trim().min(1),
  style: z.enum(["Primary", "Secondary", "Ghost"]).optional().nullable(),
  snoozeMinutes: z.number().int().min(1).max(1440).optional().nullable(),
});
const wellnessStepSchema = z.object({
  stepKey: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  assetUrl: z.string().trim().url().optional().nullable(),
  durationSeconds: z.number().int().min(1).max(3600).optional().nullable(),
  sortOrder: z.number().int(),
});
const wellnessLocalizationSchema = z.object({
  locale: z.string().trim().min(1),
  title: z.string().trim().optional().nullable(),
  body: z.string().trim().optional().nullable(),
  instruction: z.string().trim().optional().nullable(),
});
const wellnessProgramSchema = z.object({
  programType: z.enum(["SimpleReminder", "GuidedRoutine"]),
  theme: z.enum(["Blue", "Green"]),
  layoutVariant: z.enum([
    "ReminderCard",
    "CountdownCard",
    "OverviewCard",
    "GuidedRoutine",
    "CompletionCard",
  ]),
  variantKeys: z.array(z.string().trim().min(1)).optional().default([]),
  heroAssetUrl: z.string().trim().url().optional().nullable(),
  countdownSeconds: z.number().int().min(1).max(3600).optional().nullable(),
  rotationMode: z.enum(["Fixed", "Sequential", "Random"]).optional().nullable(),
  actions: z.array(wellnessActionSchema).min(1),
  steps: z.array(wellnessStepSchema).optional().default([]),
  localizations: z.array(wellnessLocalizationSchema).optional().default([]),
});

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
const communicationBodySchema = z.string().trim().min(1).max(320);

const createCommunicationSchema = z.object({
  communicationType: communicationTypeSchema,
  priority: prioritySchema,
  category: z.string().trim().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1),
  body: communicationBodySchema,
  instruction: z.string().trim().optional().nullable(),
  channelSelections: z.array(channelSchema).min(1),
  targets: z.array(targetRuleSchema).min(1),
  workflowId: z.string().uuid().optional().nullable(),
  windowsAgentPresentation: windowsAgentPresentationSchema.optional().nullable(),
  toastAutoDismissSeconds: toastAutoDismissSecondsSchema.optional().nullable(),
  deliveryStrategy: deliveryStrategySchema.optional().nullable(),
  reminderSchedule: reminderDraftScheduleSchema.optional().nullable(),
  wellnessProgram: wellnessProgramSchema.optional().nullable(),
  confirmLockedFieldPolicy: z.boolean().optional().nullable(),
});

const updateCommunicationSchema = z
  .object({
    priority: prioritySchema.optional(),
    category: z.string().trim().optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(1).optional(),
    body: communicationBodySchema.optional(),
    instruction: z.string().trim().optional().nullable(),
    channelSelections: z.array(channelSchema).min(1).optional(),
    targets: z.array(targetRuleSchema).min(1).optional(),
    workflowId: z.string().uuid().optional().nullable(),
    windowsAgentPresentation: windowsAgentPresentationSchema.optional().nullable(),
    toastAutoDismissSeconds: toastAutoDismissSecondsSchema.optional().nullable(),
    deliveryStrategy: deliveryStrategySchema.optional().nullable(),
    reminderSchedule: reminderDraftScheduleSchema.optional().nullable(),
    wellnessProgram: wellnessProgramSchema.optional().nullable(),
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
  distributionMode: z.enum(["Synchronized", "Staggered"]).optional().nullable(),
  staggerWindowMinutes: z.number().int().min(5).max(720).optional().nullable(),
  validUntil: z.string().datetime({ offset: true }).optional().nullable(),
  confirmedPreview: z.boolean(),
});

const compatibleChannelResponseSchema = z.object({
  responseOptionKey: z.string().trim().min(1),
  responseNote: z.string().trim().optional().nullable(),
  occurredAt: z.string().trim().optional().nullable(),
  actorUserIdentifier: z.string().trim().optional().nullable(),
});

type RegisterCommunicationRoutesOptions = {
  communicationDraftService: CommunicationDraftService;
  communicationTemplateService: CommunicationTemplateService;
  auditLogService: AuditLogService;
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
      async handler({ json, auth, request }) {
        const payload = validateWithSchema(createCommunicationSchema, await json());
        try {
          return {
            statusCode: 201,
            body: await options.communicationDraftService.createDraft(payload),
          };
        } catch (error) {
          await recordTemplateOverrideRejection(options.auditLogService, {
            error,
            auth,
            request,
            templateId: payload.templateId ?? null,
            communicationId: null,
          });
          throw error;
        }
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
      method: "GET",
      path: "/communications/{communicationId}/reminder-activity",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 200,
          body: await options.communicationDraftService.getCommunicationReminderActivity(
            params.communicationId ?? "",
          ),
        };
      },
    },
    {
      method: "GET",
      path: "/communications/{communicationId}/wellness-reporting",
      requiresAuth: true,
      async handler({ params }) {
        return {
          statusCode: 200,
          body: await options.communicationDraftService.getCommunicationWellnessReporting(
            params.communicationId ?? "",
          ),
        };
      },
    },
    {
      method: "PATCH",
      path: "/communications/{communicationId}",
      requiresAuth: true,
      async handler({ params, json, auth, request }) {
        const payload = validateWithSchema(updateCommunicationSchema, await json());
        try {
          return {
            statusCode: 200,
            body: await options.communicationDraftService.updateDraft(
              params.communicationId ?? "",
              payload,
            ),
          };
        } catch (error) {
          await recordTemplateOverrideRejection(options.auditLogService, {
            error,
            auth,
            request,
            templateId: payload.templateId ?? null,
            communicationId: params.communicationId ?? null,
          });
          throw error;
        }
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
      async handler({ params, json, auth, request }) {
        const payload = validateWithSchema(publishCommunicationSchema, await json());
        try {
          return {
            statusCode: 200,
            body: await options.communicationDraftService.publishCommunication(
              params.communicationId ?? "",
              payload,
              {
                userIdentifier: auth?.session.user.id ?? "anonymous",
                username: auth?.session.user.username ?? "anonymous",
                ipAddress: resolveRequestIpAddress(request),
              },
            ),
          };
        } catch (error) {
          await recordTemplateOverrideRejection(options.auditLogService, {
            error,
            auth,
            request,
            templateId: null,
            communicationId: params.communicationId ?? null,
          });
          throw error;
        }
      },
    },
    {
      method: "POST",
      path: "/communications/{communicationId}/cancel",
      requiresAuth: true,
      async handler({ params, auth, request }) {
        return {
          statusCode: 200,
          body: await options.communicationDraftService.cancelCommunication(
            params.communicationId ?? "",
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
              ipAddress: resolveRequestIpAddress(request),
            },
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
      method: "GET",
      path: "/communications/{communicationId}/responses",
      requiresAuth: true,
      async handler({ params, url }) {
        const query = parseListQuery(baseListQuerySchema, url);
        return {
          statusCode: 200,
          body: await options.communicationDraftService.listCommunicationResponses({
            communicationId: params.communicationId ?? "",
            page: query.page,
            pageSize: query.pageSize,
          }),
        };
      },
    },
    {
      method: "POST",
      path: "/communications/{communicationId}/deliveries/{deliveryJobId}/response",
      requiresAuth: true,
      async handler({ params, json, auth, request }) {
        const payload = validateWithSchema(compatibleChannelResponseSchema, await json());
        return {
          statusCode: 200,
          body: await options.communicationDraftService.submitCompatibleChannelResponse(
            params.communicationId ?? "",
            params.deliveryJobId ?? "",
            payload,
            {
              userIdentifier: auth?.session.user.id ?? "anonymous",
              username: auth?.session.user.username ?? "anonymous",
              ipAddress: resolveRequestIpAddress(request),
            },
          ),
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

async function recordTemplateOverrideRejection(
  auditLogService: AuditLogService,
  options: {
    error: unknown;
    auth: { session: { user: { id: string; username: string } } } | undefined;
    request: IncomingMessage;
    templateId: string | null;
    communicationId: string | null;
  },
) {
  if (!isAppError(options.error)) {
    return;
  }

  if (
    options.error.code !== "LOCKED_TEMPLATE_FIELD_OVERRIDE" &&
    options.error.code !== "TEMPLATE_CHANNEL_OVERRIDE_REJECTED"
  ) {
    return;
  }

  await auditLogService.recordNow({
    actorUserId: options.auth?.session.user.id ?? "anonymous",
    actorUsername: options.auth?.session.user.username ?? "anonymous",
    actionType: "TemplateOverrideRejected",
    moduleName: "Communications",
    entityType: options.communicationId ? "Communication" : "Template",
    entityId: options.communicationId ?? options.templateId ?? null,
    description: options.communicationId
      ? `Template override rejected for communication ${options.communicationId}: ${options.error.message}`
      : `Template override rejected for template ${options.templateId ?? "unknown"}: ${options.error.message}`,
    ipAddress: resolveRequestIpAddress(options.request),
    metadata: {
      code: options.error.code,
      templateId: options.templateId,
      communicationId: options.communicationId,
    },
  });
}

function resolveRequestIpAddress(request: IncomingMessage) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
}
