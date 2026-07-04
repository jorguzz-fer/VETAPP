'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Regra {
  id: string;
  userId: string;
  userNome: string;
  itemId: string | null;
  itemNome: string | null;
  percentBps: number;
}

interface ApuracaoColaborador {
  userId: string;
  nome: string;
  baseCentavos: number;
  comissaoCentavos: number;
  lancamentos: number;
}

interface Linha {
  descricao: string;
  valorCentavos: number;
  percentBps: number;
  comissaoCentavos: number;
  criadoEm: string;
}

interface Profissional {
  userId: string;
  nome: string;
  role: string;
}

interface ItemCatalogo {
  id: string;
  codigo: string;
  nome: string;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (bps: number) => `${(bps / 100).toLocaleString('pt-BR')}%`;
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ComissoesPage() {
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hoje());
  const [apuracao, setApuracao] = useState<ApuracaoColaborador[]>([]);
  const [minhas, setMinhas] = useState<Linha[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<{ userId: string; itemId: string; percent: string }>({
    userId: '',
    itemId: '',
    percent: '10',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const range = {
      from: new Date(`${de}T00:00:00`).toISOString(),
      to: new Date(`${ate}T23:59:59`).toISOString(),
    };
    const [ap, mi, re] = await Promise.all([
      api.GET('/api/comissoes', { params: { query: range } }),
      api.GET('/api/comissoes/minhas', { params: { query: range } }),
      api.GET('/api/comissoes/regras'),
    ]);
    setApuracao((ap.data as ApuracaoColaborador[]) ?? []);
    setMinhas((mi.data as Linha[]) ?? []);
    setRegras((re.data as Regra[]) ?? []);
    setLoading(false);
  }, [de, ate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.GET('/api/agenda/profissionais').then(({ data }) => {
      setProfissionais((data as Profissional[]) ?? []);
    });
    void api.GET('/api/catalogo', { params: { query: {} } }).then(({ data }) => {
      setItens((data as ItemCatalogo[]) ?? []);
    });
  }, []);

  async function onCreateRegra(e: FormEvent) {
    e.preventDefault();
    if (!form.userId) return;
    setSalvando(true);
    await api.POST('/api/comissoes/regras', {
      body: {
        userId: form.userId,
        itemId: form.itemId || undefined,
        percentBps: Math.round(parseFloat(form.percent.replace(',', '.') || '0') * 100),
      },
    });
    setSalvando(false);
    setForm({ userId: '', itemId: '', percent: '10' });
    void load();
  }

  async function onRemoveRegra(r: Regra) {
    if (!confirm(`Remover a regra de ${r.userNome}${r.itemNome ? ` para "${r.itemNome}"` : ' (geral)'}?`)) return;
    await api.DELETE('/api/comissoes/regras/{id}', { params: { path: { id: r.id } } });
    void load();
  }

  const totalMinhas = minhas.reduce((s, l) => s + l.comissaoCentavos, 0);

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Comissões</h1>
          <p className="text-sm text-gray-500">
            Comissão sobre lançamentos faturados com profissional (atendimentos, execuções, vendas).
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} text-sm`} />
          <span className="text-gray-400">→</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} text-sm`} />
        </div>
      </div>

      <Card>
        <h2 className="font-semibold text-black dark:text-white mb-1">Fechamento do período</h2>
        <p className="text-xs text-gray-500 mb-4">Consolidado a pagar por colaborador (doc 05 §5.1).</p>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : apuracao.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nada apurado no período — confira as regras abaixo e se os lançamentos têm profissional.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Colaborador</th>
                <th className="py-2 font-medium text-right">Lançamentos</th>
                <th className="py-2 font-medium text-right">Base</th>
                <th className="py-2 font-medium text-right">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {apuracao.map((a) => (
                <tr key={a.userId} className="border-b border-gray-50 dark:border-[#172036]/50">
                  <td className="py-2.5 text-black dark:text-white">{a.nome}</td>
                  <td className="py-2.5 text-right text-gray-500">{a.lancamentos}</td>
                  <td className="py-2.5 text-right text-gray-500">{brl(a.baseCentavos)}</td>
                  <td className="py-2.5 text-right font-medium text-primary-600">{brl(a.comissaoCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-black dark:text-white">Minhas comissões</h2>
          {totalMinhas > 0 && <span className="text-sm font-semibold text-primary-600">{brl(totalMinhas)}</span>}
        </div>
        <p className="text-xs text-gray-500 mb-4">Cada um vê o seu (doc 05 §5.3).</p>
        {minhas.length === 0 ? (
          <p className="text-sm text-gray-500">Sem comissões no período.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {minhas.map((l, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-black dark:text-white">{l.descricao}</span>
                <span className="text-gray-500 text-xs">
                  {brl(l.valorCentavos)} × {pct(l.percentBps)}
                </span>
                <span className="ml-auto font-medium text-primary-600">{brl(l.comissaoCentavos)}</span>
                <span className="text-gray-400 text-xs">{new Date(l.criadoEm).toLocaleDateString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-black dark:text-white mb-1">Regras de comissão</h2>
        <p className="text-xs text-gray-500 mb-4">
          Percentual por colaborador; regra com item específico sobrepõe a geral.
        </p>
        <form onSubmit={onCreateRegra} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end mb-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Colaborador</span>
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputCls}>
              <option value="">Selecione…</option>
              {profissionais.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Item (opcional)</span>
            <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
              <option value="">— geral —</option>
              {itens.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.codigo} — {it.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Percentual (%)</span>
            <input required value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} inputMode="decimal" className={inputCls} placeholder="10" />
          </label>
          <Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar regra'}</Button>
        </form>

        {regras.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma regra — sem regra, nada é comissionado.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {regras.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="text-black dark:text-white">{r.userNome}</span>
                <span className="text-gray-500 text-xs">{r.itemNome ?? 'geral'}</span>
                <span className="text-primary-600 font-medium">{pct(r.percentBps)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveRegra(r)}
                  className="ml-auto text-gray-400 hover:text-red-500"
                  title="Remover regra"
                  aria-label="Remover regra"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
