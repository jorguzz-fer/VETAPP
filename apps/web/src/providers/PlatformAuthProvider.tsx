'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { platformApi, platformTokenExpiry, platformTokenStore } from '@/lib/platformApi';

export interface PlatformAdmin {
  adminId: string;
  email: string;
  nome: string;
}

// Passos do login: 'ok' (sessão), 'mfa' (código) ou 'mfa_setup' (setup forçado).
type LoginStep = 'ok' | 'mfa' | 'mfa_setup';

interface PlatformAuthContextValue {
  admin: PlatformAdmin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginStep>;
  verifyMfa: (code: string) => Promise<void>;
  forcedMfaSetup: () => Promise<{ secret: string; otpauthUrl: string }>;
  forcedMfaEnable: (code: string) => Promise<string[]>;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);
const REFRESH_SKEW_MS = 60_000;

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const mfaTokenRef = useRef<string | null>(null);
  const setupTokenRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = platformTokenStore.getRefresh();
    if (!refreshToken) return null;
    const { data, error } = await platformApi.POST('/api/platform/auth/refresh', { body: { refreshToken } });
    if (error || !data?.accessToken) {
      platformTokenStore.clear();
      return null;
    }
    platformTokenStore.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  }, []);

  const scheduleRefresh = useCallback(
    (accessToken: string) => {
      clearTimer();
      const exp = platformTokenExpiry(accessToken);
      if (!exp) return;
      const delay = Math.max(exp - Date.now() - REFRESH_SKEW_MS, 1_000);
      refreshTimer.current = setTimeout(async () => {
        const next = await refreshSession();
        if (next) scheduleRefresh(next);
        else setAdmin(null);
      }, delay);
    },
    [clearTimer, refreshSession],
  );

  const finishSession = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      platformTokenStore.set(accessToken, refreshToken);
      const { data } = await platformApi.GET('/api/platform/auth/me');
      setAdmin(data ?? null);
      scheduleRefresh(accessToken);
    },
    [scheduleRefresh],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      let token = platformTokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      const exp = platformTokenExpiry(token);
      if (!exp || exp - Date.now() <= REFRESH_SKEW_MS) token = await refreshSession();
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await platformApi.GET('/api/platform/auth/me');
      if (!active) return;
      if (data) {
        setAdmin(data);
        scheduleRefresh(token);
      } else {
        platformTokenStore.clear();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshSession, scheduleRefresh]);

  useEffect(() => clearTimer, [clearTimer]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginStep> => {
      const { data, error } = await platformApi.POST('/api/platform/auth/login', { body: { email, password } });
      if (error || !data) throw new Error('Credenciais inválidas');
      if (data.mfaRequired && data.mfaToken) {
        mfaTokenRef.current = data.mfaToken;
        return 'mfa';
      }
      if (data.mfaSetupRequired && data.mfaSetupToken) {
        setupTokenRef.current = data.mfaSetupToken;
        return 'mfa_setup';
      }
      if (!data.accessToken) throw new Error('Resposta inesperada do login');
      await finishSession(data.accessToken, data.refreshToken);
      return 'ok';
    },
    [finishSession],
  );

  const verifyMfa = useCallback(
    async (code: string) => {
      const mfaToken = mfaTokenRef.current;
      if (!mfaToken) throw new Error('Sessão de MFA ausente — faça login novamente');
      const { data, error } = await platformApi.POST('/api/platform/auth/mfa/verify', { body: { mfaToken, code } });
      if (error || !data) throw new Error('Código inválido');
      mfaTokenRef.current = null;
      await finishSession(data.accessToken, data.refreshToken);
    },
    [finishSession],
  );

  const forcedMfaSetup = useCallback(async (): Promise<{ secret: string; otpauthUrl: string }> => {
    const setupToken = setupTokenRef.current;
    if (!setupToken) throw new Error('Sessão de configuração ausente — faça login novamente');
    const { data, error } = await platformApi.POST('/api/platform/auth/mfa/forced-setup', { body: { setupToken } });
    if (error || !data) throw new Error('Falha ao iniciar o setup do MFA');
    return data;
  }, []);

  const forcedMfaEnable = useCallback(
    async (code: string): Promise<string[]> => {
      const setupToken = setupTokenRef.current;
      if (!setupToken) throw new Error('Sessão de configuração ausente — faça login novamente');
      const { data, error } = await platformApi.POST('/api/platform/auth/mfa/forced-enable', {
        body: { setupToken, code },
      });
      if (error || !data) throw new Error('Código inválido');
      setupTokenRef.current = null;
      await finishSession(data.accessToken, data.refreshToken);
      return data.recoveryCodes;
    },
    [finishSession],
  );

  const logout = useCallback(() => {
    const refreshToken = platformTokenStore.getRefresh();
    if (refreshToken) void platformApi.POST('/api/platform/auth/logout', { body: { refreshToken } });
    clearTimer();
    platformTokenStore.clear();
    mfaTokenRef.current = null;
    setupTokenRef.current = null;
    setAdmin(null);
  }, [clearTimer]);

  const value = useMemo(
    () => ({ admin, loading, login, verifyMfa, forcedMfaSetup, forcedMfaEnable, logout }),
    [admin, loading, login, verifyMfa, forcedMfaSetup, forcedMfaEnable, logout],
  );
  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth deve ser usado dentro de <PlatformAuthProvider>');
  return ctx;
}
