import { randomUUID } from "node:crypto";

import type { AccessProfile } from "../../access/model/admin-access.js";
import type { AuthenticatedDirectoryUser } from "../model/authenticated-directory-user.js";
import type { AdminSession } from "../model/admin-session.js";

type CreateSessionOptions = {
  user: AuthenticatedDirectoryUser;
  accessProfile: AccessProfile;
};

export class AdminSessionStore {
  private readonly sessions = new Map<string, AdminSession>();

  constructor(private readonly sessionTtlMs: number) {}

  createSession(options: CreateSessionOptions): AdminSession {
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs).toISOString();

    const session: AdminSession = {
      sessionToken,
      expiresAt,
      user: {
        id: options.user.distinguishedName,
        username: options.user.username,
        fullName: options.user.fullName,
        email: options.user.email,
      },
      accessProfile: options.accessProfile,
    };

    this.sessions.set(sessionToken, session);
    return session;
  }

  getSession(sessionToken: string): AdminSession | undefined {
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

  deleteSession(sessionToken: string): void {
    this.sessions.delete(sessionToken);
  }

  rotateSession(sessionToken: string): AdminSession | undefined {
    const currentSession = this.getSession(sessionToken);
    if (!currentSession) {
      return undefined;
    }

    this.sessions.delete(sessionToken);
    const rotatedSession: AdminSession = {
      ...currentSession,
      sessionToken: randomUUID(),
      expiresAt: new Date(Date.now() + this.sessionTtlMs).toISOString(),
    };
    this.sessions.set(rotatedSession.sessionToken, rotatedSession);
    return rotatedSession;
  }

  getDiagnostics() {
    let activeCount = 0;
    let expiringWithin15MinutesCount = 0;

    for (const [sessionToken, session] of this.sessions.entries()) {
      const expiresAt = new Date(session.expiresAt).getTime();
      if (expiresAt <= Date.now()) {
        this.sessions.delete(sessionToken);
        continue;
      }

      activeCount += 1;
      if (expiresAt <= Date.now() + 15 * 60 * 1000) {
        expiringWithin15MinutesCount += 1;
      }
    }

    return {
      activeCount,
      expiringWithin15MinutesCount,
      ttlMinutes: Math.floor(this.sessionTtlMs / 60000),
    };
  }
}
