import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { AuditLogService } from "../../audit/service/audit-log-service.js";
import { CommunicationDraftService } from "../../communications/service/communication-draft-service.js";

type DeviceActionActor = {
  userIdentifier: string;
  username: string;
  ipAddress?: string | null;
};

type SendDeviceTestNotificationInput = {
  title?: string | null;
  body?: string | null;
  instruction?: string | null;
  windowsAgentPresentation?: "Toast" | "Modal" | "Fullscreen" | null;
};

type DeviceLookupRow = {
  id: string;
  deviceIdentifier: string | null;
  hostname: string;
  status: "Online" | "Offline" | "Stale";
};

export class DeviceActionService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly communicationDraftService: CommunicationDraftService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async sendTestNotification(
    deviceId: string,
    input: SendDeviceTestNotificationInput,
    actor: DeviceActionActor,
  ) {
    const device = await this.getDeviceById(deviceId);
    if (!device) {
      throw new AppError({
        statusCode: 404,
        code: "DEVICE_NOT_FOUND",
        message: "The requested device was not found.",
      });
    }

    if (device.status !== "Online") {
      throw new AppError({
        statusCode: 409,
        code: "DEVICE_TEST_NOTIFICATION_DEVICE_OFFLINE",
        message: "Test notifications can only be sent to devices that are currently online.",
      });
    }

    const now = new Date().toISOString();
    const published = await this.communicationDraftService.publishCommunication(
      (
        await this.communicationDraftService.createDraft({
          communicationType: "OperationalNotice",
          priority: "Info",
          category: "General",
          title: input.title?.trim() || `[Device Test] ${device.hostname}`,
          body:
            input.body?.trim() ||
            `This is a test notification from MTI Alert for ${device.hostname}. If this message is visible on the Windows Agent, realtime delivery is working.`,
          instruction:
            input.instruction?.trim() ||
            "Confirm that the popup shows a separate instruction block below the main message body.",
          channelSelections: ["WindowsAgent"],
          targets: [{ targetType: "Device", targetValue: device.id }],
          windowsAgentPresentation: input.windowsAgentPresentation ?? "Toast",
        })
      ).id,
      {
        publishMode: "Now",
        confirmedPreview: true,
      },
      actor,
    );

    await this.auditLogService.recordNow({
      actorUserId: actor.userIdentifier,
      actorUsername: actor.username,
      actionType: "SendDeviceTestNotification",
      moduleName: "Devices",
      entityType: "Device",
      entityId: device.id,
      description: `Sent a device-scoped Windows Agent test notification to ${device.hostname}.`,
      ipAddress: actor.ipAddress ?? null,
      metadata: {
        deviceId: device.id,
        deviceIdentifier: device.deviceIdentifier,
        hostname: device.hostname,
        communicationId: published.id,
        communicationStatus: published.status,
      },
      createdAt: now,
    });

    return {
      deviceId: device.id,
      deviceIdentifier: device.deviceIdentifier,
      hostname: device.hostname,
      communicationId: published.id,
      communicationStatus: published.status,
      title: published.title,
      instruction: published.instruction ?? null,
    };
  }

  private async getDeviceById(deviceId: string) {
    const rows = await this.database.query<DeviceLookupRow>(
      `
        select
          id::text as id,
          device_identifier::text as "deviceIdentifier",
          hostname::text as hostname,
          status::text as status
        from public.devices
        where id::text = $1
        limit 1
      `,
      [deviceId],
    );

    return rows[0] ?? null;
  }
}
