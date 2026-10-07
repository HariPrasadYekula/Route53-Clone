"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { UNAUTHORIZED_EVENT, api } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, account?: string) => Promise<void>;
  signup: (username: string, password: string, accountName: string) => Promise<User>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  // Any API call that finds the session gone signs the user out locally, which sends them to /login.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (u: string, p: string, a?: string) => setUser(await api.login(u, p, a)), []);
  const signup = useCallback(async (username: string, password: string, accountName: string) => {
    const created = await api.signup({ username, password, account_name: accountName });
    setUser(created);
    return created;
  }, []);
  const logout = useCallback(async () => { await api.logout().catch(() => undefined); setUser(null); }, []);
  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}
