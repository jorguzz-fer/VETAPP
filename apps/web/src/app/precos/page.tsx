'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface PrecoHist {
  id: string;
  precoCentavos: number;
  vigenteDesde: string;
  alteradoPorNome: string | null;
}

interface Item {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  precoCentavos: number;
  ativo: boolean;
}

const TIPOS = ['produto', 'servico', 'exame', 'vacina', 'medicamento', 'cirurgia'] as const;
type TipoItem = (typeof TIPOS)[number];

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

export default function PrecosPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ codigo: string; nome: string; tipo: TipoItem; preco: string }>({
    codigo: '',
    nome: '',
    tipo: 'servico',
    preco: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/catalogo', {
      params: { query: { search: search || undefined, incluirInativos: true } },
    });
    setItems((data as Item[]) ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { data, error: err } = await api.POST('/api/catalogo', {
      body: {
        codigo: form.codigo,
        nome: form.nome,
        tipo: form.tipo,
        precoCentavos: Math.round(parseFloat(form.preco.replace(',', '.') || '0') * 100),
      },
    });
    setSaving(false);
    if (err) {
      setError('Não foi possível salvar (código já em uso?).');
      return;
    }
    if (data) {
      setForm({ codigo: '', nome: '', tipo: 'servico', preco: '' });
      setShowForm(false);
      void load();
    }
  }

  async function onToggleAtivo(item: Item) {
    await api.PATCH('/api/catalogo/{id}', { params: { path: { id: item.id } }, body: { ativo: !item.ativo } });
    void load();
  }

  async function onDelete(item: Item) {
    if (!confirm(`Excluir "${item.nome}" (código ${item.codigo})?`)) return;
    await api.DELETE('/api/catalogo/{id}', { params: { path: { id: item.id } } });
    void load();
  }

  // Editar preço: gera uma nova vigência no histórico (server-side).
  async function onEditarPreco(item: Item) {
    const atual = (item.precoCentavos / 100).toFixed(2).replace('.', ',');
    const entrada = prompt(`Novo preço de "${item.nome}" (R$):`, atual);
    if (entrada == null) return;
    const centavos = Math.round(parseFloat(entrada.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos < 0) {
      alert('Valor inválido.');
      return;
    }
    await api.PATCH('/api/catalogo/{id}', {
      params: { path: { id: item.id } },
      body: { precoCentavos: centavos },
    });
    void load();
  }

  // Histórico de preços em modal.
  const [histItem, setHistItem] = useState<Item | null>(null);
  const [historico, setHistorico] = useState<PrecoHist[] | null>(null);
  async function abrirHistorico(item: Item) {
    setHistItem(item);
    setHistorico(null);
    const { data } = await api.GET('/api/catalogo/{id}/precos', { params: { path: { id: item.id } } });
    setHistorico((data as PrecoHist[]) ?? []);
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Tabela de preços</h1>
          <p className="text-sm text-gray-500">
            Cadastro único de produtos, serviços, exames, vacinas, medicamentos e cirurgias — por código.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line"></i> Novo item
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Código</span>
              <input required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={inputCls} placeholder="22" />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} placeholder="Avaliação cirúrgica" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Tipo</span>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoItem })} className={`${inputCls} capitalize`}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Preço (R$)</span>
              <input required value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} inputMode="decimal" className={inputCls} placeholder="150,00" />
            </label>
            <div className="md:col-span-3 flex items-center gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#15203c] rounded-md px-3 py-2 mb-4 max-w-[400px]">
          <i className="ri-search-line text-gray-400"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código…"
            className="bg-transparent outline-none text-sm w-full text-black dark:text-white"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Código</th>
                <th className="py-2 font-medium">Nome</th>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 font-medium text-right">Preço</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`border-b border-gray-50 dark:border-[#172036]/50 ${item.ativo ? '' : 'opacity-50'}`}>
                  <td className="py-2.5 text-gray-500 font-mono">{item.codigo}</td>
                  <td className="py-2.5 text-black dark:text-white">{item.nome}</td>
                  <td className="py-2.5 text-gray-500 capitalize">{item.tipo}</td>
                  <td className="py-2.5 text-right text-black dark:text-white">{brl(item.precoCentavos)}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onEditarPreco(item)}
                      className="text-gray-400 hover:text-primary-500"
                      title="Alterar preço"
                      aria-label="Alterar preço"
                    >
                      <i className="ri-price-tag-3-line text-lg"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirHistorico(item)}
                      className="ml-3 text-gray-400 hover:text-primary-500"
                      title="Histórico de preços"
                      aria-label="Histórico de preços"
                    >
                      <i className="ri-history-line text-lg"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleAtivo(item)}
                      className={`ml-3 ${item.ativo ? 'text-green-500' : 'text-gray-400'} hover:opacity-70`}
                      title={item.ativo ? 'Desativar' : 'Ativar'}
                      aria-label={item.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <i className={item.ativo ? 'ri-toggle-fill text-xl' : 'ri-toggle-line text-xl'}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="ml-3 text-gray-400 hover:text-red-500"
                      title="Excluir"
                      aria-label="Excluir"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={histItem !== null}
        onClose={() => setHistItem(null)}
        title={histItem ? `Histórico de preços — ${histItem.nome}` : 'Histórico de preços'}
      >
        {historico === null ? (
          <p className="text-sm text-gray-500 py-4">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">Sem histórico registrado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036] text-sm">
            {historico.map((h, i) => (
              <li key={h.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-medium text-black dark:text-white">{brl(h.precoCentavos)}</span>
                  {i === 0 && <span className="ml-2 text-xs text-green-600">(vigente)</span>}
                  <div className="text-xs text-gray-400">
                    desde {new Date(h.vigenteDesde).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {h.alteradoPorNome ? ` · ${h.alteradoPorNome}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
