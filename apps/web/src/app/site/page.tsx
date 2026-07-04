'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Config {
  slug?: string | null;
  publicado: boolean;
  nomeExibicao?: string | null;
  sobre?: string | null;
  servicos?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  horario?: string | null;
  corPrimaria?: string | null;
  logoUrl?: string | null;
}
interface Solicitacao {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  petNome?: string | null;
  servicoDesejado?: string | null;
  preferencia?: string | null;
  mensagem?: string | null;
  origem?: string | null;
  status: string;
  criadaEm: string;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

const STATUS_STYLE: Record<string, string> = {
  nova: 'bg-amber-50 text-amber-600',
  confirmada: 'bg-green-50 text-green-600',
  recusada: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
};

export default function SiteAdminPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [solic, setSolic] = useState<Solicitacao[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [publicUrl, setPublicUrl] = useState('');
  const logoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([api.GET('/api/site/config'), api.GET('/api/site/solicitacoes')]);
    setCfg((c.data as Config) ?? null);
    setSolic((s.data as Solicitacao[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cfg?.slug) setPublicUrl(`${window.location.origin}/clinica/${cfg.slug}`);
  }, [cfg?.slug]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    const { error } = await api.PUT('/api/site/config', {
      body: {
        slug: cfg.slug ?? undefined,
        publicado: cfg.publicado,
        nomeExibicao: cfg.nomeExibicao ?? undefined,
        sobre: cfg.sobre ?? undefined,
        servicos: cfg.servicos ?? undefined,
        endereco: cfg.endereco ?? undefined,
        telefone: cfg.telefone ?? undefined,
        whatsapp: cfg.whatsapp ?? undefined,
        email: cfg.email ?? undefined,
        horario: cfg.horario ?? undefined,
        corPrimaria: cfg.corPrimaria ?? undefined,
      },
    });
    setSaving(false);
    if (error) {
      setMsg({ kind: 'err', text: 'Não foi possível salvar (slug já em uso ou inválido?).' });
      return;
    }
    setMsg({ kind: 'ok', text: 'Site salvo.' });
    void load();
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const sign = await api.POST('/api/site/config/logo/sign-upload', { body: { contentType: file.type } });
    if (sign.error || !sign.data) {
      setMsg({ kind: 'err', text: 'Falha ao preparar o upload.' });
      return;
    }
    const put = await fetch(sign.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    if (!put.ok) {
      setMsg({ kind: 'err', text: 'Falha ao enviar a imagem.' });
      return;
    }
    const { error } = await api.POST('/api/site/config/logo', { body: { key: sign.data.key } });
    setMsg(error ? { kind: 'err', text: 'Falha ao confirmar o logo.' } : { kind: 'ok', text: 'Logo atualizado.' });
    if (!error) void load();
  }

  async function triagem(id: string, acao: 'confirmar' | 'recusar') {
    const observacao = acao === 'recusar' ? prompt('Observação (opcional):') ?? undefined : undefined;
    const path = acao === 'confirmar' ? '/api/site/solicitacoes/{id}/confirmar' : '/api/site/solicitacoes/{id}/recusar';
    await api.POST(path, { params: { path: { id } }, body: { observacao } });
    void load();
  }

  if (!cfg) return <p className="text-sm text-gray-500">Carregando…</p>;

  const novas = solic.filter((s) => s.status === 'nova');

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Site</h1>
          <p className="text-sm text-gray-500">Presença pública e solicitações de agendamento (doc 13 §4)</p>
        </div>
        {cfg.publicado && publicUrl && (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-500 hover:underline">
            <i className="ri-external-link-line"></i> Ver site
          </a>
        )}
      </div>

      {msg && <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}

      <Card>
        <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={cfg.publicado} onChange={(e) => setCfg({ ...cfg, publicado: e.target.checked })} />
            <span className="text-gray-600 dark:text-gray-300">Site publicado (visível ao público)</span>
          </label>

          <Field label="Endereço do site (slug)">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">/clinica/</span>
              <input value={cfg.slug ?? ''} onChange={(e) => setCfg({ ...cfg, slug: e.target.value })} className={`${inputCls} flex-1`} placeholder="minha-clinica" />
            </div>
          </Field>
          <Field label="Nome de exibição">
            <input value={cfg.nomeExibicao ?? ''} onChange={(e) => setCfg({ ...cfg, nomeExibicao: e.target.value })} className={inputCls} />
          </Field>

          <Field label="Sobre" full>
            <textarea value={cfg.sobre ?? ''} onChange={(e) => setCfg({ ...cfg, sobre: e.target.value })} className={inputCls} rows={3} />
          </Field>
          <Field label="Serviços (um por linha)" full>
            <textarea value={cfg.servicos ?? ''} onChange={(e) => setCfg({ ...cfg, servicos: e.target.value })} className={inputCls} rows={4} placeholder={'Consultas\nVacinação\nBanho e tosa'} />
          </Field>

          <Field label="Endereço">
            <input value={cfg.endereco ?? ''} onChange={(e) => setCfg({ ...cfg, endereco: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Horário de funcionamento">
            <input value={cfg.horario ?? ''} onChange={(e) => setCfg({ ...cfg, horario: e.target.value })} className={inputCls} placeholder="Seg–Sex 8h–18h" />
          </Field>
          <Field label="Telefone">
            <input value={cfg.telefone ?? ''} onChange={(e) => setCfg({ ...cfg, telefone: e.target.value })} className={inputCls} />
          </Field>
          <Field label="WhatsApp">
            <input value={cfg.whatsapp ?? ''} onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })} className={inputCls} />
          </Field>
          <Field label="E-mail">
            <input value={cfg.email ?? ''} onChange={(e) => setCfg({ ...cfg, email: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Cor primária">
            <input type="color" value={cfg.corPrimaria ?? '#605dff'} onChange={(e) => setCfg({ ...cfg, corPrimaria: e.target.value })} className={`${inputCls} h-10 w-20 p-1`} />
          </Field>

          <Field label="Logo" full>
            <div className="flex items-center gap-3">
              {cfg.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.logoUrl} alt="logo" className="w-12 h-12 rounded-full object-cover" />
              )}
              <input ref={logoInput} type="file" accept="image/*" onChange={onLogo} className="text-sm" />
            </div>
          </Field>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar site'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-black dark:text-white mb-1">
          Solicitações de agendamento {novas.length > 0 && <span className="text-amber-600">({novas.length} nova(s))</span>}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Vindas do site. Confirme e siga o cadastro/agenda normalmente — nada entra na agenda sem sua ação.
        </p>
        {solic.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma solicitação.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {solic.map((s) => (
              <div key={s.id} className="rounded-md border border-gray-100 dark:border-[#172036] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white">
                      {s.nome} · {s.telefone}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[s.petNome && `Pet: ${s.petNome}`, s.servicoDesejado, s.preferencia].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {s.mensagem && <p className="text-xs text-gray-500 mt-1">“{s.mensagem}”</p>}
                    {s.origem && <p className="text-xs text-gray-400 mt-1">Conheceu por: {s.origem}</p>}
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${STATUS_STYLE[s.status] ?? ''}`}>
                    {s.status}
                  </span>
                </div>
                {s.status === 'nova' && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => triagem(s.id, 'confirmar')} className="text-sm text-green-600 hover:underline">
                      Confirmar
                    </button>
                    <button onClick={() => triagem(s.id, 'recusar')} className="text-sm text-red-500 hover:underline">
                      Recusar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${full ? 'md:col-span-2' : ''}`}>
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}
