'use client';

import { useEffect, useState } from 'react';
import { portalApi, formatCentavos } from '@/lib/portalApi';
import { Card } from '@/components/ui/Card';

type Fatura = {
  id: string;
  status: string;
  totalCentavos: number;
  recebidoCentavos: number;
  saldoCentavos: number;
  notaNumero: string | null;
  notaStatus: string | null;
  criadaEm: string;
};
type Item = { descricao: string; valorCentavos: number };

const STATUS_STYLE: Record<string, string> = {
  aberta: 'bg-amber-50 text-amber-600',
  parcial: 'bg-blue-50 text-blue-600',
  paga: 'bg-green-50 text-green-600',
  cancelada: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PortalFaturas() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [itens, setItens] = useState<Record<string, Item[]>>({});

  useEffect(() => {
    (async () => {
      const { data } = await portalApi.GET('/api/portal/faturas');
      setFaturas(data ?? []);
      setLoading(false);
    })();
  }, []);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!itens[id]) {
      const { data } = await portalApi.GET('/api/portal/faturas/{id}', { params: { path: { id } } });
      if (data) setItens((m) => ({ ...m, [id]: data.itens }));
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Faturas</h1>
      {faturas.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">Nenhuma fatura.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {faturas.map((f) => (
            <Card key={f.id}>
              <button onClick={() => toggle(f.id)} className="w-full flex items-center justify-between text-left">
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">
                    {formatCentavos(f.totalCentavos)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatData(f.criadaEm)}
                    {f.notaNumero && f.notaStatus === 'emitida' && (
                      <span className="ml-2 text-green-600">
                        <i className="ri-receipt-line"></i> NFS-e {f.notaNumero}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {f.saldoCentavos > 0 && f.status !== 'cancelada' && (
                    <span className="text-xs text-amber-600">saldo {formatCentavos(f.saldoCentavos)}</span>
                  )}
                  <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLE[f.status] ?? ''}`}>
                    {f.status}
                  </span>
                  <i className={`ri-arrow-down-s-line transition-transform ${openId === f.id ? 'rotate-180' : ''}`}></i>
                </div>
              </button>
              {openId === f.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#172036]">
                  {!itens[f.id] ? (
                    <p className="text-xs text-gray-400">Carregando itens…</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {itens[f.id].map((it, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">{it.descricao}</span>
                          <span>{formatCentavos(it.valorCentavos)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 text-center">
        Pagamento online chega em breve. Por ora, quite na clínica ou pelos canais informados.
      </p>
    </div>
  );
}
