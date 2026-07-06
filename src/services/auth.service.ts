// Mock auth service.
// TODO(backend): POST /api/auth/login → { user, token }; store JWT in httpOnly cookie or memory.
import type { User } from "@/types";
import { mockDelay } from "@/lib/mock-delay";

const STORAGE_KEY = "mti_alert_user";

export const authService = {
  async login(username: string, _password: string): Promise<User> {
    await mockDelay(400);
    const user: User = {
      id: "u-1",
      username,
      name: username
        .split(".")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      role: "Admin",
      email: `${username}@mti.co.id`,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },
  async logout(): Promise<void> {
    await mockDelay(150);
    localStorage.removeItem(STORAGE_KEY);
  },
  getCurrentUser(): User | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
};
