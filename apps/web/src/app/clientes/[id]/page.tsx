'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PortalAcessoCard } from '@/components/portal/PortalAcessoCard';

interface Animal {
  id: string;
  nome: string;
  especie?: string | null;
  raca?: string | null;
  status: string;
}
interface VendasResumo {
  totalVendidoCentavos: number;
  ticketMedioCentavos: number;
  vendas: number;
  ultimaVendaEm?: string | null;
}
interface Ficha {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
  origem?: string | null;
  animais: Animal[];
  vendas?: VendasResumo;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Link do WhatsApp a partir do telefone (só dígitos; assume BR se faltar DDI).
function whatsappLink(telefone?: string | null): string | null {
  if (!telefone) return null;
  let d = telefone.replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}`;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

const CANAL_ICONE: Record<string, string> = {
  whatsapp: 'ri-whatsapp-line',
  email: 'ri-mail-line',
  sms: 'ri-message-2-line',
  manual: 'ri-sticky-note-line',
};

export default function FichaClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const podeExportar = user?.role === 'admin' || user?.role === 'gestor';
  const id = params.id;
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [exportando, setExportando] = useState(false);
  const [saldo, setSaldo] = useState<{ devedorCentavos: number; faturasAbertas: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', documento: '', origem: '' });

  const [showAnimal, setShowAnimal] = useState(false);
  const [nome, setNome] = useState('');
  const [especie, setEspecie] = useState('');
  const [saving, setSaving] = useState(false);

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [showMsg, setShowMsg] = useState(false);
  const [msgForm, setMsgForm] = useState({ canal: 'whatsapp', assunto: '', corpo: '' });
  const [savingMsg, setSavingMsg] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; nome: string; canal: string; assunto?: string | null; corpo: string }[]>([]);

  useEffect(() => {
    void api.GET('/api/mensagens/templates', { params: { query: {} } }).then(({ data }) => {
      setTemplates((data as typeof templates) ?? []);
    });
  }, []);

  // Aplica um template preenchendo o formulário, substituindo placeholders simples.
  function aplicarTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t || !ficha) return;
    const hoje = new Date().toLocaleDateString('pt-BR');
    const sub = (s: string) =>
      s
        .replaceAll('{{cliente}}', ficha.nome)
        .replaceAll('{{pet}}', ficha.animais[0]?.nome ?? '')
        .replaceAll('{{data}}', hoje);
    setMsgForm({ canal: t.canal, assunto: sub(t.assunto ?? ''), corpo: sub(t.corpo) });
  }

  const loadMensagens = useCallback(async () => {
    const { data } = await api.GET('/api/clientes/{id}/mensagens', { params: { path: { id } } });
    setMensagens((data as Mensagem[]) ?? []);
  }, [id]);

  async function onRegistrarMensagem(e: FormEvent) {
    e.preventDefault();
    if (!msgForm.corpo.trim()) return;
    setSavingMsg(true);
    const { error } = await api.POST('/api/clientes/{id}/mensagens', {
      params: { path: { id } },
      body: {
        canal: msgForm.canal as 'whatsapp' | 'email' | 'sms' | 'manual',
        assunto: msgForm.canal === 'email' ? msgForm.assunto || undefined : undefined,
        corpo: msgForm.corpo.trim(),
      },
    });
    setSavingMsg(false);
    if (error) {
      alert('Não foi possível registrar a mensagem.');
      return;
    }
    setMsgForm({ canal: 'whatsapp', assunto: '', corpo: '' });
    setShowMsg(false);
    void loadMensagens();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/clientes/{id}', { params: { path: { id } } });
    const f = (data as Ficha) ?? null;
    setFicha(f);
    if (f) setForm({ nome: f.nome, telefone: f.telefone ?? '', email: f.email ?? '', documento: f.documento ?? '', origem: f.origem ?? '' });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMensagens();
  }, [loadMensagens]);

  useEffect(() => {
    void api.GET('/api/financeiro/saldos/{responsavelId}', { params: { path: { responsavelId: id } } }).then(({ data }) => {
      setSaldo((data as { devedorCentavos: number; faturasAbertas: number }) ?? null);
    });
  }, [id]);

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await api.PATCH('/api/clientes/{id}', { params: { path: { id } }, body: form });
    setSaving(false);
    if (data) {
      setEditing(false);
      void load();
    }
  }

  async function onNovoOrcamento() {
    const obs = prompt('Novo orçamento — observações (opcional):');
    if (obs === null) return;
    const { error } = await api.POST('/api/orcamentos', {
      body: { responsavelId: id, observacoes: obs || undefined },
    });
    if (error) {
      alert('Não foi possível criar o orçamento.');
      return;
    }
    router.push('/orcamentos');
  }

  async function onDeleteCliente() {
    if (!ficha) return;
    if (!confirm(`Excluir "${ficha.nome}" e todos os seus animais?`)) return;
    await api.DELETE('/api/clientes/{id}', { params: { path: { id } } });
    router.push('/clientes');
  }

  async function onAddAnimal(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await api.POST('/api/clientes/{id}/animais', {
      params: { path: { id } },
      body: { nome, especie: especie || undefined },
    });
    setSaving(false);
    if (data) {
      setNome('');
      setEspecie('');
      setShowAnimal(false);
      void load();
    }
  }

  async function onDeleteAnimal(animalId: string, animalNome: string) {
    if (!confirm(`Excluir o paciente "${animalNome}"?`)) return;
    await api.DELETE('/api/animais/{id}', { params: { path: { id: animalId } } });
    void load();
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;
  async function onExportarLgpd() {
    if (!ficha) return;
    setExportando(true);
    try {
      const { data, error } = await api.GET('/api/lgpd/clientes/{responsavelId}/export', {
        params: { path: { responsavelId: id } },
      });
      if (error || !data) {
        alert('Não foi possível exportar (apenas admin/gestor).');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lgpd-${ficha.nome.replace(/\s+/g, '_').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  if (!ficha) return <p className="text-sm text-gray-500">Cliente não encontrado.</p>;

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/clientes" className="hover:text-primary-500">Clientes</Link>
        <i className="ri-arrow-right-s-line"></i>
        <span className="text-black dark:text-white">{ficha.nome}</span>
      </div>

      <Card>
        {editing ? (
          <form onSubmit={onSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Telefone</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">E-mail</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Documento</span>
              <input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Como nos conheceu?</span>
              <input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} className={inputCls} />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-black dark:text-white">{ficha.nome}</h1>
                {saldo && saldo.devedorCentavos > 0 && (
                  <span className="text-xs rounded-full px-2.5 py-0.5 bg-red-50 text-red-500" title={`${saldo.faturasAbertas} fatura(s) em aberto`}>
                    Devendo {(saldo.devedorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {whatsappLink(ficha.telefone) && (
                  <a
                    href={whatsappLink(ficha.telefone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-[#15203c]"
                    title="Falar no WhatsApp"
                  >
                    <i className="ri-whatsapp-line text-lg"></i> WhatsApp
                  </a>
                )}
                <Button variant="ghost" onClick={onNovoOrcamento}><i className="ri-file-list-3-line"></i> Orçamento</Button>
                {podeExportar && (
                  <Button variant="ghost" onClick={onExportarLgpd} disabled={exportando} title="Exportar dados do titular (LGPD)">
                    <i className="ri-download-2-line"></i> {exportando ? 'Exportando…' : 'Exportar (LGPD)'}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditing(true)}><i className="ri-edit-line"></i> Editar</Button>
                <button type="button" onClick={onDeleteCliente} className="text-gray-400 hover:text-red-500 px-2" title="Excluir cliente">
                  <i className="ri-delete-bin-line text-lg"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
              <Info label="Telefone" value={ficha.telefone} />
              <Info label="E-mail" value={ficha.email} />
              <Info label="Documento" value={ficha.documento} />
              <Info label="Como nos conheceu?" value={ficha.origem} />
            </div>
            {/* Resumo de vendas (doc 16 F1). */}
            {ficha.vendas && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-[#172036] text-sm">
                <Info label="Total vendido" value={brl(ficha.vendas.totalVendidoCentavos)} />
                <Info label="Ticket médio" value={ficha.vendas.vendas > 0 ? brl(ficha.vendas.ticketMedioCentavos) : '—'} />
                <Info label="Vendas" value={String(ficha.vendas.vendas)} />
                <Info
                  label="Última venda"
                  value={ficha.vendas.ultimaVendaEm ? new Date(ficha.vendas.ultimaVendaEm).toLocaleDateString('pt-BR') : '—'}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-black dark:text-white">Pacientes</h2>
          <Button variant="ghost" onClick={() => setShowAnimal((v) => !v)}>
            <i className="ri-add-line"></i> Adicionar paciente
          </Button>
        </div>

        {showAnimal && (
          <form onSubmit={onAddAnimal} className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Espécie</span>
              <input value={especie} onChange={(e) => setEspecie(e.target.value)} className={inputCls} placeholder="Canina, Felina…" />
            </label>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </form>
        )}

        {ficha.animais.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum paciente cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ficha.animais.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border border-gray-100 dark:border-[#172036] p-3">
                <Link href={`/animais/${a.id}`} className="flex items-center gap-3 flex-1 hover:opacity-80">
                  <span className="inline-grid place-items-center w-10 h-10 rounded-full bg-primary-50 text-primary-500">
                    <i className="ri-bear-smile-line text-xl"></i>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white">{a.nome}</p>
                    <p className="text-xs text-gray-500">{[a.especie, a.raca].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                </Link>
                <button type="button" onClick={() => onDeleteAnimal(a.id, a.nome)} className="text-gray-400 hover:text-red-500" title="Excluir animal" aria-label="Excluir animal">
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Histórico de mensagens / CRM (doc 17 · doc 16 F3) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-black dark:text-white">Mensagens</h2>
            <p className="text-xs text-gray-500">Histórico de contatos com o cliente (registro; envio pelo canal).</p>
          </div>
          <Button variant="ghost" onClick={() => setShowMsg((v) => !v)}>
            <i className="ri-chat-new-line"></i> Registrar mensagem
          </Button>
        </div>

        {showMsg && (
          <form onSubmit={onRegistrarMensagem} className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Canal</span>
                <select value={msgForm.canal} onChange={(e) => setMsgForm({ ...msgForm, canal: e.target.value })} className={inputCls}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="sms">SMS</option>
                  <option value="manual">Anotação / manual</option>
                </select>
              </label>
              {templates.length > 0 && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Template</span>
                  <select defaultValue="" onChange={(e) => e.target.value && aplicarTemplate(e.target.value)} className={inputCls}>
                    <option value="">— usar template —</option>
                    {templates
                      .filter((t) => t.canal === msgForm.canal)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                  </select>
                </label>
              )}
              {msgForm.canal === 'email' && (
                <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
                  <span className="text-gray-600 dark:text-gray-300">Assunto</span>
                  <input value={msgForm.assunto} onChange={(e) => setMsgForm({ ...msgForm, assunto: e.target.value })} className={inputCls} />
                </label>
              )}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Mensagem</span>
              <textarea required rows={3} value={msgForm.corpo} onChange={(e) => setMsgForm({ ...msgForm, corpo: e.target.value })} className={inputCls} placeholder="Conteúdo da mensagem…" />
            </label>
            <p className="text-xs text-gray-400">
              Isto registra a mensagem no histórico. O envio ativo por WhatsApp/SMS/e-mail
              depende de integração com o provedor (fase futura); por ora, envie pelo botão do canal.
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingMsg}>{savingMsg ? 'Registrando…' : 'Registrar'}</Button>
            </div>
          </form>
        )}

        {mensagens.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma mensagem registrada ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-50 dark:divide-[#172036]/50 text-sm">
            {mensagens.map((m) => (
              <li key={m.id} className="py-2.5 flex items-start gap-3">
                <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary-50 text-primary-500 shrink-0">
                  <i className={CANAL_ICONE[m.canal] ?? 'ri-chat-1-line'}></i>
                </span>
                <div className="min-w-0 flex-1">
                  {m.assunto && <p className="font-medium text-black dark:text-white">{m.assunto}</p>}
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">{m.corpo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(m.criadaEm).toLocaleString('pt-BR')} · {m.canal}
                    {m.referenciaTipo && ` · ${m.referenciaTipo}`}
                    {m.disparadoPorNome && ` · ${m.disparadoPorNome}`}
                    {' · '}<span className="capitalize">{m.status}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PortalAcessoCard responsavelId={id} />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="text-black dark:text-white">{value || '—'}</p>
    </div>
  );
}
