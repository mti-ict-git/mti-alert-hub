import type { User } from "@/types";
import { apiClient } from "@/services/api-client";
import { sessionService } from "@/services/session.service";

type AuthSessionResponse = {
  sessionToken: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    email?: string | null;
    roleType: "CentralAdmin" | "LocalOperator" | "ManagementViewer";
  };
  expiresAt?: string | null;
};

let lastValidatedAt = 0;
const SESSION_VALIDATION_TTL_MS = 30_000;

export const authService = {
  async login(username: string, password: string): Promise<User> {
    const session = await apiClient.post<AuthSessionResponse>("/auth/login", {
      username,
      password,
    });
    const user = mapAuthUser(session.user);

    persistSession(session, user);
    lastValidatedAt = Date.now();

    return user;
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>("/auth/logout");
    } finally {
      sessionService.clearSession();
      lastValidatedAt = 0;
    }
  },
  getCurrentUser(): User | null {
    return sessionService.getSession()?.user ?? null;
  },
  async validateSession(force = false): Promise<User | null> {
    const existingSession = sessionService.getSession();
    if (!existingSession?.sessionToken) {
      return null;
    }

    if (!force && Date.now() - lastValidatedAt < SESSION_VALIDATION_TTL_MS) {
      return existingSession.user;
    }

    try {
      const session = await apiClient.get<AuthSessionResponse>("/auth/me");
      const user = mapAuthUser(session.user);
      persistSession(session, user);
      lastValidatedAt = Date.now();
      return user;
    } catch {
      sessionService.clearSession();
      lastValidatedAt = 0;
      return null;
    }
  },
};

function persistSession(session: AuthSessionResponse, user: User) {
  sessionService.setSession({
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt ?? null,
    user,
  });
}

function mapAuthUser(user: AuthSessionResponse["user"]): User {
  return {
    id: user.id,
    username: user.username,
    name: user.fullName,
    role: mapRoleType(user.roleType),
    email: user.email ?? `${user.username}@mti.co.id`,
  };
}

function mapRoleType(roleType: AuthSessionResponse["user"]["roleType"]): User["role"] {
  if (roleType === "CentralAdmin") {
    return "Admin";
  }

  if (roleType === "LocalOperator") {
    return "Operator";
  }

  return "Viewer";
}
