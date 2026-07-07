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

export const authService = {
  async login(username: string, password: string): Promise<User> {
    const session = await apiClient.post<AuthSessionResponse>("/auth/login", {
      username,
      password,
    });
    const user = mapAuthUser(session.user);

    sessionService.setSession({
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt ?? null,
      user,
    });

    return user;
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>("/auth/logout");
    } finally {
      sessionService.clearSession();
    }
  },
  getCurrentUser(): User | null {
    return sessionService.getSession()?.user ?? null;
  },
};

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
