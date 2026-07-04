'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';

interface Saldo {
  responsavelId: string;
  responsavelNome: string;
  devedorCentavos: number;
  faturasAbertas: number;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Saldo dos clientes (doc 13 §1, movido de Vendas 4.9): devedores em aberto.
export default function SaldosPage() {
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.GET('/api/financeiro/saldos').then(({ data }) => {
      setSaldos((data as Saldo[]) ?? []);
      setLoading(false);
    });
  }, []);

  const total = saldos.reduce((s, x) => s + x.devedorCentavos, 0);

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Saldo dos clientes</h1>
          <p className="text-sm text-gray-500">Devedores com faturas em aberto ou parciais.</p>
        </div>
        {total > 0 && (
          <span className="text-sm text-gray-500">
            Total a receber: <span className="font-semibold text-primary-600">{brl(total)}</span>
          </span>
        )}
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : saldos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cliente devedor — tudo quitado. 🎉</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium text-right">Faturas em aberto</th>
                <th className="py-2 font-medium text-right">Saldo devedor</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.responsavelId} className="border-b border-gray-50 dark:border-[#172036]/50">
                  <td className="py-2.5">
                    <Link href={`/clientes/${s.responsavelId}`} className="text-black dark:text-white hover:text-primary-500">
                      {s.responsavelNome}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right text-gray-500">{s.faturasAbertas}</td>
                  <td className="py-2.5 text-right font-medium text-red-500">{brl(s.devedorCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
