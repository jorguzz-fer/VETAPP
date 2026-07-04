'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

export default function FichaClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', documento: '', origem: '' });

  const [showAnimal, setShowAnimal] = useState(false);
  const [nome, setNome] = useState('');
  const [especie, setEspecie] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/clientes/{id}', { params: { path: { id } } });
    const f = (data as Ficha) ?? null;
    setFicha(f);
    if (f) setForm({ nome: f.nome, telefone: f.telefone ?? '', email: f.email ?? '', documento: f.documento ?? '', origem: f.origem ?? '' });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await api.PATCH('/api/clientes/{id}', { params: { path: { id } }, body: form });
    setSaving(false);
    if (data) {
      setEditing(false);
      void load();
    }
  }

  async function onNovoOrcamento() {
    const obs = prompt('Novo orçamento — observações (opcional):');
    if (obs === null) return;
    const { error } = await api.POST('/api/orcamentos', {
      body: { responsavelId: id, observacoes: obs || undefined },
    });
    if (error) {
      alert('Não foi possível criar o orçamento.');
      return;
    }
    router.push('/orcamentos');
  }

  async function onDeleteCliente() {
    if (!ficha) return;
    if (!confirm(`Excluir "${ficha.nome}" e todos os seus animais?`)) return;
    await api.DELETE('/api/clientes/{id}', { params: { path: { id } } });
    router.push('/clientes');
  }

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
      setShowAnimal(false);
      void load();
    }
  }

  async function onDeleteAnimal(animalId: string, animalNome: string) {
    if (!confirm(`Excluir o animal "${animalNome}"?`)) return;
    await api.DELETE('/api/animais/{id}', { params: { path: { id: animalId } } });
    void load();
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
        {editing ? (
          <form onSubmit={onSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Telefone</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">E-mail</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Documento</span>
              <input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Como nos conheceu?</span>
              <input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} className={inputCls} />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <h1 className="text-lg font-semibold text-black dark:text-white">{ficha.nome}</h1>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onNovoOrcamento}><i className="ri-file-list-3-line"></i> Orçamento</Button>
                <Button variant="ghost" onClick={() => setEditing(true)}><i className="ri-edit-line"></i> Editar</Button>
                <button type="button" onClick={onDeleteCliente} className="text-gray-400 hover:text-red-500 px-2" title="Excluir cliente">
                  <i className="ri-delete-bin-line text-lg"></i>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
              <Info label="Telefone" value={ficha.telefone} />
              <Info label="E-mail" value={ficha.email} />
              <Info label="Documento" value={ficha.documento} />
              <Info label="Como nos conheceu?" value={ficha.origem} />
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-black dark:text-white">Animais</h2>
          <Button variant="ghost" onClick={() => setShowAnimal((v) => !v)}>
            <i className="ri-add-line"></i> Adicionar animal
          </Button>
        </div>

        {showAnimal && (
          <form onSubmit={onAddAnimal} className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Espécie</span>
              <input value={especie} onChange={(e) => setEspecie(e.target.value)} className={inputCls} placeholder="Canina, Felina…" />
            </label>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </form>
        )}

        {ficha.animais.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum animal cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ficha.animais.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border border-gray-100 dark:border-[#172036] p-3">
                <Link href={`/animais/${a.id}`} className="flex items-center gap-3 flex-1 hover:opacity-80">
                  <span className="inline-grid place-items-center w-10 h-10 rounded-full bg-primary-50 text-primary-500">
                    <i className="ri-bear-smile-line text-xl"></i>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white">{a.nome}</p>
                    <p className="text-xs text-gray-500">{[a.especie, a.raca].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                </Link>
                <button type="button" onClick={() => onDeleteAnimal(a.id, a.nome)} className="text-gray-400 hover:text-red-500" title="Excluir animal" aria-label="Excluir animal">
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
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
