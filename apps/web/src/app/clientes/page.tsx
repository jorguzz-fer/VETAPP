'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Responsavel {
  id: string;
  nome: string;
  codigo?: string | null;
  email?: string | null;
  telefone?: string | null;
}

const PAGE_SIZE = 20;

export default function ClientesPage() {
  const [items, setItems] = useState<Responsavel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/clientes', {
      params: { query: { search: search || undefined, page, pageSize: PAGE_SIZE } },
    });
    setItems(data?.items ?? []);
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Volta para a página 1 ao mudar a busca.
  useEffect(() => {
    setPage(1);
  }, [search]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await api.POST('/api/clientes', { body: { nome, telefone: telefone || undefined } });
    setSaving(false);
    if (data) {
      setNome('');
      setTelefone('');
      setShowForm(false);
      void load();
    }
  }

  async function onDelete(id: string, nomeCliente: string) {
    if (!confirm(`Excluir "${nomeCliente}" e todos os seus animais? Esta ação não pode ser desfeita.`)) return;
    await api.DELETE('/api/clientes/{id}', { params: { path: { id } } });
    void load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Clientes & Animais</h1>
          <p className="text-sm text-gray-500">{total} responsáveis cadastrados</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line"></i> Novo cliente
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
                placeholder="Nome do responsável"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm flex-1">
              <span className="text-gray-600 dark:text-gray-300">Telefone</span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
                placeholder="+55 ..."
              />
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#15203c] rounded-md px-3 py-2 mb-4 max-w-[400px]">
          <i className="ri-search-line text-gray-400"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="bg-transparent outline-none text-sm w-full text-black dark:text-white"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cliente encontrado.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                  <th className="py-2 font-medium">Nome</th>
                  <th className="py-2 font-medium">Telefone</th>
                  <th className="py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-[#172036]/50">
                    <td className="py-2.5 text-black dark:text-white">{r.nome}</td>
                    <td className="py-2.5 text-gray-500">{r.telefone ?? '—'}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <Link href={`/clientes/${r.id}`} className="text-primary-500 hover:underline">Abrir ficha</Link>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id, r.nome)}
                        className="ml-3 text-gray-400 hover:text-red-500"
                        title="Excluir"
                        aria-label="Excluir"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <i className="ri-arrow-left-s-line"></i> Anterior
                </Button>
                <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Próxima <i className="ri-arrow-right-s-line"></i>
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
