'use client';

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Orcamento {
  id: string;
  responsavelId: string;
  responsavelNome: string;
  status: string;
  totalCentavos: number;
  itens: number;
  observacoes: string | null;
  criadoEm: string;
}

interface Linha {
  id: string;
  itemId: string | null;
  descricao: string;
  quantidade: number;
  valorCentavos: number;
}

interface ItemCatalogo {
  id: string;
  codigo: string;
  nome: string;
  precoCentavos: number;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

const BADGE: Record<string, string> = {
  aberto: 'bg-amber-50 text-amber-600',
  aprovado: 'bg-blue-50 text-blue-600',
  recusado: 'bg-red-50 text-red-500',
  convertido: 'bg-green-50 text-green-600',
};

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [filtro, setFiltro] = useState<'aberto' | 'aprovado' | 'convertido' | 'todas'>('aberto');
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<{ itemId: string; descricao: string; quantidade: string; valor: string }>({
    itemId: '',
    descricao: '',
    quantidade: '1',
    valor: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/orcamentos', {
      params: { query: { status: filtro === 'todas' ? undefined : filtro } },
    });
    setOrcamentos((data as Orcamento[]) ?? []);
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.GET('/api/catalogo', { params: { query: {} } }).then(({ data }) => {
      setItens((data as ItemCatalogo[]) ?? []);
    });
  }, []);

  async function abrir(id: string, forcar = false) {
    if (expandido === id && !forcar) {
      setExpandido(null);
      return;
    }
    setExpandido(id);
    const { data } = await api.GET('/api/orcamentos/{id}', { params: { path: { id } } });
    setLinhas(((data as { linhas?: Linha[] })?.linhas as Linha[]) ?? []);
  }

  async function onAddItem(e: FormEvent, orcamentoId: string) {
    e.preventDefault();
    if (!form.itemId && !form.descricao.trim()) return;
    setSalvando(true);
    await api.POST('/api/orcamentos/{id}/itens', {
      params: { path: { id: orcamentoId } },
      body: {
        itemId: form.itemId || undefined,
        descricao: form.descricao.trim() || undefined,
        quantidade: parseInt(form.quantidade || '1', 10),
        valorCentavos: form.valor ? Math.round(parseFloat(form.valor.replace(',', '.')) * 100) : undefined,
      },
    });
    setSalvando(false);
    setForm({ itemId: '', descricao: '', quantidade: '1', valor: '' });
    void abrir(orcamentoId, true);
    void load();
  }

  async function onRemoveItem(orcamentoId: string, linhaId: string) {
    await api.DELETE('/api/orcamentos/{id}/itens/{linhaId}', {
      params: { path: { id: orcamentoId, linhaId } },
    });
    void abrir(orcamentoId, true);
    void load();
  }

  async function onStatus(o: Orcamento, status: 'aprovado' | 'recusado') {
    await api.PATCH('/api/orcamentos/{id}/status', { params: { path: { id: o.id } }, body: { status } });
    void load();
  }

  async function onConverter(o: Orcamento) {
    if (!confirm(`Converter o orçamento de ${o.responsavelNome} (${brl(o.totalCentavos)}) em cobrança?`)) return;
    const { error } = await api.POST('/api/orcamentos/{id}/converter', { params: { path: { id: o.id } } });
    if (error) {
      alert('Não foi possível converter (orçamento vazio ou recusado?).');
      return;
    }
    setExpandido(null);
    void load();
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Orçamentos</h1>
          <p className="text-sm text-gray-500">
            Criados pela ficha do cliente. Converter lança os itens na fatura aberta.
          </p>
        </div>
      </div>

      <Card>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['aberto', 'aprovado', 'convertido', 'todas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`text-sm rounded-full px-4 py-1.5 capitalize transition-all ${
                filtro === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-50 dark:bg-[#15203c] text-gray-500 hover:text-primary-500'
              }`}
            >
              {f === 'todas' ? 'Todos' : `${f}s`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : orcamentos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum orçamento {filtro !== 'todas' ? `(${filtro})` : ''}. Crie pela ficha do cliente
            (botão <span className="font-medium">Orçamento</span>).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Criado em</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Itens</th>
                <th className="py-2 font-medium text-right">Total</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-b border-gray-50 dark:border-[#172036]/50">
                    <td className="py-2.5">
                      <Link href={`/clientes/${o.responsavelId}`} className="text-black dark:text-white hover:text-primary-500">
                        {o.responsavelNome}
                      </Link>
                      {o.observacoes && <span className="block text-xs text-gray-400">{o.observacoes}</span>}
                    </td>
                    <td className="py-2.5 text-gray-500">{new Date(o.criadoEm).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2.5">
                      <span className={`text-xs rounded-full px-2.5 py-0.5 capitalize ${BADGE[o.status] ?? ''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-500">{o.itens}</td>
                    <td className="py-2.5 text-right font-medium text-black dark:text-white">{brl(o.totalCentavos)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => abrir(o.id)}>
                        <i className={expandido === o.id ? 'ri-arrow-up-s-line' : 'ri-file-list-3-line'}></i>{' '}
                        {expandido === o.id ? 'Fechar' : 'Itens'}
                      </Button>
                      {o.status === 'aberto' && (
                        <>
                          <Button variant="ghost" onClick={() => onStatus(o, 'aprovado')}>
                            <i className="ri-thumb-up-line"></i>
                          </Button>
                          <Button variant="ghost" onClick={() => onStatus(o, 'recusado')}>
                            <i className="ri-thumb-down-line"></i>
                          </Button>
                        </>
                      )}
                      {(o.status === 'aberto' || o.status === 'aprovado') && o.itens > 0 && (
                        <Button variant="ghost" onClick={() => onConverter(o)}>
                          <i className="ri-exchange-dollar-line"></i> Converter
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandido === o.id && (
                    <tr className="bg-gray-50/60 dark:bg-[#15203c]/40">
                      <td colSpan={6} className="px-3 py-3">
                        {o.status === 'aberto' && (
                          <form onSubmit={(e) => onAddItem(e, o.id)} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 md:items-end">
                            <label className="flex flex-col gap-1 text-xs md:col-span-2">
                              <span className="text-gray-600 dark:text-gray-300">Item do catálogo</span>
                              <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
                                <option value="">— livre —</option>
                                {itens.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.codigo} — {it.nome} ({brl(it.precoCentavos)})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs md:col-span-2">
                              <span className="text-gray-600 dark:text-gray-300">Descrição</span>
                              <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputCls} placeholder="Pacote banho x4" />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">Qtd</span>
                              <input value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} inputMode="numeric" className={inputCls} />
                            </label>
                            <div className="flex gap-2 items-end">
                              <label className="flex flex-col gap-1 text-xs flex-1">
                                <span className="text-gray-600 dark:text-gray-300">Valor (R$)</span>
                                <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} inputMode="decimal" className={inputCls} placeholder="catálogo" />
                              </label>
                              <Button type="submit" disabled={salvando}>{salvando ? '…' : 'Incluir'}</Button>
                            </div>
                          </form>
                        )}

                        {linhas.length === 0 ? (
                          <p className="text-xs text-gray-500">Sem itens.</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {linhas.map((l) => (
                              <li key={l.id} className="flex items-center gap-3 text-xs">
                                <span className="text-black dark:text-white">
                                  {l.descricao}
                                  {l.quantidade > 1 ? ` x${l.quantidade}` : ''}
                                </span>
                                <span className="text-gray-500">{brl(l.valorCentavos * l.quantidade)}</span>
                                {o.status === 'aberto' && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveItem(o.id, l.id)}
                                    className="ml-auto text-gray-400 hover:text-red-500"
                                    title="Remover"
                                    aria-label="Remover"
                                  >
                                    <i className="ri-delete-bin-line"></i>
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
