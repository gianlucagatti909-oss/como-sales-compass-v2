import { useState, useCallback } from "react";
import { UserProfile } from "@/types/auth";
import { getCurrentUser, login, logout } from "@/lib/auth-store";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(getCurrentUser);

  const doLogin = useCallback((username: string, password: string): UserProfile | null => {
    const u = login(username, password);
    setUser(u);
    return u;
  }, []);

  const doLogout = useCallback(() => {
    logout();
    setUser(null);
  }, []);

  const refresh = useCallback(() => {
    setUser(getCurrentUser());
  }, []);

  return { user, login: doLogin, logout: doLogout, refresh, isAdmin: user?.role === "admin" };
}
