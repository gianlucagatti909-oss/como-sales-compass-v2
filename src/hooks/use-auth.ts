import { useState, useCallback, useEffect } from "react";
import { UserProfile } from "@/types/auth";
import { getCurrentUser, login, logout } from "@/lib/auth-store";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then(u => {
      if (!cancelled) { setUser(u); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const doLogin = useCallback(async (username: string, password: string): Promise<UserProfile | null> => {
    const u = await login(username, password);
    setUser(u);
    return u;
  }, []);

  const doLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const u = await getCurrentUser();
    setUser(u);
  }, []);

  return { user, login: doLogin, logout: doLogout, refresh, loading, isAdmin: user?.role === "admin" };
}
