'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, tokenStore } from '@/lib/api';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Token temporário do desafio MFA (escopo 'mfa'), entre o login e o código.
  const mfaTokenRef = useRef<string | null>(null);

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

  const finishSession = useCallback(async (accessToken: string) => {
    tokenStore.set(accessToken);
    const me = await api.GET('/api/auth/me');
    setUser(me.data ?? null);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginStep> => {
      const { data, error } = await api.POST('/api/auth/login', { body: { email, password } });
      if (error || !data) throw new Error('Credenciais inválidas');
      if (data.mfaRequired && data.mfaToken) {
        mfaTokenRef.current = data.mfaToken;
        return 'mfa';
      }
      if (!data.accessToken) throw new Error('Resposta inesperada do login');
      await finishSession(data.accessToken);
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
      await finishSession(data.accessToken);
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
      await finishSession(data.accessToken);
    },
    [finishSession],
  );

  const register = useCallback(
    async (input: { tenantName: string; name: string; email: string; password: string }) => {
      const { data, error } = await api.POST('/api/auth/register', { body: input });
      if (error || !data) throw new Error('Não foi possível criar a conta');
      await finishSession(data.accessToken);
    },
    [finishSession],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    mfaTokenRef.current = null;
    setUser(null);
  }, []);

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
