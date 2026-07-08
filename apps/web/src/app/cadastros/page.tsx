'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TipoAtendimento {
  id: string;
  nome: string;
  duracaoMinutos: number;
  cor: string | null;
  ativo: boolean;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

// Cadastros de apoio (doc 05 §8). Fase 1: tipos de atendimento (§8.5).
// Espécies/raças/patologias via base externa e modelos de receita/documento → fase 2.
export default function CadastrosPage() {
  const [tipos, setTipos] = useState<TipoAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ nome: string; duracao: string; cor: string }>({
    nome: '',
    duracao: '30',
    cor: '#7c5cff',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/agenda/tipos', { params: { query: { incluirInativos: true } } });
    setTipos((data as TipoAtendimento[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error: err } = await api.POST('/api/agenda/tipos', {
      body: {
        nome: form.nome,
        duracaoMinutos: parseInt(form.duracao || '30', 10),
        cor: form.cor || undefined,
      },
    });
    setSaving(false);
    if (err) {
      setError('Não foi possível salvar (nome já em uso?).');
      return;
    }
    setForm({ nome: '', duracao: '30', cor: '#7c5cff' });
    setShowForm(false);
    void load();
  }

  async function onToggleAtivo(t: TipoAtendimento) {
    await api.PATCH('/api/agenda/tipos/{id}', { params: { path: { id: t.id } }, body: { ativo: !t.ativo } });
    void load();
  }

  async function onEditDuracao(t: TipoAtendimento) {
    const val = prompt(`Duração de "${t.nome}" (minutos):`, String(t.duracaoMinutos));
    if (val == null) return;
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 5) return;
    await api.PATCH('/api/agenda/tipos/{id}', { params: { path: { id: t.id } }, body: { duracaoMinutos: n } });
    void load();
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Cadastros</h1>
          <p className="text-sm text-gray-500">
            Cadastros de apoio da clínica. Produtos/serviços ficam na Tabela de preços.
          </p>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-black dark:text-white">Tipos de atendimento</h2>
            <p className="text-xs text-gray-500">Duração padrão e cor dos eventos na agenda.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <i className="ri-add-line"></i> Novo tipo
          </Button>
        </div>

        {showForm && (
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end mb-4">
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} placeholder="Consulta" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Duração (min)</span>
              <input required value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} inputMode="numeric" className={inputCls} />
            </label>
            <div className="flex gap-2 items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Cor</span>
                <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-[42px] w-14 rounded-md border border-gray-200 dark:border-[#172036] bg-transparent" />
              </label>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
            </div>
            {error && <p className="text-sm text-red-500 md:col-span-4">{error}</p>}
          </form>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : tipos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum tipo cadastrado — crie &quot;Consulta&quot;, &quot;Vacina&quot;, &quot;Cirurgia&quot;…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Nome</th>
                <th className="py-2 font-medium">Duração</th>
                <th className="py-2 font-medium">Cor</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className={`border-b border-gray-50 dark:border-[#172036]/50 ${t.ativo ? '' : 'opacity-50'}`}>
                  <td className="py-2.5 text-black dark:text-white">{t.nome}</td>
                  <td className="py-2.5 text-gray-500">
                    <button type="button" onClick={() => onEditDuracao(t)} className="hover:text-primary-500" title="Editar duração">
                      {t.duracaoMinutos} min
                    </button>
                  </td>
                  <td className="py-2.5">
                    {t.cor ? (
                      <span className="inline-block w-5 h-5 rounded-full border border-gray-200 dark:border-[#172036]" style={{ backgroundColor: t.cor }} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleAtivo(t)}
                      className={`${t.ativo ? 'text-green-500' : 'text-gray-400'} hover:opacity-70`}
                      title={t.ativo ? 'Desativar' : 'Ativar'}
                      aria-label={t.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <i className={t.ativo ? 'ri-toggle-fill text-xl' : 'ri-toggle-line text-xl'}></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <DepartamentosCard />
      <FormasRecebimentoCard />
      <InternacaoListasCard />
    </div>
  );
}

// Departamentos da agenda (doc 16 A1): Clínica, Hotel, Banho & Tosa etc.
interface Departamento {
  id: string;
  nome: string;
  cor: string | null;
  ativo: boolean;
}

function DepartamentosCard() {
  const [deps, setDeps] = useState<Departamento[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ nome: '', cor: '#7c5cff' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/api/agenda/departamentos', { params: { query: { incluirInativos: true } } });
    setDeps((data as Departamento[]) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    const { error } = await api.POST('/api/agenda/departamentos', {
      body: { nome: form.nome.trim(), cor: form.cor || undefined },
    });
    setSaving(false);
    if (error) {
      alert('Não foi possível criar (nome repetido? só admin/gestor).');
      return;
    }
    setForm({ nome: '', cor: '#7c5cff' });
    setShow(false);
    void load();
  }

  async function onToggle(d: Departamento) {
    await api.PATCH('/api/agenda/departamentos/{id}', { params: { path: { id: d.id } }, body: { ativo: !d.ativo } });
    void load();
  }

  const inputCls =
    'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-black dark:text-white">Departamentos da agenda</h2>
          <p className="text-xs text-gray-500">Áreas para organizar a agenda (Clínica, Hotel, Banho &amp; Tosa…).</p>
        </div>
        <Button onClick={() => setShow((v) => !v)}>
          <i className="ri-add-line"></i> Novo departamento
        </Button>
      </div>

      {show && (
        <form onSubmit={onCreate} className="flex flex-wrap gap-3 items-end mb-4">
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-[180px]">
            <span className="text-gray-600 dark:text-gray-300">Nome</span>
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} placeholder="Hotel" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Cor</span>
            <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-[42px] w-14 rounded-md border border-gray-200 dark:border-[#172036] bg-transparent" />
          </label>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </form>
      )}

      {deps.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum departamento — crie &quot;Clínica&quot;, &quot;Hotel&quot;, &quot;Banho &amp; Tosa&quot;…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
              <th className="py-2 font-medium">Nome</th>
              <th className="py-2 font-medium">Cor</th>
              <th className="py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {deps.map((d) => (
              <tr key={d.id} className={`border-b border-gray-50 dark:border-[#172036]/50 ${d.ativo ? '' : 'opacity-50'}`}>
                <td className="py-2.5 text-black dark:text-white">{d.nome}</td>
                <td className="py-2.5">
                  {d.cor ? (
                    <span className="inline-block w-5 h-5 rounded-full border border-gray-200 dark:border-[#172036]" style={{ backgroundColor: d.cor }} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onToggle(d)}
                    className={`${d.ativo ? 'text-green-500' : 'text-gray-400'} hover:opacity-70`}
                    title={d.ativo ? 'Desativar' : 'Ativar'}
                    aria-label={d.ativo ? 'Desativar' : 'Ativar'}
                  >
                    <i className={d.ativo ? 'ri-toggle-fill text-xl' : 'ri-toggle-line text-xl'}></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

interface Forma {
  id: string;
  nome: string;
  tipo: string;
  taxaBps: number;
  ativo: boolean;
}

const TIPOS_FORMA = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro'] as const;
type TipoForma = (typeof TIPOS_FORMA)[number];
const LABEL_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão crédito',
  cartao_debito: 'Cartão débito',
  transferencia: 'Transferência',
  outro: 'Outro',
};

// Formas de recebimento (doc 13 §1): cadastro de apoio do Financeiro.
function FormasRecebimentoCard() {
  const [formas, setFormas] = useState<Forma[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ nome: string; tipo: TipoForma; taxa: string }>({ nome: '', tipo: 'pix', taxa: '0' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/formas-recebimento', { params: { query: { incluirInativos: true } } });
    setFormas((data as Forma[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api.POST('/api/formas-recebimento', {
      body: {
        nome: form.nome,
        tipo: form.tipo,
        taxaBps: Math.round(parseFloat(form.taxa.replace(',', '.') || '0') * 100),
      },
    });
    setSaving(false);
    setForm({ nome: '', tipo: 'pix', taxa: '0' });
    setShow(false);
    void load();
  }

  async function onToggle(f: Forma) {
    await api.PATCH('/api/formas-recebimento/{id}', { params: { path: { id: f.id } }, body: { ativo: !f.ativo } });
    void load();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-black dark:text-white">Formas de recebimento</h2>
          <p className="text-xs text-gray-500">Dinheiro, Pix, cartão… com taxa opcional da adquirente.</p>
        </div>
        <Button onClick={() => setShow((v) => !v)}>
          <i className="ri-add-line"></i> Nova forma
        </Button>
      </div>

      {show && (
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end mb-4">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-gray-600 dark:text-gray-300">Nome</span>
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} placeholder="Pix" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Tipo</span>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoForma })} className={inputCls}>
              {TIPOS_FORMA.map((t) => (
                <option key={t} value={t}>{LABEL_FORMA[t]}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 items-end">
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Taxa (%)</span>
              <input value={form.taxa} onChange={(e) => setForm({ ...form, taxa: e.target.value })} inputMode="decimal" className={inputCls} placeholder="0" />
            </label>
            <Button type="submit" disabled={saving}>{saving ? '…' : 'Salvar'}</Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : formas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma forma — crie Dinheiro, Pix, Cartão…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
              <th className="py-2 font-medium">Nome</th>
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium text-right">Taxa</th>
              <th className="py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {formas.map((f) => (
              <tr key={f.id} className={`border-b border-gray-50 dark:border-[#172036]/50 ${f.ativo ? '' : 'opacity-50'}`}>
                <td className="py-2.5 text-black dark:text-white">{f.nome}</td>
                <td className="py-2.5 text-gray-500">{LABEL_FORMA[f.tipo] ?? f.tipo}</td>
                <td className="py-2.5 text-right text-gray-500">{f.taxaBps > 0 ? `${(f.taxaBps / 100).toLocaleString('pt-BR')}%` : '—'}</td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onToggle(f)}
                    className={`${f.ativo ? 'text-green-500' : 'text-gray-400'} hover:opacity-70`}
                    title={f.ativo ? 'Desativar' : 'Ativar'}
                    aria-label={f.ativo ? 'Desativar' : 'Ativar'}
                  >
                    <i className={f.ativo ? 'ri-toggle-fill text-xl' : 'ri-toggle-line text-xl'}></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

interface ItemLista {
  id: string;
  nome: string;
}

// Motivos e boxes de internação (doc 05 §9.7): listas usadas na admissão.
function InternacaoListasCard() {
  return (
    <Card>
      <div className="mb-4">
        <h2 className="font-semibold text-black dark:text-white">Internação — motivos e boxes</h2>
        <p className="text-sm text-gray-500">
          Listas usadas na admissão. Renomeie ou remova; nomes não se duplicam.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <ListaColuna titulo="Motivos" recurso="motivos" />
        <ListaColuna titulo="Boxes" recurso="boxes" />
      </div>
    </Card>
  );
}

function ListaColuna({ titulo, recurso }: { titulo: string; recurso: 'motivos' | 'boxes' }) {
  const [items, setItems] = useState<ItemLista[]>([]);
  const [novo, setNovo] = useState('');
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } =
      recurso === 'motivos'
        ? await api.GET('/api/internacoes/motivos')
        : await api.GET('/api/internacoes/boxes');
    setItems((data as ItemLista[]) ?? []);
  }, [recurso]);

  useEffect(() => {
    void load();
  }, [load]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    setErr(null);
    const { error } =
      recurso === 'motivos'
        ? await api.POST('/api/internacoes/motivos', { body: { nome } })
        : await api.POST('/api/internacoes/boxes', { body: { nome } });
    if (error) {
      setErr('Não foi possível adicionar.');
      return;
    }
    setNovo('');
    void load();
  }

  async function salvarEdicao() {
    if (!editing) return;
    const nome = editing.value.trim();
    if (!nome) return;
    setErr(null);
    const { error } =
      recurso === 'motivos'
        ? await api.PATCH('/api/internacoes/motivos/{id}', { params: { path: { id: editing.id } }, body: { nome } })
        : await api.PATCH('/api/internacoes/boxes/{id}', { params: { path: { id: editing.id } }, body: { nome } });
    if (error) {
      setErr('Já existe um item com esse nome.');
      return;
    }
    setEditing(null);
    void load();
  }

  async function remover(id: string) {
    if (!confirm('Remover este item da lista?')) return;
    if (recurso === 'motivos') await api.DELETE('/api/internacoes/motivos/{id}', { params: { path: { id } } });
    else await api.DELETE('/api/internacoes/boxes/{id}', { params: { path: { id } } });
    void load();
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{titulo}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">Nenhum ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036] mb-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.id === it.id ? (
                <>
                  <input
                    value={editing.value}
                    onChange={(e) => setEditing({ id: it.id, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void salvarEdicao();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className={`${inputCls} flex-1 text-sm py-1`}
                    autoFocus
                  />
                  <button type="button" onClick={() => void salvarEdicao()} className="text-sm text-primary-500">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-sm text-gray-400">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-black dark:text-white">{it.nome}</span>
                  <span className="flex gap-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing({ id: it.id, value: it.nome })}
                      className="text-gray-400 hover:text-primary-500"
                      title="Renomear"
                      aria-label="Renomear"
                    >
                      <i className="ri-pencil-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(it.id)}
                      className="text-gray-400 hover:text-red-500"
                      title="Remover"
                      aria-label="Remover"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      <form onSubmit={criar} className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder={`Novo ${titulo.toLowerCase().replace(/s$/, '')}…`}
          className={`${inputCls} flex-1 text-sm py-1`}
        />
        <Button type="submit" variant="ghost">
          <i className="ri-add-line"></i>
        </Button>
      </form>
    </div>
  );
}
