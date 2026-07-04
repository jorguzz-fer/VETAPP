'use client';

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Saldo {
  itemId: string;
  codigo: string;
  nome: string;
  tipo: string;
  saldo: number;
  estoqueMinimo: number;
  abaixoDoMinimo: boolean;
}

interface Movimento {
  id: string;
  itemId: string;
  tipo: string;
  quantidade: number;
  custoCentavos: number | null;
  lote: string | null;
  validade: string | null;
  motivo: string | null;
  criadoEm: string;
}

interface Vencimento {
  itemId: string;
  codigo: string;
  nome: string;
  lote: string | null;
  validade: string;
  quantidade: number;
  diasParaVencer: number;
}

const TIPOS = ['entrada', 'saida', 'ajuste'] as const;
type TipoMov = (typeof TIPOS)[number];

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

const MOV_BADGE: Record<string, string> = {
  entrada: 'bg-green-50 text-green-600',
  saida: 'bg-red-50 text-red-600',
  ajuste: 'bg-amber-50 text-amber-600',
};

export default function EstoquePage() {
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [search, setSearch] = useState('');
  const [apenasBaixo, setApenasBaixo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [vencimentos, setVencimentos] = useState<Vencimento[]>([]);
  const [form, setForm] = useState<{
    itemId: string;
    tipo: TipoMov;
    quantidade: string;
    custo: string;
    lote: string;
    validade: string;
    motivo: string;
  }>({
    itemId: '',
    tipo: 'entrada',
    quantidade: '',
    custo: '',
    lote: '',
    validade: '',
    motivo: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, venc] = await Promise.all([
      api.GET('/api/estoque', {
        params: { query: { search: search || undefined, apenasBaixo: apenasBaixo || undefined } },
      }),
      api.GET('/api/estoque/vencimentos', { params: { query: { dias: 90 } } }),
    ]);
    setSaldos((data as Saldo[]) ?? []);
    setVencimentos((venc.data as Vencimento[]) ?? []);
    setLoading(false);
  }, [search, apenasBaixo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRegistrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.itemId) {
      setError('Selecione um item.');
      return;
    }
    setSaving(true);
    const { error: err } = await api.POST('/api/estoque/movimentos', {
      body: {
        itemId: form.itemId,
        tipo: form.tipo,
        quantidade: parseInt(form.quantidade || '0', 10),
        custoCentavos:
          form.tipo === 'entrada' && form.custo
            ? Math.round(parseFloat(form.custo.replace(',', '.')) * 100)
            : undefined,
        lote: form.tipo === 'entrada' && form.lote ? form.lote : undefined,
        validade: form.tipo === 'entrada' && form.validade ? form.validade : undefined,
        motivo: form.motivo || undefined,
      },
    });
    setSaving(false);
    if (err) {
      setError('Não foi possível registrar (estoque insuficiente?).');
      return;
    }
    setForm({ itemId: '', tipo: 'entrada', quantidade: '', custo: '', lote: '', validade: '', motivo: '' });
    setShowForm(false);
    void load();
    if (expandido) void abrirHistorico(expandido, true);
  }

  async function abrirHistorico(itemId: string, forcar = false) {
    if (expandido === itemId && !forcar) {
      setExpandido(null);
      return;
    }
    setExpandido(itemId);
    const { data } = await api.GET('/api/estoque/{itemId}/movimentos', {
      params: { path: { itemId } },
    });
    setMovimentos((data as Movimento[]) ?? []);
  }

  async function onSetMinimo(s: Saldo) {
    const val = prompt(`Estoque mínimo de "${s.nome}" (0 = sem alerta):`, String(s.estoqueMinimo));
    if (val == null) return;
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 0) return;
    await api.PATCH('/api/estoque/{itemId}/minimo', {
      params: { path: { itemId: s.itemId } },
      body: { estoqueMinimo: n },
    });
    void load();
  }

  const abaixo = saldos.filter((s) => s.abaixoDoMinimo).length;

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Estoque</h1>
          <p className="text-sm text-gray-500">
            Saldo por item do catálogo — entradas, saídas e ajustes de inventário.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line"></i> Movimentar
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={onRegistrar} className="grid grid-cols-1 md:grid-cols-5 gap-3 md:items-end">
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Item</span>
              <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
                <option value="">Selecione…</option>
                {saldos.map((s) => (
                  <option key={s.itemId} value={s.itemId}>
                    {s.codigo} — {s.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Tipo</span>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoMov })}
                className={`${inputCls} capitalize`}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t === 'saida' ? 'saída' : t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                {form.tipo === 'ajuste' ? 'Delta (±)' : 'Quantidade'}
              </span>
              <input
                required
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                inputMode="numeric"
                className={inputCls}
                placeholder={form.tipo === 'ajuste' ? '-2' : '10'}
              />
            </label>
            {form.tipo === 'entrada' && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Custo unit. (R$)</span>
                  <input
                    value={form.custo}
                    onChange={(e) => setForm({ ...form, custo: e.target.value })}
                    inputMode="decimal"
                    className={inputCls}
                    placeholder="9,90"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Lote</span>
                  <input
                    value={form.lote}
                    onChange={(e) => setForm({ ...form, lote: e.target.value })}
                    className={inputCls}
                    placeholder="L-2027A"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Validade</span>
                  <input
                    type="date"
                    value={form.validade}
                    onChange={(e) => setForm({ ...form, validade: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1 text-sm md:col-span-3">
              <span className="text-gray-600 dark:text-gray-300">Observação</span>
              <input
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                className={inputCls}
                placeholder="NF 123 / fornecedor / motivo do ajuste"
              />
            </label>
            <div className="md:col-span-5 flex items-center gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Registrar'}</Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </form>
        </Card>
      )}

      {vencimentos.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-alarm-warning-line text-amber-500"></i>
            <h2 className="text-base font-semibold text-black dark:text-white">Vencimentos próximos (90 dias)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Lote</th>
                  <th className="py-2 font-medium text-right">Qtd.</th>
                  <th className="py-2 font-medium">Validade</th>
                  <th className="py-2 font-medium text-right">Faltam</th>
                </tr>
              </thead>
              <tbody>
                {vencimentos.map((v, i) => (
                  <tr key={`${v.itemId}-${v.validade}-${i}`} className="border-b border-gray-50 dark:border-[#172036]/50">
                    <td className="py-2 text-black dark:text-white">{v.codigo} · {v.nome}</td>
                    <td className="py-2 text-gray-500 font-mono">{v.lote ?? '—'}</td>
                    <td className="py-2 text-right text-gray-500">{v.quantidade}</td>
                    <td className="py-2 text-gray-500">{new Date(v.validade).toLocaleDateString('pt-BR')}</td>
                    <td className={`py-2 text-right font-medium ${v.diasParaVencer < 0 ? 'text-red-500' : v.diasParaVencer <= 30 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {v.diasParaVencer < 0 ? `vencido há ${-v.diasParaVencer}d` : `${v.diasParaVencer}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#15203c] rounded-md px-3 py-2 max-w-[360px] flex-1">
            <i className="ri-search-line text-gray-400"></i>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código…"
              className="bg-transparent outline-none text-sm w-full text-black dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={apenasBaixo} onChange={(e) => setApenasBaixo(e.target.checked)} />
            Só abaixo do mínimo
            {abaixo > 0 && <span className="text-xs rounded-full px-2 py-0.5 bg-red-50 text-red-600">{abaixo}</span>}
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : saldos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item estocável encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Código</th>
                <th className="py-2 font-medium">Nome</th>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 font-medium text-right">Saldo</th>
                <th className="py-2 font-medium text-right">Mínimo</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => (
                <Fragment key={s.itemId}>
                  <tr className="border-b border-gray-50 dark:border-[#172036]/50">
                    <td className="py-2.5 text-gray-500 font-mono">{s.codigo}</td>
                    <td className="py-2.5 text-black dark:text-white">{s.nome}</td>
                    <td className="py-2.5 text-gray-500 capitalize">{s.tipo}</td>
                    <td className="py-2.5 text-right font-medium">
                      <span className={s.abaixoDoMinimo ? 'text-red-500' : 'text-black dark:text-white'}>{s.saldo}</span>
                      {s.abaixoDoMinimo && (
                        <i className="ri-alert-line text-red-500 ml-1" title="Abaixo do mínimo"></i>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onSetMinimo(s)}
                        className="text-gray-500 hover:text-primary-500"
                        title="Definir estoque mínimo"
                      >
                        {s.estoqueMinimo || '—'}
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => abrirHistorico(s.itemId)}
                        className="text-gray-400 hover:text-primary-500"
                        title="Histórico"
                        aria-label="Histórico"
                      >
                        <i className={expandido === s.itemId ? 'ri-arrow-up-s-line text-lg' : 'ri-history-line'}></i>
                      </button>
                    </td>
                  </tr>
                  {expandido === s.itemId && (
                    <tr className="bg-gray-50/60 dark:bg-[#15203c]/40">
                      <td colSpan={6} className="px-3 py-2">
                        {movimentos.length === 0 ? (
                          <p className="text-xs text-gray-500 py-1">Sem movimentações.</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5 py-1">
                            {movimentos.map((m) => (
                              <li key={m.id} className="flex items-center gap-3 text-xs">
                                <span className={`rounded-full px-2 py-0.5 capitalize ${MOV_BADGE[m.tipo] ?? ''}`}>
                                  {m.tipo === 'saida' ? 'saída' : m.tipo}
                                </span>
                                <span className="font-mono text-black dark:text-white">
                                  {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                                </span>
                                {m.custoCentavos != null && (
                                  <span className="text-gray-500">custo {brl(m.custoCentavos)}</span>
                                )}
                                {m.lote && <span className="text-gray-500">· lote {m.lote}</span>}
                                {m.validade && (
                                  <span className="text-gray-500">· val. {new Date(m.validade).toLocaleDateString('pt-BR')}</span>
                                )}
                                {m.motivo && <span className="text-gray-500">· {m.motivo}</span>}
                                <span className="text-gray-400 ml-auto">
                                  {new Date(m.criadoEm).toLocaleString('pt-BR')}
                                </span>
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
