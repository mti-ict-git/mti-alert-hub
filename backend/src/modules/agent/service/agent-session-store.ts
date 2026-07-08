import { createHash, randomUUID } from "node:crypto";

import type { DatabaseClient } from "../../../infrastructure/db/connection.js";

type AgentSessionDevice = {
  id: string;
  deviceIdentifier: string | null;
  hostname: string;
};

export type AgentSession = {
  sessionToken: string;
  expiresAt: string;
  device: AgentSessionDevice;
};

type CreateAgentSessionOptions = {
  device: AgentSessionDevice;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export class AgentSessionStore {
  constructor(private readonly database: DatabaseClient) {}

  private readonly sessions = new Map<string, AgentSession>();

  async createSession(options: CreateAgentSessionOptions): Promise<AgentSession> {
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const session: AgentSession = {
      sessionToken,
      expiresAt,
      device: options.device,
    };

    if (await this.database.tableExists("device_sessions")) {
      await this.database.query(
        `
          insert into public.device_sessions (
            device_id,
            session_token_hash,
            expires_at
          )
          values (
            $1::uuid,
            $2,
            $3::timestamptz
          )
        `,
        [options.device.id, hashSessionToken(sessionToken), expiresAt],
      );
      return session;
    }

    this.sessions.set(sessionToken, session);
    return session;
  }

  async getSession(sessionToken: string): Promise<AgentSession | undefined> {
    if (await this.database.tableExists("device_sessions")) {
      const sessionRows = await this.database.query<{
        sessionTokenHash: string;
        expiresAt: string;
        deviceId: string;
        deviceIdentifier: string | null;
        hostname: string;
      }>(
        `
          select
            ds.session_token_hash as "sessionTokenHash",
            ds.expires_at::text as "expiresAt",
            d.id::text as "deviceId",
            d.device_identifier::text as "deviceIdentifier",
            d.hostname::text as hostname
          from public.device_sessions ds
          inner join public.devices d on d.id = ds.device_id
          where ds.session_token_hash = $1
          limit 1
        `,
        [hashSessionToken(sessionToken)],
      );

      const persistedSession = sessionRows[0];
      if (!persistedSession) {
        return undefined;
      }

      if (new Date(persistedSession.expiresAt).getTime() <= Date.now()) {
        await this.database.query(
          `
            delete from public.device_sessions
            where session_token_hash = $1
          `,
          [persistedSession.sessionTokenHash],
        );
        return undefined;
      }

      return {
        sessionToken,
        expiresAt: persistedSession.expiresAt,
        device: {
          id: persistedSession.deviceId,
          deviceIdentifier: persistedSession.deviceIdentifier,
          hostname: persistedSession.hostname,
        },
      };
    }

    const session = this.sessions.get(sessionToken);
    if (!session) {
      return undefined;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(sessionToken);
      return undefined;
    }

    return session;
  }
}

function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}
