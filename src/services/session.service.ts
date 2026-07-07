import type { User } from "@/types";

const STORAGE_KEY = "mti_alert_session";

export type StoredAuthSession = {
  sessionToken: string;
  expiresAt?: string | null;
  user: User;
};

export const sessionService = {
  getSession(): StoredAuthSession | null {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuthSession) : null;
  },
  getSessionToken(): string | null {
    return this.getSession()?.sessionToken ?? null;
  },
  setSession(session: StoredAuthSession) {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },
  clearSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  },
};
