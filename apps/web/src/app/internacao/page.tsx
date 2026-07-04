'use client';

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Internacao {
  id: string;
  animalId: string;
  animalNome: string;
  responsavelId: string;
  responsavelNome: string;
  motivo: string;
  box: string | null;
  status: string;
  entradaEm: string;
  altaEm: string | null;
  pendentes: number;
}

interface Execucao {
  id: string;
  itemId: string | null;
  descricao: string;
  quantidade: number;
  valorCentavos: number | null;
  executadaEm: string | null;
}

interface ItemCatalogo {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  precoCentavos: number;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

function diasDesde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return dias === 0 ? 'hoje' : dias === 1 ? '1 dia' : `${dias} dias`;
}

export default function InternacaoPage() {
  const [internacoes, setInternacoes] = useState<Internacao[]>([]);
  const [filtro, setFiltro] = useState<'internado' | 'alta' | 'todas'>('internado');
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
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
    const { data } = await api.GET('/api/internacoes', {
      params: { query: { status: filtro === 'todas' ? undefined : filtro } },
    });
    setInternacoes((data as Internacao[]) ?? []);
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
    if (expandida === id && !forcar) {
      setExpandida(null);
      return;
    }
    setExpandida(id);
    const { data } = await api.GET('/api/internacoes/{id}', { params: { path: { id } } });
    setExecucoes(((data as { execucoes?: Execucao[] })?.execucoes as Execucao[]) ?? []);
  }

  async function onPrescrever(e: FormEvent, internacaoId: string) {
    e.preventDefault();
    if (!form.itemId && !form.descricao.trim()) return;
    setSalvando(true);
    await api.POST('/api/internacoes/{id}/execucoes', {
      params: { path: { id: internacaoId } },
      body: {
        itemId: form.itemId || undefined,
        descricao: form.descricao.trim() || undefined,
        quantidade: parseInt(form.quantidade || '1', 10),
        valorCentavos: form.valor ? Math.round(parseFloat(form.valor.replace(',', '.')) * 100) : undefined,
      },
    });
    setSalvando(false);
    setForm({ itemId: '', descricao: '', quantidade: '1', valor: '' });
    void abrir(internacaoId, true);
    void load();
  }

  async function onExecutar(internacaoId: string, exec: Execucao) {
    const { data } = await api.POST('/api/internacoes/{id}/execucoes/{execId}/executar', {
      params: { path: { id: internacaoId, execId: exec.id } },
    });
    const r = data as { estoqueBaixado?: boolean } | undefined;
    if (r && exec.itemId && r.estoqueBaixado === false) {
      alert('Executado — mas SEM baixa de estoque (saldo insuficiente). Ajuste o estoque.');
    }
    void abrir(internacaoId, true);
    void load();
  }

  async function onAlta(i: Internacao) {
    const obs = prompt(`Alta de ${i.animalNome} — observações (opcional):`);
    if (obs === null) return;
    await api.POST('/api/internacoes/{id}/alta', {
      params: { path: { id: i.id } },
      body: { observacoes: obs || undefined },
    });
    setExpandida(null);
    void load();
  }

  const internados = internacoes.filter((i) => i.status === 'internado').length;

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Internação</h1>
          <p className="text-sm text-gray-500">
            Executar prescrição = baixa de estoque + faturamento automático. Admissão pelo prontuário do animal.
          </p>
        </div>
        {internados > 0 && (
          <span className="text-sm text-gray-500">
            Internados: <span className="font-semibold text-primary-600">{internados}</span>
          </span>
        )}
      </div>

      <Card>
        <div className="flex gap-2 mb-4">
          {(['internado', 'alta', 'todas'] as const).map((f) => (
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
              {f === 'todas' ? 'Todas' : f === 'internado' ? 'Internados' : 'Altas'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : internacoes.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma internação {filtro !== 'todas' ? `(${filtro})` : ''}. Para internar, abra o prontuário do
            animal e use a ação <span className="font-medium">Internar</span>.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Animal</th>
                <th className="py-2 font-medium">Responsável</th>
                <th className="py-2 font-medium">Motivo</th>
                <th className="py-2 font-medium">Box</th>
                <th className="py-2 font-medium">Entrada</th>
                <th className="py-2 font-medium text-right">Pendentes</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {internacoes.map((i) => (
                <Fragment key={i.id}>
                  <tr className="border-b border-gray-50 dark:border-[#172036]/50">
                    <td className="py-2.5">
                      <Link href={`/animais/${i.animalId}`} className="text-black dark:text-white hover:text-primary-500">
                        {i.animalNome}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <Link href={`/clientes/${i.responsavelId}`} className="text-gray-500 hover:text-primary-500">
                        {i.responsavelNome}
                      </Link>
                    </td>
                    <td className="py-2.5 text-gray-500">{i.motivo}</td>
                    <td className="py-2.5 text-gray-500">{i.box ?? '—'}</td>
                    <td className="py-2.5 text-gray-500">
                      {new Date(i.entradaEm).toLocaleDateString('pt-BR')}{' '}
                      {i.status === 'internado' && <span className="text-xs">({diasDesde(i.entradaEm)})</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      {i.pendentes > 0 ? (
                        <span className="text-xs rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-600">
                          {i.pendentes}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => abrir(i.id)}>
                        <i className={expandida === i.id ? 'ri-arrow-up-s-line' : 'ri-stethoscope-line'}></i>{' '}
                        {expandida === i.id ? 'Fechar' : 'Mapa'}
                      </Button>
                      {i.status === 'internado' && (
                        <Button variant="ghost" onClick={() => onAlta(i)}>
                          <i className="ri-logout-box-r-line"></i> Alta
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandida === i.id && (
                    <tr className="bg-gray-50/60 dark:bg-[#15203c]/40">
                      <td colSpan={7} className="px-3 py-3">
                        {i.status === 'internado' && (
                          <form onSubmit={(e) => onPrescrever(e, i.id)} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 md:items-end">
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
                              <input
                                value={form.descricao}
                                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                                className={inputCls}
                                placeholder="Dipirona 25mg/kg IV"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">Qtd</span>
                              <input
                                value={form.quantidade}
                                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                                inputMode="numeric"
                                className={inputCls}
                              />
                            </label>
                            <div className="flex gap-2 items-end">
                              <label className="flex flex-col gap-1 text-xs flex-1">
                                <span className="text-gray-600 dark:text-gray-300">Valor (R$)</span>
                                <input
                                  value={form.valor}
                                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                                  inputMode="decimal"
                                  className={inputCls}
                                  placeholder="catálogo"
                                />
                              </label>
                              <Button type="submit" disabled={salvando}>
                                {salvando ? '…' : 'Prescrever'}
                              </Button>
                            </div>
                          </form>
                        )}

                        {execucoes.length === 0 ? (
                          <p className="text-xs text-gray-500">Sem prescrições.</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {execucoes.map((ex) => (
                              <li key={ex.id} className="flex items-center gap-3 text-xs">
                                <span
                                  className={`rounded-full px-2 py-0.5 ${
                                    ex.executadaEm ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                                  }`}
                                >
                                  {ex.executadaEm ? 'executada' : 'pendente'}
                                </span>
                                <span className="text-black dark:text-white">
                                  {ex.descricao}
                                  {ex.quantidade > 1 ? ` x${ex.quantidade}` : ''}
                                </span>
                                {ex.valorCentavos != null && (
                                  <span className="text-gray-500">{brl(ex.valorCentavos * ex.quantidade)}</span>
                                )}
                                {ex.executadaEm ? (
                                  <span className="text-gray-400 ml-auto">
                                    {new Date(ex.executadaEm).toLocaleString('pt-BR')}
                                  </span>
                                ) : (
                                  i.status === 'internado' && (
                                    <button
                                      type="button"
                                      onClick={() => onExecutar(i.id, ex)}
                                      className="ml-auto text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                      <i className="ri-check-double-line"></i> Executar
                                    </button>
                                  )
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
