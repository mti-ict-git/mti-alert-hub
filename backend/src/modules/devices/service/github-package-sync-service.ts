import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";

export type GitHubPackageSyncStatus = {
  available: boolean;
  id?: string;
  state: "idle" | "queued" | "running" | "completed" | "failed";
  message: string;
  imported?: number;
  skipped?: number;
  rejected?: number;
};

const defaultStore = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../backend/local-packages",
);

export class GitHubPackageSyncService {
  constructor(private readonly store = defaultStore) {}

  private async read(name: string): Promise<Record<string, unknown> | null> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.store, name), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async status(): Promise<GitHubPackageSyncStatus> {
    const heartbeat = await this.read(".relay-heartbeat.json");
    const available =
      typeof heartbeat?.time === "number" && Math.abs(Date.now() - heartbeat.time * 1000) < 30000;
    const request = await this.read(".relay-request.json");
    const result = await this.read(".relay-status.json");
    if (!available)
      return {
        available: false,
        state: "idle",
        message:
          "GitHub worker is unavailable. Start or update package-relay and check its shared package volume.",
      };
    if (request && request.id !== result?.id)
      return {
        available: true,
        id: String(request.id),
        state: "queued",
        message: "Waiting for the GitHub worker to finish its current check.",
      };
    if (result) return { ...result, available: true } as GitHubPackageSyncStatus;
    return { available: true, state: "idle", message: "Ready to check published GitHub packages." };
  }

  async request(username: string): Promise<GitHubPackageSyncStatus> {
    const current = await this.status();
    if (!current.available)
      throw new AppError({
        statusCode: 503,
        code: "GITHUB_RELAY_UNAVAILABLE",
        message: current.message,
      });
    if (current.state === "queued" || current.state === "running") return current;
    const id = randomUUID();
    const temporary = path.join(this.store, ".relay-request-" + id + ".tmp");
    await fs.writeFile(
      temporary,
      JSON.stringify({ id, requestedBy: username, requestedAt: new Date().toISOString() }),
      { flag: "wx" },
    );
    try {
      // Publish the complete request atomically; simultaneous clicks reuse the active request.
      await fs.link(temporary, path.join(this.store, ".relay-request.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    } finally {
      await fs.unlink(temporary);
    }
    return this.status();
  }
}
