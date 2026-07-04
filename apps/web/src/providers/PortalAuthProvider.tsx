'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { portalApi, portalTokenExpiry, portalTokenStore } from '@/lib/portalApi';

export interface PortalTutor {
  responsavelId: string;
  nome: string;
  email: string | null;
  clinicaNome: string;
}

interface PortalAuthContextValue {
  tutor: PortalTutor | null;
  loading: boolean;
  login: (tenantId: string, email: string, password: string) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
  logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

const REFRESH_SKEW_MS = 60_000;

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [tutor, setTutor] = useState<PortalTutor | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = portalTokenStore.getRefresh();
    if (!refreshToken) return null;
    const { data, error } = await portalApi.POST('/api/portal/refresh', { body: { refreshToken } });
    if (error || !data?.accessToken) {
      portalTokenStore.clear();
      return null;
    }
    portalTokenStore.set(data.accessToken, data.refreshToken, data.tenantId);
    return data.accessToken;
  }, []);

  const scheduleRefresh = useCallback(
    (accessToken: string) => {
      clearTimer();
      const exp = portalTokenExpiry(accessToken);
      if (!exp) return;
      const delay = Math.max(exp - Date.now() - REFRESH_SKEW_MS, 1_000);
      refreshTimer.current = setTimeout(async () => {
        const next = await refreshSession();
        if (next) scheduleRefresh(next);
        else setTutor(null);
      }, delay);
    },
    [clearTimer, refreshSession],
  );

  const loadMe = useCallback(
    async (accessToken: string) => {
      const { data } = await portalApi.GET('/api/portal/me');
      setTutor(data ?? null);
      if (data) scheduleRefresh(accessToken);
    },
    [scheduleRefresh],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      let token = portalTokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      const exp = portalTokenExpiry(token);
      if (!exp || exp - Date.now() <= REFRESH_SKEW_MS) {
        token = await refreshSession();
      }
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await portalApi.GET('/api/portal/me');
      if (!active) return;
      if (data) {
        setTutor(data);
        scheduleRefresh(token);
      } else {
        portalTokenStore.clear();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshSession, scheduleRefresh]);

  useEffect(() => clearTimer, [clearTimer]);

  const login = useCallback(
    async (tenantId: string, email: string, password: string) => {
      const { data, error } = await portalApi.POST('/api/portal/login', { body: { tenantId, email, password } });
      if (error || !data) throw new Error('Credenciais inválidas');
      portalTokenStore.set(data.accessToken, data.refreshToken, data.tenantId);
      await loadMe(data.accessToken);
    },
    [loadMe],
  );

  const acceptInvite = useCallback(
    async (token: string, password: string) => {
      const { data, error } = await portalApi.POST('/api/portal/convite/aceitar', { body: { token, password } });
      if (error || !data) throw new Error('Não foi possível aceitar o convite');
      portalTokenStore.set(data.accessToken, data.refreshToken, data.tenantId);
      await loadMe(data.accessToken);
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    const refreshToken = portalTokenStore.getRefresh();
    if (refreshToken) void portalApi.POST('/api/portal/logout', { body: { refreshToken } });
    clearTimer();
    portalTokenStore.clear();
    setTutor(null);
  }, [clearTimer]);

  const value = useMemo(
    () => ({ tutor, loading, login, acceptInvite, logout }),
    [tutor, loading, login, acceptInvite, logout],
  );
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth deve ser usado dentro de <PortalAuthProvider>');
  return ctx;
}
