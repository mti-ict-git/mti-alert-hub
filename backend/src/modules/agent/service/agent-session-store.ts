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

export class AgentSessionStore {
  constructor(
    private readonly database: DatabaseClient,
    private readonly sessionTtlMs: number,
  ) {}

  async createSession(options: CreateAgentSessionOptions): Promise<AgentSession> {
    const sessionToken = randomUUID();
    const expiresAt = this.buildSessionExpiry();

    const session: AgentSession = {
      sessionToken,
      expiresAt,
      device: options.device,
    };

    await this.database.withTransaction(async (transaction) => {
      await transaction.query(
        `
          delete from public.device_sessions
          where expires_at <= now()
             or device_id = $1::uuid
        `,
        [options.device.id],
      );
      await transaction.query(
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
    });

    return session;
  }

  async getSession(sessionToken: string): Promise<AgentSession | undefined> {
    const persistedSession = await this.findPersistedSession(sessionToken);
    if (!persistedSession) {
      return undefined;
    }

    if (isExpired(persistedSession.expiresAt)) {
      await this.deletePersistedSession(persistedSession.sessionTokenHash);
      return undefined;
    }

    return mapPersistedSession(sessionToken, persistedSession);
  }

  async renewSession(sessionToken: string): Promise<AgentSession | undefined> {
    const persistedSession = await this.findPersistedSession(sessionToken);
    if (!persistedSession) {
      return undefined;
    }

    if (isExpired(persistedSession.expiresAt)) {
      await this.deletePersistedSession(persistedSession.sessionTokenHash);
      return undefined;
    }

    const expiresAt = this.buildSessionExpiry();
    await this.database.query(
      `
        update public.device_sessions
        set expires_at = $2::timestamptz
        where session_token_hash = $1
      `,
      [persistedSession.sessionTokenHash, expiresAt],
    );

    return {
      ...mapPersistedSession(sessionToken, persistedSession),
      expiresAt,
    };
  }

  async revokeDeviceSessions(deviceId: string) {
    const rows = await this.database.query<{ id: string }>(
      `
        delete from public.device_sessions
        where device_id = $1::uuid
        returning device_id::text as id
      `,
      [deviceId],
    );

    return rows.length;
  }

  async getDiagnostics() {
    const [activeRows, expiringRows] = await Promise.all([
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.device_sessions
          where expires_at > now()
        `,
      ),
      this.database.query<{ totalItems: number }>(
        `
          select count(*)::int as "totalItems"
          from public.device_sessions
          where expires_at > now()
            and expires_at <= now() + interval '15 minutes'
        `,
      ),
    ]);

    return {
      activeCount: activeRows[0]?.totalItems ?? 0,
      expiringWithin15MinutesCount: expiringRows[0]?.totalItems ?? 0,
      ttlMinutes: Math.floor(this.sessionTtlMs / 60000),
    };
  }

  private buildSessionExpiry() {
    return new Date(Date.now() + this.sessionTtlMs).toISOString();
  }

  private async findPersistedSession(sessionToken: string) {
    const sessionRows = await this.database.query<PersistedAgentSessionRow>(
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

    return sessionRows[0];
  }

  private async deletePersistedSession(sessionTokenHash: string) {
    await this.database.query(
      `
        delete from public.device_sessions
        where session_token_hash = $1
      `,
      [sessionTokenHash],
    );
  }
}

type PersistedAgentSessionRow = {
  sessionTokenHash: string;
  expiresAt: string;
  deviceId: string;
  deviceIdentifier: string | null;
  hostname: string;
};

function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function mapPersistedSession(
  sessionToken: string,
  persistedSession: PersistedAgentSessionRow,
): AgentSession {
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
