import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type {
  Channel,
  CommunicationTemplatePolicy,
  TargetType,
} from "./communication-template-service.js";
import { CommunicationTemplateService } from "./communication-template-service.js";

type CommunicationPreviewRow = {
  id: string;
  priority: "Info" | "Warning" | "Critical";
  templateId: string | null;
  channelSelections: unknown;
};

type CommunicationTargetRow = {
  targetType: TargetType;
  targetValue: string;
};

type EmployeeRecipientRow = {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  siteName: string | null;
  areaName: string | null;
  departmentName: string | null;
  sectionName: string | null;
  whatsappNumber: string | null;
  email: string | null;
  hasWindowsAgent: boolean;
  hasWhatsApp: boolean;
};

type DeviceRecipientRow = {
  deviceId: string;
  employeeId: string | null;
  employeeNumber: string | null;
  fullName: string | null;
  siteName: string | null;
  areaName: string | null;
  departmentName: string | null;
  sectionName: string | null;
};

type RecipientPreview = {
  recipientType: "Employee" | "Device";
  deviceId: string | null;
  employeeId: string | null;
  employeeNumber: string | null;
  fullName: string | null;
  siteName: string | null;
  areaName: string | null;
  departmentName: string | null;
  sectionName: string | null;
  availableChannels: Channel[];
};

type ChannelPlanItem = {
  channel: Channel;
  strategy: "Mandatory" | "Optional" | "DelayedFollowUp";
  plannedDelaySeconds: number | null;
};

export class AudiencePreviewService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly templateService: CommunicationTemplateService,
  ) {}

  async previewCommunicationAudience(communicationId: string) {
    const communication = await this.getCommunication(communicationId);
    if (!communication) {
      throw new AppError({
        statusCode: 404,
        code: "COMMUNICATION_NOT_FOUND",
        message: "The requested communication was not found.",
      });
    }

    const targets = await this.listTargets(communicationId);
    if (targets.length === 0) {
      throw new AppError({
        statusCode: 422,
        code: "TARGET_REQUIRED",
        message: "At least one target rule is required before previewing the audience.",
      });
    }

    const template =
      (communication.templateId
        ? await this.templateService.findTemplateById(communication.templateId)
        : null) ?? null;
    const resolution = await this.resolveRecipients(targets);
    const selectedChannels = normalizeChannelArray(communication.channelSelections);
    const recipientList = [...resolution.recipients.values()];
    const previewWarnings = buildCoverageWarnings({
      selectedChannels,
      recipients: recipientList,
      unsupportedTargetWarnings: resolution.warnings,
    });

    return {
      totalRecipients: recipientList.length,
      deviceRecipients: selectedChannels.includes("WindowsAgent")
        ? recipientList.filter((recipient) => recipient.availableChannels.includes("WindowsAgent"))
            .length
        : 0,
      whatsappRecipients: selectedChannels.includes("WhatsApp")
        ? recipientList.filter((recipient) => recipient.availableChannels.includes("WhatsApp")).length
        : 0,
      previewWarnings,
      channelPlan: buildChannelPlan(selectedChannels, template),
      recipients: recipientList,
    };
  }

  private async getCommunication(communicationId: string) {
    const rows = await this.database.query<CommunicationPreviewRow>(
      `
        select
          id::text as id,
          priority::text as priority,
          template_id::text as "templateId",
          channel_selections_json as "channelSelections"
        from public.communications
        where id::text = $1
        limit 1
      `,
      [communicationId],
    );

    return rows[0];
  }

  private async listTargets(communicationId: string) {
    return this.database.query<CommunicationTargetRow>(
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
  }

  private async resolveRecipients(targets: CommunicationTargetRow[]) {
    const recipients = new Map<string, RecipientPreview>();
    const warnings: string[] = [];

    for (const target of targets) {
      if (target.targetType === "Group") {
        warnings.push(
          `Group target "${target.targetValue}" is not yet backed by organization data and was skipped in preview.`,
        );
        continue;
      }

      const [employeeRecipients, deviceRecipients] = await Promise.all([
        shouldResolveEmployees(target.targetType)
          ? this.queryEmployeesByTarget(target)
          : Promise.resolve([] as EmployeeRecipientRow[]),
        shouldResolveDevices(target.targetType)
          ? this.queryDevicesByTarget(target)
          : Promise.resolve([] as DeviceRecipientRow[]),
      ]);

      for (const employee of employeeRecipients) {
        recipients.set(`Employee:${employee.employeeId}`, mapEmployeeRecipient(employee));
      }

      for (const device of deviceRecipients) {
        recipients.set(`Device:${device.deviceId}`, mapDeviceRecipient(device));
      }
    }

    return {
      recipients,
      warnings,
    };
  }

  private async queryEmployeesByTarget(target: CommunicationTargetRow) {
    const scope = buildEmployeeScope(target);
    return this.database.maybeQuery<EmployeeRecipientRow>(
      "employees",
      `
        select
          e.id::text as "employeeId",
          e.employee_number::text as "employeeNumber",
          e.full_name::text as "fullName",
          s.name::text as "siteName",
          a.name::text as "areaName",
          d.name::text as "departmentName",
          sec.name::text as "sectionName",
          e.phone_number::text as "whatsappNumber",
          e.email::text as email,
          e.has_windows_agent as "hasWindowsAgent",
          e.has_whatsapp as "hasWhatsApp"
        from public.employees e
        left join public.sites s on s.id = e.site_id
        left join public.areas a on a.id = e.area_id
        left join public.departments d on d.id = e.department_id
        left join public.sections sec on sec.id = e.section_id
        ${scope.clause}
        order by e.full_name asc
      `,
      scope.params,
    );
  }

  private async queryDevicesByTarget(target: CommunicationTargetRow) {
    const scope = buildDeviceScope(target);
    return this.database.maybeQuery<DeviceRecipientRow>(
      "devices",
      `
        select
          dev.id::text as "deviceId",
          e.id::text as "employeeId",
          e.employee_number::text as "employeeNumber",
          e.full_name::text as "fullName",
          s.name::text as "siteName",
          a.name::text as "areaName",
          d.name::text as "departmentName",
          sec.name::text as "sectionName"
        from public.devices dev
        left join public.employees e on e.id = dev.primary_employee_id
        left join public.sites s on s.id = dev.site_id
        left join public.areas a on a.id = dev.area_id
        left join public.departments d on d.id = e.department_id
        left join public.sections sec on sec.id = e.section_id
        ${scope.clause}
        order by s.name asc nulls last, dev.hostname asc
      `,
      scope.params,
    );
  }
}

function buildEmployeeScope(target: CommunicationTargetRow) {
  const trimmedValue = target.targetValue.trim();
  if (trimmedValue === "*" || target.targetType === "All") {
    return { clause: "", params: [] as unknown[] };
  }

  switch (target.targetType) {
    case "Site":
      return buildNamedScope({
        columnId: "e.site_id",
        codeColumn: "s.code",
        nameColumn: "s.name",
        value: trimmedValue,
      });
    case "Area":
      return buildNamedScope({
        columnId: "e.area_id",
        codeColumn: "a.code",
        nameColumn: "a.name",
        value: trimmedValue,
      });
    case "Department":
      return buildNamedScope({
        columnId: "e.department_id",
        codeColumn: "d.code",
        nameColumn: "d.name",
        value: trimmedValue,
      });
    case "Section":
      return buildNamedScope({
        columnId: "e.section_id",
        codeColumn: "sec.code",
        nameColumn: "sec.name",
        value: trimmedValue,
      });
    case "Employee":
      return {
        clause:
          "where (e.id::text = $1 or e.employee_number::text = $2 or e.full_name::text ilike $3)",
        params: [trimmedValue, trimmedValue, `%${trimmedValue}%`],
      };
    case "Role":
      return {
        clause: "where e.job_role::text ilike $1",
        params: [`%${trimmedValue}%`],
      };
    default:
      return { clause: "where 1 = 0", params: [] as unknown[] };
  }
}

function buildDeviceScope(target: CommunicationTargetRow) {
  const trimmedValue = target.targetValue.trim();
  if (trimmedValue === "*" || target.targetType === "All") {
    return { clause: "", params: [] as unknown[] };
  }

  switch (target.targetType) {
    case "Site":
      return buildNamedScope({
        columnId: "dev.site_id",
        codeColumn: "s.code",
        nameColumn: "s.name",
        value: trimmedValue,
      });
    case "Area":
      return buildNamedScope({
        columnId: "dev.area_id",
        codeColumn: "a.code",
        nameColumn: "a.name",
        value: trimmedValue,
      });
    case "Device":
      return {
        clause:
          "where (dev.id::text = $1 or dev.device_identifier::text = $2 or dev.hostname::text ilike $3)",
        params: [trimmedValue, trimmedValue, `%${trimmedValue}%`],
      };
    default:
      return { clause: "where 1 = 0", params: [] as unknown[] };
  }
}

function buildNamedScope(options: {
  columnId: string;
  codeColumn: string;
  nameColumn: string;
  value: string;
}) {
  return {
    clause: `where (${options.columnId}::text = $1 or ${options.codeColumn}::text = $2 or ${options.nameColumn}::text ilike $3)`,
    params: [options.value, options.value, `%${options.value}%`],
  };
}

function shouldResolveEmployees(targetType: TargetType) {
  return ["All", "Site", "Area", "Department", "Section", "Employee", "Role"].includes(targetType);
}

function shouldResolveDevices(targetType: TargetType) {
  return ["All", "Site", "Area", "Device"].includes(targetType);
}

function mapEmployeeRecipient(employee: EmployeeRecipientRow): RecipientPreview {
  const availableChannels: Channel[] = [];
  if (employee.hasWindowsAgent) {
    availableChannels.push("WindowsAgent");
  }
  if (employee.hasWhatsApp || employee.whatsappNumber) {
    availableChannels.push("WhatsApp");
  }
  if (employee.email) {
    availableChannels.push("Email");
  }

  return {
    recipientType: "Employee",
    deviceId: null,
    employeeId: employee.employeeId,
    employeeNumber: employee.employeeNumber,
    fullName: employee.fullName,
    siteName: employee.siteName,
    areaName: employee.areaName,
    departmentName: employee.departmentName,
    sectionName: employee.sectionName,
    availableChannels,
  };
}

function mapDeviceRecipient(device: DeviceRecipientRow): RecipientPreview {
  return {
    recipientType: "Device",
    deviceId: device.deviceId,
    employeeId: device.employeeId,
    employeeNumber: device.employeeNumber,
    fullName: device.fullName,
    siteName: device.siteName,
    areaName: device.areaName,
    departmentName: device.departmentName,
    sectionName: device.sectionName,
    availableChannels: ["WindowsAgent"],
  };
}

function buildCoverageWarnings(options: {
  selectedChannels: Channel[];
  recipients: RecipientPreview[];
  unsupportedTargetWarnings: string[];
}) {
  const warnings = [...options.unsupportedTargetWarnings];
  if (options.recipients.length === 0) {
    warnings.push("No recipients were resolved for the selected target rules.");
    return warnings;
  }

  for (const channel of options.selectedChannels) {
    const supportedCount = options.recipients.filter((recipient) =>
      recipient.availableChannels.includes(channel),
    ).length;
    if (supportedCount === options.recipients.length) {
      continue;
    }

    if (supportedCount === 0) {
      warnings.push(`No recipients currently have ${channel} coverage.`);
      continue;
    }

    warnings.push(
      `${options.recipients.length - supportedCount} recipients do not currently have ${channel} coverage.`,
    );
  }

  return warnings;
}

function buildChannelPlan(
  selectedChannels: Channel[],
  template: CommunicationTemplatePolicy | null,
): ChannelPlanItem[] {
  return selectedChannels.map((channel) => {
    if (template?.mandatoryChannels.includes(channel)) {
      return {
        channel,
        strategy: "Mandatory",
        plannedDelaySeconds: null,
      };
    }

    if (
      channel === "WhatsApp" &&
      selectedChannels.includes("WindowsAgent") &&
      template?.dualPathRule?.enabled &&
      template.dualPathRule.mode === "DesktopFirstShortDelayWhatsApp"
    ) {
      return {
        channel,
        strategy: "DelayedFollowUp",
        plannedDelaySeconds: template.dualPathRule.delaySeconds ?? null,
      };
    }

    return {
      channel,
      strategy: "Optional",
      plannedDelaySeconds: null,
    };
  });
}

function normalizeChannelArray(value: unknown): Channel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((channel): channel is Channel => typeof channel === "string");
}
