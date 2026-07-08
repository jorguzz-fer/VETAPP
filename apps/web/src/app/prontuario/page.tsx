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

interface Internado {
  id: string;
  animalId: string;
  animalNome: string;
  responsavelNome: string;
  box: string | null;
  entradaEm: string;
  pendentes: number;
  fotoUrl: string | null;
}

const inputCls =
  'w-full rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

// Tempo internado em dias (curto), a partir da entrada.
function diasInternado(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return dias <= 0 ? 'hoje' : dias === 1 ? '1 dia' : `${dias} dias`;
}

// Prontuário = histórico do paciente (doc 16 §7). A entrada mostra os pacientes
// INTERNADOS em cards (atendimento contínuo) e uma busca para abrir a ficha de
// qualquer paciente (atendimento porta / histórico). A ficha completa fica em
// /animais/[id] (linha do tempo).
export default function ProntuarioPage() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<BuscaAnimal[]>([]);
  const [internados, setInternados] = useState<Internado[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const { data } = await api.GET('/api/animais', { params: { query: { search: q || undefined } } });
    setItems((data as BuscaAnimal[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void api.GET('/api/internacoes', { params: { query: { status: 'internado' } } }).then(({ data }) => {
      setInternados((data as Internado[]) ?? []);
    });
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
        <p className="text-sm text-gray-500">
          Pacientes internados em atendimento e histórico completo por paciente.
        </p>
      </div>

      {/* Internados (atendimento contínuo) — cards no topo (doc 16 PR2/PR4). */}
      {internados.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-black dark:text-white mb-3">
            Internados <span className="text-sm font-normal text-gray-400">({internados.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {internados.map((i) => (
              <Link
                key={i.id}
                href={`/animais/${i.animalId}`}
                className="rounded-lg border border-gray-100 dark:border-[#172036] bg-white dark:bg-[#0c1427] p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full overflow-hidden bg-primary-50 text-primary-500 grid place-items-center shrink-0">
                    {i.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.fotoUrl} alt={i.animalNome} className="w-full h-full object-cover" />
                    ) : (
                      <i className="ri-bear-smile-line text-2xl"></i>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-black dark:text-white truncate">{i.animalNome}</p>
                    <p className="text-xs text-gray-500 truncate">{i.responsavelNome}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    <i className="ri-time-line"></i> {diasInternado(i.entradaEm)}
                    {i.box && <> · {i.box}</>}
                  </span>
                  {i.pendentes > 0 ? (
                    <span className="rounded-full px-2 py-0.5 bg-amber-50 text-amber-600">
                      <i className="ri-syringe-line"></i> {i.pendentes}
                    </span>
                  ) : (
                    <span className="text-green-600"><i className="ri-check-line"></i></span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Busca de qualquer paciente → ficha/histórico (atendimento porta). */}
      <Card>
        <h2 className="text-base font-semibold text-black dark:text-white mb-3">Todos os pacientes</h2>
        <div className="relative mb-4">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
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
            {search ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda.'}
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
                      {a.status === 'falecido' && <span className="ml-2 text-xs text-gray-400">(falecido)</span>}
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
