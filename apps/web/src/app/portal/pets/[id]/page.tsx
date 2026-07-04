'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { portalApi } from '@/lib/portalApi';
import { Card } from '@/components/ui/Card';

type Pet = {
  id: string;
  nome: string;
  especie: string | null;
  raca: string | null;
  sexo: string | null;
  castrado: boolean;
  nascimento: string | null;
  status: string;
  fotoUrl: string | null;
};
type Vacina = { id: string; descricao: string; data: string };
type Historico = { id: string; tipo: string; descricao: string; data: string };

const TIPO_ICON: Record<string, string> = {
  atendimento: 'ri-stethoscope-line',
  vacina: 'ri-syringe-line',
  exame: 'ri-microscope-line',
  receita: 'ri-capsule-line',
  internacao: 'ri-hospital-line',
  peso: 'ri-scales-3-line',
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PetDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pet, setPet] = useState<Pet | null>(null);
  const [vacinas, setVacinas] = useState<Vacina[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await portalApi.GET('/api/portal/pets/{id}', { params: { path: { id } } });
      if (error || !data) {
        setNotFound(true);
      } else {
        setPet(data.pet);
        setVacinas(data.vacinas);
        setHistorico(data.historico);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (notFound || !pet)
    return (
      <div>
        <Link href="/portal" className="text-sm text-primary-500">
          ← voltar
        </Link>
        <p className="text-sm text-gray-500 mt-4">Pet não encontrado.</p>
      </div>
    );

  const idade = pet.nascimento
    ? `${Math.max(0, Math.floor((Date.now() - new Date(pet.nascimento).getTime()) / (365.25 * 864e5)))} ano(s)`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/portal" className="text-sm text-primary-500">
        ← voltar
      </Link>

      <Card>
        <div className="flex items-center gap-4">
          {pet.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.fotoUrl} alt={pet.nome} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-50 dark:bg-[#15203c] grid place-items-center">
              <i className="ri-bear-smile-line text-3xl text-primary-500"></i>
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{pet.nome}</h1>
            <p className="text-sm text-gray-500">
              {[pet.especie, pet.raca, pet.sexo === 'M' ? 'Macho' : pet.sexo === 'F' ? 'Fêmea' : null, idade]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            {pet.castrado && <span className="text-xs text-gray-400">castrado</span>}
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-base font-semibold mb-3">
          <i className="ri-syringe-line mr-1 text-primary-500"></i> Vacinas
        </h2>
        <Card>
          {vacinas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma vacina registrada.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036]">
              {vacinas.map((v) => (
                <li key={v.id} className="py-2 flex justify-between text-sm">
                  <span>{v.descricao}</span>
                  <span className="text-gray-500">{formatData(v.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Histórico</h2>
        <Card>
          {historico.length === 0 ? (
            <p className="text-sm text-gray-500">Sem registros.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {historico.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <i className={`${TIPO_ICON[h.tipo] ?? 'ri-file-list-line'} text-primary-500 mt-0.5`}></i>
                  <div className="flex-1">
                    <p className="text-black dark:text-white">{h.descricao}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {h.tipo} · {formatData(h.data)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
