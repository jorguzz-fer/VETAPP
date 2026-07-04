'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePortalAuth } from '@/providers/PortalAuthProvider';
import { portalTokenStore } from '@/lib/portalApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const inputCls =
  'w-full rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, tutor } = usePortalAuth();
  // O tenant vem do link da clínica (?t=) ou do último acesso guardado.
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromUrl = params.get('t');
    if (fromUrl) portalTokenStore.setTenant(fromUrl);
    setTenantId(fromUrl ?? portalTokenStore.getTenant() ?? '');
  }, [params]);

  useEffect(() => {
    if (tutor) router.replace('/portal');
  }, [tutor, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tenantId) {
      setError('Link de acesso incompleto. Use o link enviado pela clínica.');
      return;
    }
    setBusy(true);
    try {
      await login(tenantId, email, password);
      router.replace('/portal');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <i className="ri-paw-print-fill text-4xl text-primary-500"></i>
          <h1 className="text-xl font-semibold mt-2 text-black dark:text-white">Portal do Tutor</h1>
          <p className="text-sm text-gray-500">Acompanhe seus pets</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">E-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="voce@email.com"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Senha</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </label>
            <Button type="submit" disabled={busy} className="justify-center mt-1">
              {busy ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
        <p className="text-xs text-gray-400 text-center mt-4">
          Recebeu um convite? Abra o link enviado pela clínica para criar sua senha.
        </p>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-gray-500">Carregando…</div>}>
      <LoginInner />
    </Suspense>
  );
}
