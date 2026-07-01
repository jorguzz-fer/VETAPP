'use client';

import { useCallback, useEffect, useState } from 'react';
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
  itens: number;
  criadaEm: string;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const BADGE: Record<string, string> = {
  aberta: 'bg-amber-50 text-amber-600',
  paga: 'bg-green-50 text-green-600',
  cancelada: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
};

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'aberta' | 'paga'>('aberta');
  const [loading, setLoading] = useState(true);

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

  async function onPagar(f: Fatura) {
    if (!confirm(`Receber ${brl(f.totalCentavos)} de ${f.responsavelNome}?`)) return;
    await api.POST('/api/faturas/{id}/pagar', { params: { path: { id: f.id } } });
    void load();
  }

  const totalAberto = faturas.filter((f) => f.status === 'aberta').reduce((s, f) => s + f.totalCentavos, 0);

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Faturas</h1>
          <p className="text-sm text-gray-500">
            Cobranças consolidadas do faturamento automático do prontuário.
          </p>
        </div>
        {totalAberto > 0 && (
          <span className="text-sm text-gray-500">
            Em aberto: <span className="font-semibold text-primary-600">{brl(totalAberto)}</span>
          </span>
        )}
      </div>

      <Card>
        <div className="flex gap-2 mb-4">
          {(['aberta', 'paga', 'todas'] as const).map((f) => (
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
              {f === 'todas' ? 'Todas' : f === 'aberta' ? 'Em aberto' : 'Pagas'}
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
                <th className="py-2 font-medium">Itens</th>
                <th className="py-2 font-medium">Criada em</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Total</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id} className="border-b border-gray-50 dark:border-[#172036]/50">
                  <td className="py-2.5">
                    <Link href={`/clientes/${f.responsavelId}`} className="text-black dark:text-white hover:text-primary-500">
                      {f.responsavelNome}
                    </Link>
                  </td>
                  <td className="py-2.5 text-gray-500">{f.itens}</td>
                  <td className="py-2.5 text-gray-500">{new Date(f.criadaEm).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2.5">
                    <span className={`text-xs rounded-full px-2.5 py-0.5 capitalize ${BADGE[f.status] ?? ''}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-medium text-black dark:text-white">{brl(f.totalCentavos)}</td>
                  <td className="py-2.5 text-right">
                    {f.status === 'aberta' && (
                      <Button variant="ghost" onClick={() => onPagar(f)}>
                        <i className="ri-hand-coin-line"></i> Receber
                      </Button>
                    )}
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
