import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs, type Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { DeviceHealthThresholds } from "../../../app/config/env.js";
import type { AuditLogService } from "../../audit/service/audit-log-service.js";
import { CommunicationDraftService } from "../../communications/service/communication-draft-service.js";
import { buildDeviceHealthStatusSql } from "./device-health-sql.js";

const execFileAsync = promisify(execFile);
const localPackagesDirectory = path.resolve(process.cwd(), "backend", "local-packages");
const maxUploadedPackageBytes = 1024 * 1024 * 512;
const prepareRolloutScriptPath = path.resolve(
  process.cwd(),
  "MTI.Alert.Agent",
  "Installer",
  "prepare-agent-rollout-package.ps1",
);

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

type CreateDeviceRolloutInput = {
  version: string;
  packageUrl: string;
  sha256: string;
  signature: string;
  rolloutChannel?: string | null;
  action?: "Upgrade" | "Repair" | "Uninstall";
  mandatory?: boolean;
  notes?: string | null;
  releaseNotes?: string | null;
  deadlineAt?: string | null;
  apply?: boolean;
};

type LocalRolloutPackageSummary = {
  fileName: string;
  fileSizeBytes: number;
  lastModifiedAt: string;
  version: string | null;
  packageUrl: string;
  sha256: string | null;
  signature: string | null;
  signatureStatus: string | null;
  signatureStatusMessage: string | null;
  signerSubject: string | null;
  signerIssuer: string | null;
  rolloutCommand: string | null;
};

type UploadLocalPackageResult = {
  package: LocalRolloutPackageSummary;
  alreadyExists: boolean;
};

type DeviceLookupRow = {
  id: string;
  deviceIdentifier: string | null;
  hostname: string;
  agentVersion: string | null;
  status: "Online" | "Offline" | "Stale";
};

type UpsertedReleasePackageRow = {
  id: string;
  version: string;
  packageUrl: string;
};

type InsertedRolloutIntentRow = {
  id: string;
  action: string;
  targetVersion: string;
  createdAt: string;
};

export class DeviceActionService {
  private readonly statusSql: string;

  constructor(
    private readonly database: DatabaseClient,
    private readonly communicationDraftService: CommunicationDraftService,
    private readonly auditLogService: AuditLogService,
    thresholds: DeviceHealthThresholds,
  ) {
    this.statusSql = buildDeviceHealthStatusSql(thresholds);
  }

  async listLocalPackages(baseUrl: string): Promise<LocalRolloutPackageSummary[]> {
    let entries: Dirent<string>[] = [];
    try {
      entries = await fs.readdir(localPackagesDirectory, { withFileTypes: true, encoding: "utf8" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const files = entries
      .filter((entry: Dirent<string>) => entry.isFile() && entry.name.toLowerCase().endsWith(".msi"))
      .map((entry: Dirent<string>) => entry.name)
      .sort((left: string, right: string) => right.localeCompare(left));

    const inspectedPackages = await Promise.all(
      files.map(async (fileName: string) => {
        return this.buildLocalPackageSummary(fileName, baseUrl);
      }),
    );

    return inspectedPackages;
  }

  async uploadLocalPackage(
    fileName: string,
    content: Buffer,
    baseUrl: string,
    actor: DeviceActionActor,
  ): Promise<UploadLocalPackageResult> {
    if (content.length === 0) {
      throw validationError("file", "Upload content is empty.");
    }

    if (content.length > maxUploadedPackageBytes) {
      throw validationError(
        "file",
        `Uploaded MSI exceeds the ${Math.floor(maxUploadedPackageBytes / 1024 / 1024)} MB limit.`,
      );
    }

    const sanitizedFileName = sanitizeUploadedMsiFileName(fileName);
    await fs.mkdir(localPackagesDirectory, { recursive: true });

    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "mti-rollout-upload-"));
    const tempPath = path.join(tempDirectory, sanitizedFileName);

    try {
      await fs.writeFile(tempPath, content);

      const initialInspection = await this.inspectLocalPackage(
        tempPath,
        buildLocalPackageUrl(sanitizedFileName, baseUrl),
        baseUrl,
      );
      const publishedFileName = buildPublishedPackageFileName(
        sanitizedFileName,
        initialInspection.version,
      );
      const publishedPath = path.join(localPackagesDirectory, publishedFileName);

      let alreadyExists = false;
      try {
        const existingHash = await hashFileSha256(publishedPath);
        const uploadedHash = initialInspection.sha256 ?? (await hashFileSha256(tempPath));
        if (existingHash !== uploadedHash) {
          throw new AppError({
            statusCode: 409,
            code: "PACKAGE_UPLOAD_CONFLICT",
            message:
              "A different package already exists with the same published file name. Upload a uniquely versioned MSI instead.",
          });
        }

        alreadyExists = true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          await fs.rename(tempPath, publishedPath);
        } else {
          throw error;
        }
      }

      const summary = await this.buildLocalPackageSummary(publishedFileName, baseUrl);
      const now = new Date().toISOString();

      await this.auditLogService.recordNow({
        actorUserId: actor.userIdentifier,
        actorUsername: actor.username,
        actionType: "UploadDeviceRolloutPackage",
        moduleName: "Devices",
        entityType: "Device",
        entityId: "local-package-store",
        description: `${
          alreadyExists ? "Reused" : "Uploaded"
        } rollout package ${publishedFileName} for admin device rollout.`,
        ipAddress: actor.ipAddress ?? null,
        metadata: {
          fileName: summary.fileName,
          packageUrl: summary.packageUrl,
          version: summary.version,
          sha256: summary.sha256,
          signature: summary.signature,
          alreadyExists,
        },
        createdAt: now,
      });

      return {
        package: summary,
        alreadyExists,
      };
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  async readLocalPackage(fileName: string) {
    const sanitizedFileName = sanitizeUploadedMsiFileName(fileName);
    const fullPath = path.join(localPackagesDirectory, sanitizedFileName);

    try {
      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) {
        throw createPackageNotFoundError(sanitizedFileName);
      }

      return {
        fileName: sanitizedFileName,
        content: await fs.readFile(fullPath),
        contentLength: stats.size,
        lastModifiedAt: stats.mtime.toUTCString(),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        throw createPackageNotFoundError(sanitizedFileName);
      }

      throw error;
    }
  }

  async createRollout(
    deviceId: string,
    input: CreateDeviceRolloutInput,
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

    const normalizedInput = {
      version: input.version.trim(),
      packageUrl: input.packageUrl.trim(),
      sha256: normalizeHex(input.sha256),
      signature: normalizeHex(input.signature),
      rolloutChannel: input.rolloutChannel?.trim() || "pilot",
      action: input.action ?? "Upgrade",
      mandatory: input.mandatory ?? false,
      notes: input.notes?.trim() || null,
      releaseNotes: input.releaseNotes?.trim() || null,
      deadlineAt: input.deadlineAt?.trim() || null,
      apply: input.apply ?? true,
    };

    if (!normalizedInput.version) {
      throw validationError("version", "Version is required.");
    }

    assertHttpUrl(normalizedInput.packageUrl, "packageUrl");

    if (!normalizedInput.sha256) {
      throw validationError("sha256", "SHA256 is required.");
    }

    if (!normalizedInput.signature) {
      throw validationError("signature", "Signature thumbprint is required.");
    }

    if (normalizedInput.deadlineAt) {
      const parsed = Date.parse(normalizedInput.deadlineAt);
      if (Number.isNaN(parsed)) {
        throw validationError("deadlineAt", "deadlineAt must be a valid ISO-8601 timestamp.");
      }
    }

    const activeRollouts = await this.database.query<{ count: string }>(
      `
        select count(*)::text as count
        from public.agent_rollout_intents
        where device_id = $1::uuid
          and is_active = true
      `,
      [device.id],
    );

    if (!normalizedInput.apply) {
      return {
        ok: true,
        mode: "dry-run" as const,
        target: {
          id: device.id,
          hostname: device.hostname,
          deviceIdentifier: device.deviceIdentifier,
          agentVersion: device.agentVersion,
          status: device.status,
        },
        rollout: {
          action: normalizedInput.action,
          targetVersion: normalizedInput.version,
          rolloutChannel: normalizedInput.rolloutChannel,
          mandatory: normalizedInput.mandatory,
          deadlineAt: normalizedInput.deadlineAt,
          notes: normalizedInput.notes,
        },
        package: {
          packageType: "MSI" as const,
          packageUrl: normalizedInput.packageUrl,
          sha256: normalizedInput.sha256,
          signature: normalizedInput.signature,
          releaseNotes: normalizedInput.releaseNotes,
        },
        currentlyActiveRollouts: Number.parseInt(activeRollouts[0]?.count ?? "0", 10) || 0,
      };
    }

    const now = new Date().toISOString();
    const result = await this.database.withTransaction(async (transaction) => {
      const releasePackages = await transaction.query<UpsertedReleasePackageRow>(
        `
          insert into public.agent_release_packages (
            version,
            package_type,
            package_url,
            sha256,
            signature,
            release_notes
          )
          values (
            $1,
            'MSI',
            $2,
            $3,
            $4,
            $5
          )
          on conflict (version, package_type)
          do update
          set
            package_url = excluded.package_url,
            sha256 = excluded.sha256,
            signature = excluded.signature,
            release_notes = excluded.release_notes,
            updated_at = now()
          returning
            id::text as id,
            version::text as version,
            package_url::text as "packageUrl"
        `,
        [
          normalizedInput.version,
          normalizedInput.packageUrl,
          normalizedInput.sha256,
          normalizedInput.signature,
          normalizedInput.releaseNotes,
        ],
      );

      const releasePackage = releasePackages[0];
      if (!releasePackage) {
        throw new Error("Failed to upsert release package.");
      }

      const deactivated = await transaction.query<{ id: string }>(
        `
          update public.agent_rollout_intents
          set
            is_active = false,
            updated_at = now()
          where device_id = $1::uuid
            and is_active = true
          returning id::text as id
        `,
        [device.id],
      );

      const rolloutIntents = await transaction.query<InsertedRolloutIntentRow>(
        `
          insert into public.agent_rollout_intents (
            device_id,
            release_package_id,
            action,
            rollout_channel,
            target_version,
            mandatory,
            deadline_at,
            notes,
            is_active
          )
          values (
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5,
            $6,
            $7::timestamptz,
            $8,
            true
          )
          returning
            id::text as id,
            action::text as action,
            target_version::text as "targetVersion",
            created_at::text as "createdAt"
        `,
        [
          device.id,
          releasePackage.id,
          normalizedInput.action,
          normalizedInput.rolloutChannel,
          normalizedInput.version,
          normalizedInput.mandatory,
          normalizedInput.deadlineAt,
          normalizedInput.notes,
        ],
      );

      const rolloutIntent = rolloutIntents[0];
      if (!rolloutIntent) {
        throw new Error("Failed to create rollout intent.");
      }

      return {
        releasePackage,
        rolloutIntent,
        deactivatedCount: deactivated.length,
      };
    });

    await this.auditLogService.recordNow({
      actorUserId: actor.userIdentifier,
      actorUsername: actor.username,
      actionType: "CreateDeviceRollout",
      moduleName: "Devices",
      entityType: "Device",
      entityId: device.id,
      description: `Created ${normalizedInput.action.toLowerCase()} rollout ${normalizedInput.version} for ${device.hostname}.`,
      ipAddress: actor.ipAddress ?? null,
      metadata: {
        deviceId: device.id,
        deviceIdentifier: device.deviceIdentifier,
        hostname: device.hostname,
        targetVersion: normalizedInput.version,
        action: normalizedInput.action,
        rolloutChannel: normalizedInput.rolloutChannel,
        mandatory: normalizedInput.mandatory,
        packageUrl: normalizedInput.packageUrl,
        sha256: normalizedInput.sha256,
        signature: normalizedInput.signature,
        notes: normalizedInput.notes,
        releaseNotes: normalizedInput.releaseNotes,
      },
      createdAt: now,
    });

    return {
      ok: true,
      mode: "applied" as const,
      target: {
        id: device.id,
        hostname: device.hostname,
        deviceIdentifier: device.deviceIdentifier,
        agentVersion: device.agentVersion,
        status: device.status,
        updatedAt: now,
      },
      deactivatedPreviousRollouts: result.deactivatedCount,
      releasePackage: result.releasePackage,
      rolloutIntent: result.rolloutIntent,
    };
  }

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
    const statusSql = this.statusSql;
    const rows = await this.database.query<DeviceLookupRow>(
      `
        select
          d.id::text as id,
          d.device_identifier::text as "deviceIdentifier",
          d.hostname::text as hostname,
          d.agent_version::text as "agentVersion",
          ${statusSql}::text as status
        from public.devices d
        where d.id::text = $1
        limit 1
      `,
      [deviceId],
    );

    return rows[0] ?? null;
  }

  private async inspectLocalPackage(
    msiPath: string,
    packageUrl: string,
    baseUrl: string,
  ) {
    const backendBaseUrl = ensureTrailingSlash(baseUrl).replace(/\/$/, "");
    try {
      const { stdout, stderr } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          prepareRolloutScriptPath,
          "-MsiPath",
          msiPath,
          "-PackageUrl",
          packageUrl,
          "-BackendBaseUrl",
          backendBaseUrl,
          "-SkipSign",
        ],
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 8,
        },
      );

      const payloadText = extractJsonPayload(`${stdout}\n${stderr}`);
      if (!payloadText) {
        return buildMinimalPackageInspection(msiPath);
      }

      const payload = JSON.parse(payloadText) as {
        Version?: string;
        Sha256?: string;
        Thumbprint?: string;
        SignatureStatus?: string;
        SignatureStatusMessage?: string;
        SignerSubject?: string;
        SignerIssuer?: string;
        RolloutCommand?: string;
      };

      return {
        version: payload.Version ?? null,
        sha256: payload.Sha256 ? normalizeHex(payload.Sha256) : await hashFileSha256(msiPath),
        thumbprint: payload.Thumbprint ? normalizeHex(payload.Thumbprint) : null,
        signatureStatus: payload.SignatureStatus ?? null,
        signatureStatusMessage: payload.SignatureStatusMessage ?? null,
        signerSubject: payload.SignerSubject ?? null,
        signerIssuer: payload.SignerIssuer ?? null,
        rolloutCommand: payload.RolloutCommand ?? null,
      };
    } catch {
      return buildMinimalPackageInspection(msiPath);
    }
  }

  private async buildLocalPackageSummary(
    fileName: string,
    baseUrl: string,
  ): Promise<LocalRolloutPackageSummary> {
    const fullPath = path.join(localPackagesDirectory, fileName);
    const stats = await fs.stat(fullPath);
    const packageUrl = buildLocalPackageUrl(fileName, baseUrl);
    const inspected = await this.inspectLocalPackage(fullPath, packageUrl, baseUrl);

    return {
      fileName,
      fileSizeBytes: stats.size,
      lastModifiedAt: stats.mtime.toISOString(),
      version: inspected.version,
      packageUrl,
      sha256: inspected.sha256,
      signature: inspected.thumbprint,
      signatureStatus: inspected.signatureStatus,
      signatureStatusMessage: inspected.signatureStatusMessage,
      signerSubject: inspected.signerSubject,
      signerIssuer: inspected.signerIssuer,
      rolloutCommand: inspected.rolloutCommand,
    } satisfies LocalRolloutPackageSummary;
  }
}

function extractJsonPayload(output: string) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const startIndex = lines.findIndex((line) => line.trimStart().startsWith("{"));
  if (startIndex < 0) {
    return null;
  }

  return lines.slice(startIndex).join("\n").trim();
}

function normalizeHex(value: string) {
  return value.replace(/[^a-f0-9]/gi, "").toUpperCase();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildLocalPackageUrl(fileName: string, baseUrl: string) {
  return new URL(
    `/agent/packages/local/${encodeURIComponent(fileName)}`,
    ensureTrailingSlash(baseUrl),
  ).toString();
}

async function hashFileSha256(filePath: string) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function buildMinimalPackageInspection(msiPath: string) {
  const inferredVersion = inferVersionFromFileName(path.basename(msiPath));
  return {
    version: inferredVersion,
    sha256: await hashFileSha256(msiPath),
    thumbprint: null,
    signatureStatus: null,
    signatureStatusMessage: null,
    signerSubject: null,
    signerIssuer: null,
    rolloutCommand: null,
  };
}

function inferVersionFromFileName(fileName: string) {
  const match = fileName.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
  return match?.[1] ?? null;
}

function createPackageNotFoundError(fileName: string) {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: `Local rollout package '${fileName}' was not found.`,
  });
}

function sanitizeUploadedMsiFileName(fileName: string) {
  const decodedName = decodePossibleUriComponent(fileName.trim());
  const basename = path.basename(decodedName);
  const normalized = basename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^-+/, "")
    .replace(/^\.+/, "");

  if (!normalized || !normalized.toLowerCase().endsWith(".msi")) {
    throw validationError("fileName", "Uploaded package must be an .msi file.");
  }

  return normalized;
}

function buildPublishedPackageFileName(fileName: string, version: string | null) {
  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);
  if (!version) {
    return `${basename}${extension}`;
  }

  if (basename.toLowerCase().endsWith(`.${version.toLowerCase()}`)) {
    return `${basename}${extension}`;
  }

  return `${basename}.${version}${extension}`;
}

function decodePossibleUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function validationError(field: string, message: string) {
  return new AppError({
    statusCode: 422,
    code: "VALIDATION_ERROR",
    message: "The request payload failed validation.",
    details: [{ field, message }],
  });
}

function assertHttpUrl(value: string, field: string) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw validationError(field, `${field} must be a valid absolute http or https URL.`);
  }
}
