'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';

interface BuscaAnimal {
  id: string;
  nome: string;
  especie?: string | null;
  raca?: string | null;
  status: string;
  responsavelId: string;
  responsavelNome: string;
}

const inputCls =
  'w-full rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

export default function ProntuarioPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<BuscaAnimal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const { data } = await api.GET('/api/animais', { params: { query: { search: q || undefined } } });
    setItems((data as BuscaAnimal[]) ?? []);
    setLoading(false);
  }, []);

  // Debounce: busca 250ms após parar de digitar (evita uma chamada por tecla).
  useEffect(() => {
    const t = setTimeout(() => void load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div className="flex flex-col gap-[25px]">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">Prontuário</h1>
        <p className="text-sm text-gray-500">Busque o paciente pelo nome do animal ou do tutor para abrir a ficha.</p>
      </div>

      <Card>
        <div className="relative mb-4">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do animal, tutor ou telefone…"
            className={`${inputCls} pl-9`}
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">
            {search ? 'Nenhum paciente encontrado.' : 'Nenhum animal cadastrado ainda.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036]">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/animais/${a.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 dark:hover:bg-[#15203c] -mx-2 px-2 rounded-md"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black dark:text-white truncate">
                      {a.nome}
                      {a.status === 'falecido' && (
                        <span className="ml-2 text-xs text-gray-400">(falecido)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {[a.especie, a.raca].filter(Boolean).join(' · ') || 'Sem espécie'} · Tutor: {a.responsavelNome}
                    </p>
                  </div>
                  <span className="text-sm text-primary-500 whitespace-nowrap">
                    Abrir <i className="ri-arrow-right-s-line"></i>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
