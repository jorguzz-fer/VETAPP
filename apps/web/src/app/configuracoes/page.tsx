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

      <BrandingCard />
      <UsuariosCard />
    </div>
  );
}

// Branding do tenant (logo da clínica) — admin. Upload direto ao R2 via URL assinada.
function BrandingCard() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await api.GET('/api/branding');
    setLogoUrl((res.data as { logoUrl: string | null } | undefined)?.logoUrl ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setBusy(true);
    try {
      const sign = await api.POST('/api/branding/logo/sign-upload', { body: { contentType: file.type } });
      if (sign.error || !sign.data) {
        setMsg({ kind: 'err', text: 'Falha ao preparar o upload (storage configurado?).' });
        return;
      }
      const put = await fetch(sign.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!put.ok) {
        setMsg({ kind: 'err', text: 'Falha ao enviar a imagem.' });
        return;
      }
      const conf = await api.POST('/api/branding/logo', { body: { key: sign.data.key } });
      if (conf.error) {
        setMsg({ kind: 'err', text: 'Falha ao confirmar o logo.' });
        return;
      }
      setLogoUrl((conf.data as { logoUrl: string | null }).logoUrl);
      setMsg({ kind: 'ok', text: 'Logo atualizado.' });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function remover() {
    if (!confirm('Remover o logo da clínica?')) return;
    setBusy(true);
    setMsg(null);
    const res = await api.DELETE('/api/branding/logo');
    setBusy(false);
    if (res.error) {
      setMsg({ kind: 'err', text: 'Falha ao remover o logo.' });
      return;
    }
    setLogoUrl(null);
    setMsg({ kind: 'ok', text: 'Logo removido.' });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-black dark:text-white">Logo da clínica</h2>
          <p className="text-sm text-gray-500">
            Aparece no cabeçalho do sistema e nos documentos impressos. PNG ou JPG, fundo transparente de
            preferência.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-gray-200 dark:border-[#172036] bg-gray-50 dark:bg-[#15203c]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo da clínica" className="h-full w-full object-contain" />
          ) : (
            <i className="ri-image-line text-2xl text-gray-400" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={onFile}
            disabled={busy}
            className="text-sm"
          />
          {logoUrl && (
            <button
              type="button"
              onClick={remover}
              disabled={busy}
              className="self-start text-sm text-red-500 hover:underline disabled:opacity-50"
            >
              Remover logo
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
      )}
    </Card>
  );
}

interface Usuario {
  userId: string;
  nome: string;
  email: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
}

const PAPEL_LABEL: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  veterinario: 'Veterinário',
  recepcao: 'Recepção',
  financeiro: 'Financeiro',
  internacao: 'Internação',
};
type Papel = 'admin' | 'gestor' | 'veterinario' | 'recepcao' | 'financeiro' | 'internacao';
const PAPEIS = Object.keys(PAPEL_LABEL) as Papel[];

const inputUsr =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500 text-sm';

// Gestão de usuários e acessos (doc 07) — admin.
function UsuariosCard() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState<{ nome: string; email: string; role: Papel }>({ nome: '', email: '', role: 'recepcao' });
  const [saving, setSaving] = useState(false);
  const [senhaInfo, setSenhaInfo] = useState<{ nome: string; senha: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.GET('/api/usuarios');
    setUsuarios((data as Usuario[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSenhaInfo(null);
    setSaving(true);
    const { data, error } = await api.POST('/api/usuarios', {
      body: { nome: form.nome.trim(), email: form.email.trim(), role: form.role },
    });
    setSaving(false);
    if (error) {
      setErro('Não foi possível criar (e-mail já na equipe ou inválido?).');
      return;
    }
    const r = data as Usuario & { senhaTemporaria: string | null };
    if (r?.senhaTemporaria) setSenhaInfo({ nome: r.nome, senha: r.senhaTemporaria });
    setForm({ nome: '', email: '', role: 'recepcao' });
    void load();
  }

  async function mudarPapel(u: Usuario, role: Papel) {
    setErro(null);
    const { error } = await api.PATCH('/api/usuarios/{userId}', { params: { path: { userId: u.userId } }, body: { role } });
    if (error) setErro('Não foi possível alterar o papel (último admin?).');
    void load();
  }

  async function alternarStatus(u: Usuario) {
    setErro(null);
    const status = u.status === 'active' ? 'disabled' : 'active';
    const { error } = await api.PATCH('/api/usuarios/{userId}', { params: { path: { userId: u.userId } }, body: { status } });
    if (error) setErro('Não foi possível alterar o status (você mesmo / último admin?).');
    void load();
  }

  async function resetSenha(u: Usuario) {
    if (!confirm(`Gerar nova senha temporária para ${u.nome}?`)) return;
    const { data } = await api.POST('/api/usuarios/{userId}/reset-senha', { params: { path: { userId: u.userId } } });
    const r = data as { senhaTemporaria?: string } | undefined;
    if (r?.senhaTemporaria) setSenhaInfo({ nome: u.nome, senha: r.senhaTemporaria });
  }

  async function remover(u: Usuario) {
    if (!confirm(`Remover o acesso de ${u.nome} a esta clínica?`)) return;
    setErro(null);
    const { error } = await api.DELETE('/api/usuarios/{userId}', { params: { path: { userId: u.userId } } });
    if (error) setErro('Não foi possível remover (você mesmo / último admin?).');
    void load();
  }

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-black dark:text-white">Usuários e acessos</h2>
        <p className="text-sm text-gray-500">Gerencie a equipe da clínica e os papéis de cada um.</p>
      </div>

      {senhaInfo && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
          Senha temporária de <strong>{senhaInfo.nome}</strong>:{' '}
          <code className="font-mono bg-white dark:bg-[#0c1427] px-1.5 py-0.5 rounded">{senhaInfo.senha}</code>{' '}
          — copie e entregue ao colaborador (aparece só uma vez; ele troca depois).
          <button onClick={() => setSenhaInfo(null)} className="ml-2 text-amber-700 underline">ok</button>
        </div>
      )}
      {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}

      <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-4 gap-2 md:items-end mb-4">
        <input required placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputUsr} />
        <input required type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputUsr} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Papel })} className={inputUsr}>
          {PAPEIS.map((p) => (
            <option key={p} value={p}>{PAPEL_LABEL[p]}</option>
          ))}
        </select>
        <Button type="submit" disabled={saving}>{saving ? 'Adicionando…' : 'Adicionar'}</Button>
      </form>

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036]">
        {usuarios.map((u) => (
          <div key={u.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-black dark:text-white truncate">
                {u.nome}
                {u.status === 'disabled' && <span className="ml-2 text-xs text-red-500">(desativado)</span>}
                {u.mfaEnabled && <span className="ml-2 text-xs text-green-600" title="MFA ativo"><i className="ri-shield-check-line"></i></span>}
              </p>
              <p className="text-xs text-gray-500 truncate">{u.email}</p>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <select value={u.role} onChange={(e) => mudarPapel(u, e.target.value as Papel)} className={`${inputUsr} py-1`}>
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>{PAPEL_LABEL[p]}</option>
                ))}
              </select>
              <button onClick={() => alternarStatus(u)} className="text-xs text-gray-500 hover:text-primary-500" title={u.status === 'active' ? 'Desativar' : 'Ativar'}>
                <i className={u.status === 'active' ? 'ri-toggle-fill text-lg text-green-600' : 'ri-toggle-line text-lg'}></i>
              </button>
              <button onClick={() => resetSenha(u)} className="text-gray-400 hover:text-primary-500" title="Resetar senha" aria-label="Resetar senha">
                <i className="ri-key-2-line"></i>
              </button>
              <button onClick={() => remover(u)} className="text-gray-400 hover:text-red-500" title="Remover acesso" aria-label="Remover">
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
