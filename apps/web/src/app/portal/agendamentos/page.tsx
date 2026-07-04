'use client';

import { useEffect, useState } from 'react';
import { portalApi } from '@/lib/portalApi';
import { Card } from '@/components/ui/Card';

type Agendamento = {
  id: string;
  titulo: string;
  petNome: string | null;
  tipoNome: string | null;
  profissionalNome: string | null;
  inicio: string;
  fim: string;
  status: string;
};

const STATUS_STYLE: Record<string, string> = {
  agendado: 'bg-blue-50 text-blue-600',
  concluido: 'bg-green-50 text-green-600',
  cancelado: 'bg-gray-100 dark:bg-[#15203c] text-gray-500 line-through',
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PortalAgendamentos() {
  const [items, setItems] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await portalApi.GET('/api/portal/agendamentos');
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;

  const now = Date.now();
  const futuros = items.filter((a) => new Date(a.inicio).getTime() >= now && a.status !== 'cancelado');
  const passados = items.filter((a) => new Date(a.inicio).getTime() < now || a.status === 'cancelado');

  const Linha = (a: Agendamento) => (
    <li key={a.id} className="py-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-black dark:text-white">
          {a.tipoNome ?? a.titulo}
          {a.petNome ? ` · ${a.petNome}` : ''}
        </p>
        <p className="text-xs text-gray-500">
          {formatData(a.inicio)}
          {a.profissionalNome ? ` · ${a.profissionalNome}` : ''}
        </p>
      </div>
      <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLE[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
        {a.status}
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Agendamentos</h1>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Próximos</h2>
        <Card>
          {futuros.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum agendamento futuro.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#172036]">{futuros.map(Linha)}</ul>
          )}
        </Card>
      </section>

      {passados.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Anteriores</h2>
          <Card>
            <ul className="divide-y divide-gray-100 dark:divide-[#172036]">{passados.map(Linha)}</ul>
          </Card>
        </section>
      )}

      <p className="text-xs text-gray-400 text-center">
        Para marcar ou remarcar, fale com a clínica. O agendamento online chega em breve.
      </p>
    </div>
  );
}
