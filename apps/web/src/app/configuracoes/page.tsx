'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

export default function ConfiguracoesPage() {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [recoveryRemaining, setRecoveryRemaining] = useState<number>(0);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  // Códigos exibidos UMA vez após ativar/regerar — o servidor só guarda o hash.
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const loadStatus = useCallback(async () => {
    const { data } = await api.GET('/api/auth/mfa/status');
    setMfaEnabled(data?.enabled ?? false);
    setRecoveryRemaining(data?.recoveryCodesRemaining ?? 0);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Desenha o QR quando o setup chega.
  useEffect(() => {
    if (setupData && qrRef.current) {
      void QRCode.toCanvas(qrRef.current, setupData.otpauthUrl, { width: 200, margin: 1 });
    }
  }, [setupData]);

  async function onSetup() {
    setMsg(null);
    setBusy(true);
    const { data, error } = await api.POST('/api/auth/mfa/setup', {});
    setBusy(false);
    if (error || !data) {
      setMsg({ kind: 'err', text: 'Não foi possível iniciar o setup do MFA.' });
      return;
    }
    setSetupData(data);
  }

  async function onEnable(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { data, error } = await api.POST('/api/auth/mfa/enable', { body: { code } });
    setBusy(false);
    if (error || !data) {
      setMsg({ kind: 'err', text: 'Código inválido — confira o app autenticador.' });
      return;
    }
    setSetupData(null);
    setCode('');
    setRecoveryCodes(data.recoveryCodes);
    setMsg({ kind: 'ok', text: 'MFA ativado! Guarde os recovery codes abaixo.' });
    void loadStatus();
  }

  async function onDisable(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { error } = await api.POST('/api/auth/mfa/disable', { body: { code } });
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: 'Código inválido.' });
      return;
    }
    setCode('');
    setRecoveryCodes(null);
    setMsg({ kind: 'ok', text: 'MFA desativado.' });
    void loadStatus();
  }

  async function onRegenerate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { data, error } = await api.POST('/api/auth/mfa/recovery-codes', { body: { code: regenCode } });
    setBusy(false);
    if (error || !data) {
      setMsg({ kind: 'err', text: 'Código inválido — use o app autenticador.' });
      return;
    }
    setRegenCode('');
    setRecoveryCodes(data.recoveryCodes);
    setMsg({ kind: 'ok', text: 'Novos recovery codes gerados. Os anteriores foram invalidados.' });
    void loadStatus();
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">Configurações</h1>
        <p className="text-sm text-gray-500">Segurança da sua conta</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-black dark:text-white">
              Autenticação em duas etapas (MFA)
            </h2>
            <p className="text-sm text-gray-500">
              Código TOTP de um app autenticador (Google Authenticator, Authy…). Recomendado para
              administradores e financeiro.
            </p>
          </div>
          {mfaEnabled === null ? null : (
            <span className={`text-xs rounded-full px-3 py-1 ${mfaEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 dark:bg-[#15203c] text-gray-500'}`}>
              {mfaEnabled ? 'Ativo' : 'Inativo'}
            </span>
          )}
        </div>

        {msg && (
          <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
        )}

        {recoveryCodes && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Recovery codes — guarde-os agora, não serão exibidos de novo.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
              Cada código funciona uma única vez, no lugar do app autenticador.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm text-black dark:text-white">
              {recoveryCodes.map((c) => (
                <code key={c} className="bg-white dark:bg-[#0c1427] rounded px-2 py-1 text-center">
                  {c}
                </code>
              ))}
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
              >
                <i className="ri-file-copy-line"></i> Copiar todos
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRecoveryCodes(null)}>
                Já guardei
              </Button>
            </div>
          </div>
        )}

        {mfaEnabled === false && !setupData && (
          <div className="mt-4">
            <Button onClick={onSetup} disabled={busy}>
              <i className="ri-shield-keyhole-line"></i> {busy ? 'Gerando…' : 'Ativar MFA'}
            </Button>
          </div>
        )}

        {setupData && (
          <div className="mt-5 flex flex-col md:flex-row gap-6 items-start">
            <div className="bg-white p-2 rounded-md border border-gray-100">
              <canvas ref={qrRef} />
            </div>
            <form onSubmit={onEnable} className="flex flex-col gap-3 flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                1. Escaneie o QR code no seu app autenticador.
                <br />
                2. Se preferir, digite o segredo manualmente:{' '}
                <code className="text-xs bg-gray-50 dark:bg-[#15203c] px-2 py-0.5 rounded">{setupData.secret}</code>
                <br />
                3. Digite o código gerado para confirmar:
              </p>
              <input
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputCls} max-w-[200px] text-center tracking-[0.4em]`}
                placeholder="••••••"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>{busy ? 'Confirmando…' : 'Confirmar e ativar'}</Button>
                <Button type="button" variant="ghost" onClick={() => setSetupData(null)}>Cancelar</Button>
              </div>
            </form>
          </div>
        )}

        {mfaEnabled === true && (
          <div className="mt-5 flex flex-col gap-5">
            <p className="text-sm text-gray-500">
              Recovery codes disponíveis:{' '}
              <span className={recoveryRemaining <= 2 ? 'text-amber-600 font-medium' : 'text-black dark:text-white'}>
                {recoveryRemaining}
              </span>
            </p>

            <form onSubmit={onRegenerate} className="flex items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Regerar recovery codes (código atual)</span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value)}
                  className={`${inputCls} max-w-[200px] text-center tracking-[0.4em]`}
                  placeholder="••••••"
                />
              </label>
              <Button type="submit" variant="ghost" disabled={busy}>
                Gerar novos códigos
              </Button>
            </form>

            <form onSubmit={onDisable} className="flex items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Código atual para desativar</span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputCls} max-w-[200px] text-center tracking-[0.4em]`}
                  placeholder="••••••"
                />
              </label>
              <Button type="submit" variant="ghost" disabled={busy}>
                Desativar MFA
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
