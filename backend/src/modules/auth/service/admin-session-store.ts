import { randomUUID } from "node:crypto";

import type { AccessProfile } from "../../access/model/admin-access.js";
import type { AuthenticatedDirectoryUser } from "../model/authenticated-directory-user.js";
import type { AdminSession } from "../model/admin-session.js";

type CreateSessionOptions = {
  user: AuthenticatedDirectoryUser;
  accessProfile: AccessProfile;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export class AdminSessionStore {
  private readonly sessions = new Map<string, AdminSession>();

  createSession(options: CreateSessionOptions): AdminSession {
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

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
}
