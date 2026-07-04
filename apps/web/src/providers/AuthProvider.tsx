'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accessTokenExpiry, api, tokenStore } from '@/lib/api';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

// login/googleLogin devolvem 'ok' (sessão criada) ou 'mfa' (falta o código TOTP).
type LoginStep = 'ok' | 'mfa';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginStep>;
  googleLogin: (idToken: string) => Promise<LoginStep>;
  verifyMfa: (code: string) => Promise<void>;
  register: (input: { tenantName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Renova o access token com antecedência (60s antes do exp).
const REFRESH_SKEW_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Token temporário do desafio MFA (escopo 'mfa'), entre o login e o código.
  const mfaTokenRef = useRef<string | null>(null);
  // Timer da renovação proativa do access token.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  // Troca o refresh token por um novo par (rotação server-side). Retorna o novo
  // access token ou null se a sessão não puder ser renovada.
  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = tokenStore.getRefresh();
    if (!refreshToken) return null;
    const { data, error } = await api.POST('/api/auth/refresh', { body: { refreshToken } });
    if (error || !data?.accessToken) {
      tokenStore.clear();
      return null;
    }
    tokenStore.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  }, []);

  // Agenda a próxima renovação para pouco antes do exp do access token.
  const scheduleRefresh = useCallback(
    (accessToken: string) => {
      clearRefreshTimer();
      const exp = accessTokenExpiry(accessToken);
      if (!exp) return;
      const delay = Math.max(exp - Date.now() - REFRESH_SKEW_MS, 1_000);
      refreshTimer.current = setTimeout(async () => {
        const next = await refreshSession();
        if (next) scheduleRefresh(next);
        else setUser(null);
      }, delay);
    },
    [clearRefreshTimer, refreshSession],
  );

  const finishSession = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      tokenStore.set(accessToken, refreshToken);
      const me = await api.GET('/api/auth/me');
      setUser(me.data ?? null);
      scheduleRefresh(accessToken);
    },
    [scheduleRefresh],
  );

  // Ao montar, resolve a sessão: usa o access token e, se expirado, tenta o refresh.
  useEffect(() => {
    let active = true;
    (async () => {
      let token = tokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      const exp = accessTokenExpiry(token);
      if (!exp || exp - Date.now() <= REFRESH_SKEW_MS) {
        token = await refreshSession();
      }
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await api.GET('/api/auth/me');
      if (!active) return;
      if (data) {
        setUser(data);
        scheduleRefresh(token);
      } else {
        tokenStore.clear();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshSession, scheduleRefresh]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginStep> => {
      const { data, error } = await api.POST('/api/auth/login', { body: { email, password } });
      if (error || !data) throw new Error('Credenciais inválidas');
      if (data.mfaRequired && data.mfaToken) {
        mfaTokenRef.current = data.mfaToken;
        return 'mfa';
      }
      if (!data.accessToken) throw new Error('Resposta inesperada do login');
      await finishSession(data.accessToken, data.refreshToken);
      return 'ok';
    },
    [finishSession],
  );

  const googleLogin = useCallback(
    async (idToken: string): Promise<LoginStep> => {
      const { data, error } = await api.POST('/api/auth/google', { body: { idToken } });
      if (error || !data) throw new Error('Login com Google falhou');
      if (data.mfaRequired && data.mfaToken) {
        mfaTokenRef.current = data.mfaToken;
        return 'mfa';
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
      const { data, error } = await api.POST('/api/auth/mfa/verify', { body: { mfaToken, code } });
      if (error || !data) throw new Error('Código inválido');
      mfaTokenRef.current = null;
      await finishSession(data.accessToken, data.refreshToken);
    },
    [finishSession],
  );

  const register = useCallback(
    async (input: { tenantName: string; name: string; email: string; password: string }) => {
      const { data, error } = await api.POST('/api/auth/register', { body: input });
      if (error || !data) throw new Error('Não foi possível criar a conta');
      await finishSession(data.accessToken, data.refreshToken);
    },
    [finishSession],
  );

  const logout = useCallback(() => {
    const refreshToken = tokenStore.getRefresh();
    // Revoga a family no servidor (best-effort); não bloqueia o logout local.
    if (refreshToken) {
      void api.POST('/api/auth/logout', { body: { refreshToken } });
    }
    clearRefreshTimer();
    tokenStore.clear();
    mfaTokenRef.current = null;
    setUser(null);
  }, [clearRefreshTimer]);

  const value = useMemo(
    () => ({ user, loading, login, googleLogin, verifyMfa, register, logout }),
    [user, loading, login, googleLogin, verifyMfa, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
