'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { usePlatformAuth } from '@/providers/PlatformAuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

export default function PlataformaLoginPage() {
  const router = useRouter();
  const { login, verifyMfa, forcedMfaSetup, forcedMfaEnable } = usePlatformAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');

  const [mfaStep, setMfaStep] = useState(false);
  const [setupStep, setSetupStep] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const startForcedSetup = useCallback(async () => {
    setSetupStep(true);
    try {
      const data = await forcedMfaSetup();
      setSetupSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
    } catch {
      setError('Falha ao iniciar a configuração do MFA. Faça login novamente.');
    }
  }, [forcedMfaSetup]);

  useEffect(() => {
    if (setupStep && otpauthUrl && !recoveryCodes && qrRef.current) {
      void QRCode.toCanvas(qrRef.current, otpauthUrl, { width: 200, margin: 1 });
    }
  }, [setupStep, otpauthUrl, recoveryCodes]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const step = await login(email, password);
      if (step === 'mfa') setMfaStep(true);
      else if (step === 'mfa_setup') await startForcedSetup();
      else router.push('/plataforma');
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
      router.push('/plataforma');
    } catch {
      setError('Código inválido ou expirado.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitForcedEnable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setRecoveryCodes(await forcedMfaEnable(code));
    } catch {
      setError('Código inválido. Confira o app autenticador.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="w-full max-w-[400px]">
        <div className="flex items-center gap-2 font-bold text-lg mb-1">
          <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-primary-500 text-white">
            <i className="ri-shield-star-line"></i>
          </span>
          VETAPP <span className="text-gray-400 font-normal text-base">· Plataforma</span>
        </div>

        {setupStep ? (
          recoveryCodes ? (
            <>
              <p className="text-sm text-gray-500 mb-2">
                MFA ativado! Guarde os <strong>códigos de recuperação</strong> — cada um serve uma vez.
              </p>
              <div className="grid grid-cols-2 gap-2 my-4 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <span key={c} className="rounded bg-gray-50 dark:bg-[#15203c] px-2 py-1 text-center">{c}</span>
                ))}
              </div>
              <Button onClick={() => router.push('/plataforma')} className="w-full justify-center">Continuar</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Acesso do super-admin exige <strong>autenticação em duas etapas</strong>. Escaneie o QR e digite o código.
              </p>
              <div className="flex justify-center mb-3"><canvas ref={qrRef} /></div>
              {setupSecret && (
                <p className="text-xs text-gray-400 text-center mb-4 break-all">
                  Ou a chave: <span className="font-mono">{setupSecret}</span>
                </p>
              )}
              <form onSubmit={onSubmitForcedEnable} className="flex flex-col gap-4">
                <input
                  required autoFocus inputMode="numeric" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputCls} text-center text-lg tracking-[0.5em]`} placeholder="••••••"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" disabled={submitting} className="justify-center">
                  {submitting ? 'Ativando…' : 'Ativar e entrar'}
                </Button>
              </form>
            </>
          )
        ) : mfaStep ? (
          <>
            <p className="text-sm text-gray-500 mb-5">Digite o código do seu app autenticador</p>
            <form onSubmit={onSubmitMfa} className="flex flex-col gap-4">
              <input
                required autoFocus inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputCls} text-center text-lg tracking-[0.5em]`} placeholder="••••••"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" disabled={submitting} className="justify-center">
                {submitting ? 'Verificando…' : 'Verificar'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5">Back-office da plataforma</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">E-mail</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Senha</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)} className={`${inputCls} w-full pr-10`}
                  />
                  <button
                    type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-primary-500"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <i className={showPassword ? 'ri-eye-off-line text-lg' : 'ri-eye-line text-lg'}></i>
                  </button>
                </div>
              </label>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" disabled={submitting} className="justify-center">
                {submitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
