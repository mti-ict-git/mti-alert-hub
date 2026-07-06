import { useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import type { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());

  useEffect(() => {
    const onStorage = () => setUser(authService.getCurrentUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
