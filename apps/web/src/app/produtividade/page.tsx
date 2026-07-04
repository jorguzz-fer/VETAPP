'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';

interface Produtividade {
  userId: string;
  nome: string;
  lancamentos: number;
  receitaCentavos: number;
  agendamentosConcluidos: number;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

// Produtividade por colaborador (doc 05 §6.1 — "a tela mais elogiada").
// Agrupamento por setor e unificação com analytics de vendas → fase 2.
export default function ProdutividadePage() {
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hoje());
  const [linhas, setLinhas] = useState<Produtividade[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/inteligencia/produtividade', {
      params: {
        query: {
          from: new Date(`${de}T00:00:00`).toISOString(),
          to: new Date(`${ate}T23:59:59`).toISOString(),
        },
      },
    });
    setLinhas((data as Produtividade[]) ?? []);
    setLoading(false);
  }, [de, ate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalReceita = linhas.reduce((s, l) => s + l.receitaCentavos, 0);

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Produtividade</h1>
          <p className="text-sm text-gray-500">Produção por colaborador no período.</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} text-sm`} />
          <span className="text-gray-400">→</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} text-sm`} />
        </div>
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="text-sm text-gray-500">Sem produção no período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Colaborador</th>
                <th className="py-2 font-medium text-right">Lançamentos</th>
                <th className="py-2 font-medium text-right">Agendamentos concluídos</th>
                <th className="py-2 font-medium text-right">Receita gerada</th>
                <th className="py-2 font-medium text-right">% do total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.userId} className="border-b border-gray-50 dark:border-[#172036]/50">
                  <td className="py-2.5 text-black dark:text-white">{l.nome}</td>
                  <td className="py-2.5 text-right text-gray-500">{l.lancamentos}</td>
                  <td className="py-2.5 text-right text-gray-500">{l.agendamentosConcluidos}</td>
                  <td className="py-2.5 text-right font-medium text-black dark:text-white">{brl(l.receitaCentavos)}</td>
                  <td className="py-2.5 text-right text-gray-500">
                    {totalReceita > 0 ? `${Math.round((l.receitaCentavos / totalReceita) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
