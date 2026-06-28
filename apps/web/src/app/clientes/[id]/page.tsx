'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Animal {
  id: string;
  nome: string;
  especie?: string | null;
  raca?: string | null;
  status: string;
}
interface Ficha {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
  origem?: string | null;
  animais: Animal[];
}

export default function FichaClientePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [especie, setEspecie] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/clientes/{id}', { params: { path: { id } } });
    setFicha((data as Ficha) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddAnimal(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await api.POST('/api/clientes/{id}/animais', {
      params: { path: { id } },
      body: { nome, especie: especie || undefined },
    });
    setSaving(false);
    if (data) {
      setNome('');
      setEspecie('');
      setShowForm(false);
      void load();
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (!ficha) return <p className="text-sm text-gray-500">Cliente não encontrado.</p>;

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/clientes" className="hover:text-primary-500">Clientes</Link>
        <i className="ri-arrow-right-s-line"></i>
        <span className="text-black dark:text-white">{ficha.nome}</span>
      </div>

      <Card>
        <h1 className="text-lg font-semibold text-black dark:text-white">{ficha.nome}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
          <Info label="Telefone" value={ficha.telefone} />
          <Info label="E-mail" value={ficha.email} />
          <Info label="Documento" value={ficha.documento} />
          <Info label="Como nos conheceu?" value={ficha.origem} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-black dark:text-white">Animais</h2>
          <Button variant="ghost" onClick={() => setShowForm((v) => !v)}>
            <i className="ri-add-line"></i> Adicionar animal
          </Button>
        </div>

        {showForm && (
          <form onSubmit={onAddAnimal} className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Espécie</span>
              <input
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
                placeholder="Canina, Felina…"
              />
            </label>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </form>
        )}

        {ficha.animais.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum animal cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ficha.animais.map((a) => (
              <Link
                key={a.id}
                href={`/animais/${a.id}`}
                className="flex items-center gap-3 rounded-md border border-gray-100 dark:border-[#172036] p-3 hover:border-primary-500 transition-all"
              >
                <span className="inline-grid place-items-center w-10 h-10 rounded-full bg-primary-50 text-primary-500">
                  <i className="ri-bear-smile-line text-xl"></i>
                </span>
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{a.nome}</p>
                  <p className="text-xs text-gray-500">
                    {[a.especie, a.raca].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="text-black dark:text-white">{value || '—'}</p>
    </div>
  );
}
