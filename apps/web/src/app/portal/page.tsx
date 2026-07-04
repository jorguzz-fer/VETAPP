'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { portalApi, formatCentavos } from '@/lib/portalApi';
import { Card } from '@/components/ui/Card';

type Pet = { id: string; nome: string; especie: string | null; raca: string | null; fotoUrl: string | null; status: string };
type Agendamento = { id: string; titulo: string; inicio: string; status: string; petNome: string | null };

function formatData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PortalHome() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [proximos, setProximos] = useState<Agendamento[]>([]);
  const [devedor, setDevedor] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, a, f] = await Promise.all([
        portalApi.GET('/api/portal/pets'),
        portalApi.GET('/api/portal/agendamentos'),
        portalApi.GET('/api/portal/faturas'),
      ]);
      setPets(p.data ?? []);
      const now = Date.now();
      setProximos(
        (a.data ?? [])
          .filter((x) => x.status !== 'cancelado' && new Date(x.inicio).getTime() >= now)
          .sort((x, y) => new Date(x.inicio).getTime() - new Date(y.inicio).getTime())
          .slice(0, 3),
      );
      setDevedor((f.data ?? []).reduce((sum, x) => sum + Math.max(0, x.saldoCentavos), 0));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-base font-semibold mb-3">Meus pets</h2>
        {pets.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500">Nenhum pet cadastrado ainda.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pets.map((pet) => (
              <Link key={pet.id} href={`/portal/pets/${pet.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <div className="flex flex-col items-center text-center gap-2">
                    {pet.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pet.fotoUrl} alt={pet.nome} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-[#15203c] grid place-items-center">
                        <i className="ri-bear-smile-line text-2xl text-primary-500"></i>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{pet.nome}</p>
                      <p className="text-xs text-gray-500">{[pet.especie, pet.raca].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">Próximos agendamentos</h2>
            <Link href="/portal/agendamentos" className="text-xs text-primary-500">
              ver todos
            </Link>
          </div>
          {proximos.length === 0 ? (
            <p className="text-sm text-gray-500">Nada agendado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximos.map((a) => (
                <li key={a.id} className="text-sm flex justify-between gap-2">
                  <span className="text-black dark:text-white">
                    {a.titulo}
                    {a.petNome ? ` · ${a.petNome}` : ''}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap">{formatData(a.inicio)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold mb-2">Financeiro</h2>
          {devedor > 0 ? (
            <>
              <p className="text-sm text-gray-500">Em aberto</p>
              <p className="text-2xl font-semibold text-amber-600">{formatCentavos(devedor)}</p>
            </>
          ) : (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <i className="ri-checkbox-circle-line"></i> Sem pendências.
            </p>
          )}
          <Link href="/portal/faturas" className="text-xs text-primary-500 mt-2 inline-block">
            ver faturas
          </Link>
        </Card>
      </section>
    </div>
  );
}
