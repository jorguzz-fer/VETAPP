'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Animal {
  id: string;
  responsavelId: string;
  nome: string;
  especie?: string | null;
  raca?: string | null;
  sexo?: string | null;
  castrado: boolean;
  status: string;
}

// Ações rápidas do prontuário (docs/spec/05 §2.3). Desabilitadas no scaffold —
// entram nas próximas iterações (atendimento, peso, vacina, exame…).
const ACOES = [
  { label: 'Atendimento', icon: 'ri-stethoscope-line' },
  { label: 'Peso', icon: 'ri-scales-3-line' },
  { label: 'Vacina', icon: 'ri-syringe-line' },
  { label: 'Exame', icon: 'ri-test-tube-line' },
  { label: 'Receita', icon: 'ri-file-list-3-line' },
  { label: 'Internação', icon: 'ri-hospital-line' },
];

export default function ProntuarioPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await api.GET('/api/animais/{id}', { params: { path: { id } } });
      setAnimal((data as Animal) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (!animal) return <p className="text-sm text-gray-500">Animal não encontrado.</p>;

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/clientes" className="hover:text-primary-500">Clientes</Link>
        <i className="ri-arrow-right-s-line"></i>
        <Link href={`/clientes/${animal.responsavelId}`} className="hover:text-primary-500">Ficha</Link>
        <i className="ri-arrow-right-s-line"></i>
        <span className="text-black dark:text-white">Prontuário</span>
      </div>

      {/* Cabeçalho do prontuário */}
      <Card>
        <div className="flex items-center gap-4">
          <span className="inline-grid place-items-center w-16 h-16 rounded-full bg-primary-50 text-primary-500">
            <i className="ri-bear-smile-line text-3xl"></i>
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-black dark:text-white">{animal.nome}</h1>
            <p className="text-sm text-gray-500">
              {[animal.especie, animal.raca, animal.sexo, animal.castrado ? 'Castrado' : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
          <span className="text-xs rounded-full px-3 py-1 bg-primary-50 text-primary-700 capitalize">
            {animal.status}
          </span>
        </div>

        {/* Ações rápidas (scaffold: desabilitadas) */}
        <div className="flex flex-wrap gap-2 mt-5">
          {ACOES.map((a) => (
            <Button key={a.label} variant="ghost" disabled title="Em breve">
              <i className={a.icon}></i> {a.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Linha do tempo (placeholder) */}
      <Card>
        <h2 className="text-base font-semibold text-black dark:text-white mb-1">Linha do tempo</h2>
        <p className="text-sm text-gray-500">
          O histórico clínico (atendimentos, vacinas, peso, exames…) aparecerá aqui. Esta é a tela
          central do produto (docs/spec/05 §2.3) — o registro de eventos entra nas próximas
          iterações, com faturamento acoplado a cada ação.
        </p>
        <div className="mt-4 border-l-2 border-dashed border-gray-200 dark:border-[#172036] pl-4 text-sm text-gray-400">
          Sem eventos registrados ainda.
        </div>
      </Card>
    </div>
  );
}
