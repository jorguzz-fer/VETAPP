'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from '@/lib/api';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Ao montar, se houver token, resolve o usuário via /auth/me.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }
      const { data } = await api.GET('/api/auth/me');
      if (active) {
        setUser(data ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await api.POST('/api/auth/login', { body: { email, password } });
    if (error || !data) throw new Error('Credenciais inválidas');
    tokenStore.set(data.accessToken);
    const me = await api.GET('/api/auth/me');
    setUser(me.data ?? null);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
