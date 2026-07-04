'use client';

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Fatura {
  id: string;
  responsavelId: string;
  responsavelNome: string;
  status: string;
  totalCentavos: number;
  recebidoCentavos: number;
  itens: number;
  criadaEm: string;
}

interface Recebimento {
  id: string;
  valorCentavos: number;
  formaId: string | null;
  formaNome: string | null;
  observacao: string | null;
  criadoEm: string;
}

interface Forma {
  id: string;
  nome: string;
  tipo: string;
  taxaBps: number;
  ativo: boolean;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

const BADGE: Record<string, string> = {
  aberta: 'bg-amber-50 text-amber-600',
  parcial: 'bg-blue-50 text-blue-600',
  paga: 'bg-green-50 text-green-600',
  cancelada: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
};

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [formas, setFormas] = useState<Forma[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'aberta' | 'parcial' | 'paga'>('aberta');
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recebimento[]>([]);
  const [form, setForm] = useState<{ valor: string; formaId: string; obs: string }>({ valor: '', formaId: '', obs: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/faturas', {
      params: { query: { status: filtro === 'todas' ? undefined : filtro } },
    });
    setFaturas((data as Fatura[]) ?? []);
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.GET('/api/formas-recebimento', { params: { query: {} } }).then(({ data }) => {
      setFormas((data as Forma[]) ?? []);
    });
  }, []);

  async function abrir(f: Fatura, forcar = false) {
    if (aberto === f.id && !forcar) {
      setAberto(null);
      return;
    }
    setAberto(f.id);
    setErro(null);
    setForm({ valor: ((f.totalCentavos - f.recebidoCentavos) / 100).toFixed(2), formaId: '', obs: '' });
    const { data } = await api.GET('/api/faturas/{id}/recebimentos', { params: { path: { id: f.id } } });
    setRecs((data as Recebimento[]) ?? []);
  }

  async function onReceber(e: FormEvent, f: Fatura) {
    e.preventDefault();
    setErro(null);
    const valor = Math.round(parseFloat(form.valor.replace(',', '.') || '0') * 100);
    if (valor <= 0) {
      setErro('Informe um valor.');
      return;
    }
    setSalvando(true);
    const { error } = await api.POST('/api/faturas/{id}/recebimentos', {
      params: { path: { id: f.id } },
      body: { valorCentavos: valor, formaId: form.formaId || undefined, observacao: form.obs || undefined },
    });
    setSalvando(false);
    if (error) {
      setErro('Não foi possível registrar (valor acima do saldo?).');
      return;
    }
    await load();
    await abrir({ ...f, recebidoCentavos: f.recebidoCentavos + valor }, true);
  }

  const totalAberto = faturas
    .filter((f) => f.status === 'aberta' || f.status === 'parcial')
    .reduce((s, f) => s + (f.totalCentavos - f.recebidoCentavos), 0);

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Faturas</h1>
          <p className="text-sm text-gray-500">
            Cobranças do faturamento automático. Recebimento parcial e forma de pagamento por baixa.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {totalAberto > 0 && (
            <span className="text-sm text-gray-500">
              A receber: <span className="font-semibold text-primary-600">{brl(totalAberto)}</span>
            </span>
          )}
          <Link href="/saldos" className="text-sm text-primary-500 hover:underline">
            Saldos dos clientes →
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['aberta', 'parcial', 'paga', 'todas'] as const).map((f) => (
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
              {f === 'todas' ? 'Todas' : f === 'aberta' ? 'Em aberto' : f === 'parcial' ? 'Parciais' : 'Pagas'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : faturas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma fatura {filtro !== 'todas' ? `(${filtro})` : ''}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Criada em</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Recebido</th>
                <th className="py-2 font-medium text-right">Total</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => {
                const saldo = f.totalCentavos - f.recebidoCentavos;
                return (
                  <Fragment key={f.id}>
                    <tr className="border-b border-gray-50 dark:border-[#172036]/50">
                      <td className="py-2.5">
                        <Link href={`/clientes/${f.responsavelId}`} className="text-black dark:text-white hover:text-primary-500">
                          {f.responsavelNome}
                        </Link>
                      </td>
                      <td className="py-2.5 text-gray-500">{new Date(f.criadaEm).toLocaleDateString('pt-BR')}</td>
                      <td className="py-2.5">
                        <span className={`text-xs rounded-full px-2.5 py-0.5 capitalize ${BADGE[f.status] ?? ''}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-500">
                        {f.recebidoCentavos > 0 ? brl(f.recebidoCentavos) : '—'}
                      </td>
                      <td className="py-2.5 text-right font-medium text-black dark:text-white">{brl(f.totalCentavos)}</td>
                      <td className="py-2.5 text-right">
                        {(f.status === 'aberta' || f.status === 'parcial') && (
                          <Button variant="ghost" onClick={() => abrir(f)}>
                            <i className="ri-hand-coin-line"></i> Receber ({brl(saldo)})
                          </Button>
                        )}
                      </td>
                    </tr>
                    {aberto === f.id && (
                      <tr className="bg-gray-50/60 dark:bg-[#15203c]/40">
                        <td colSpan={6} className="px-3 py-3">
                          <form onSubmit={(e) => onReceber(e, f)} className="grid grid-cols-1 md:grid-cols-4 gap-2 md:items-end mb-3">
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">Valor (R$)</span>
                              <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} inputMode="decimal" className={inputCls} />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">Forma</span>
                              <select value={form.formaId} onChange={(e) => setForm({ ...form, formaId: e.target.value })} className={inputCls}>
                                <option value="">—</option>
                                {formas.map((fo) => (
                                  <option key={fo.id} value={fo.id}>
                                    {fo.nome}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">Observação</span>
                              <input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} className={inputCls} placeholder="opcional" />
                            </label>
                            <Button type="submit" disabled={salvando}>{salvando ? '…' : 'Registrar'}</Button>
                            {erro && <p className="text-xs text-red-500 md:col-span-4">{erro}</p>}
                          </form>
                          {recs.length === 0 ? (
                            <p className="text-xs text-gray-500">Nenhum recebimento ainda.</p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {recs.map((r) => (
                                <li key={r.id} className="flex items-center gap-3 text-xs">
                                  <span className="font-medium text-black dark:text-white">{brl(r.valorCentavos)}</span>
                                  {r.formaNome && <span className="text-gray-500">{r.formaNome}</span>}
                                  {r.observacao && <span className="text-gray-400">· {r.observacao}</span>}
                                  <span className="text-gray-400 ml-auto">{new Date(r.criadoEm).toLocaleString('pt-BR')}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
