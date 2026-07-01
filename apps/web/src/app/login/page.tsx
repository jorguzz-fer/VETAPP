'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: GoogleCredentialResponse) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login, googleLogin, verifyMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Etapa MFA: após credenciais válidas, pede o código do autenticador.
  const [mfaStep, setMfaStep] = useState(false);
  const [code, setCode] = useState('');

  const googleBtnRef = useRef<HTMLDivElement>(null);

  const onGoogleCredential = useCallback(
    async (resp: GoogleCredentialResponse) => {
      setError(null);
      try {
        const step = await googleLogin(resp.credential);
        if (step === 'mfa') setMfaStep(true);
        else router.push('/dashboard');
      } catch {
        setError('Login com Google falhou. Sua conta já está cadastrada?');
      }
    },
    [googleLogin, router],
  );

  const initGoogle = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential });
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', width: 352 });
  }, [onGoogleCredential]);

  useEffect(() => {
    initGoogle();
  }, [initGoogle]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const step = await login(email, password);
      if (step === 'mfa') setMfaStep(true);
      else router.push('/dashboard');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyMfa(code);
      router.push('/dashboard');
    } catch {
      setError('Código inválido ou expirado.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 dark:bg-[#0a0e19] px-4">
      {GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" onLoad={initGoogle} />}
      <Card className="w-full max-w-[400px]">
        <div className="flex items-center gap-2 font-bold text-lg text-black dark:text-white mb-1">
          <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-primary-500 text-white">
            <i className="ri-heart-pulse-line"></i>
          </span>
          VETAPP
        </div>

        {mfaStep ? (
          <>
            <p className="text-sm text-gray-500 mb-5">Digite o código do seu app autenticador</p>
            <form onSubmit={onSubmitMfa} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Código (6 dígitos)</span>
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputCls} text-center text-lg tracking-[0.5em]`}
                  placeholder="••••••"
                />
              </label>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Verificando…' : 'Verificar'}
              </Button>
              <button type="button" onClick={() => setMfaStep(false)} className="text-sm text-gray-500 hover:text-primary-500">
                Voltar ao login
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5">Entre com sua conta</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">E-mail</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@clinica.com" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Senha</span>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
              </label>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            {GOOGLE_CLIENT_ID && (
              <div className="mt-4">
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                  <span className="flex-1 border-t border-gray-100 dark:border-[#172036]"></span>
                  ou
                  <span className="flex-1 border-t border-gray-100 dark:border-[#172036]"></span>
                </div>
                <div ref={googleBtnRef} className="flex justify-center" />
              </div>
            )}

            <p className="text-sm text-gray-500 mt-4 text-center">
              Não tem conta?{' '}
              <Link href="/cadastro" className="text-primary-500 hover:underline">Criar clínica</Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
