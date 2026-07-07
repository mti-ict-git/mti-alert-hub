import { useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import { sessionService } from "@/services/session.service";
import type { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());

  useEffect(() => {
    return sessionService.subscribe(() => setUser(authService.getCurrentUser()));
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    async login(username: string, password: string) {
      const u = await authService.login(username, password);
      setUser(u);
      return u;
    },
    async logout() {
      await authService.logout();
      setUser(null);
    },
  };
}
