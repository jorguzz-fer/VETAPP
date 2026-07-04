'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePortalAuth } from '@/providers/PortalAuthProvider';
import { portalApi, portalTokenStore } from '@/lib/portalApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const inputCls =
  'w-full rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

function ConviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { acceptInvite } = usePortalAuth();
  const token = params.get('token') ?? '';

  const [preview, setPreview] = useState<{ responsavelNome: string; clinicaNome: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = params.get('t');
    if (t) portalTokenStore.setTenant(t);
  }, [params]);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      return;
    }
    (async () => {
      const { data, error } = await portalApi.GET('/api/portal/convite/{token}', {
        params: { path: { token } },
      });
      if (error || !data) setInvalid(true);
      else setPreview(data);
    })();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setBusy(true);
    try {
      await acceptInvite(token, password);
      router.replace('/portal');
    } catch {
      setError('Não foi possível ativar seu acesso. O convite pode ter expirado.');
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
        </div>
        <Card>
          {invalid ? (
            <div className="text-center py-4">
              <i className="ri-error-warning-line text-3xl text-amber-500"></i>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                Convite inválido ou expirado. Peça um novo link à clínica.
              </p>
            </div>
          ) : !preview ? (
            <p className="text-sm text-gray-500 text-center py-4">Carregando convite…</p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Olá, <strong>{preview.responsavelNome}</strong>! Crie sua senha para acessar o portal da{' '}
                <strong>{preview.clinicaNome}</strong>.
              </p>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Nova senha</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="mínimo 8 caracteres"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Confirme a senha</span>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </label>
              <Button type="submit" disabled={busy} className="justify-center mt-1">
                {busy ? 'Ativando…' : 'Criar senha e entrar'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-gray-500">Carregando…</div>}>
      <ConviteInner />
    </Suspense>
  );
}
