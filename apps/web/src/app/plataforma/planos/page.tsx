'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { platformApi, brl } from '@/lib/platformApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Plano {
  id: string;
  nome: string;
  slug: string;
  precoCentavos: number;
  ciclo: string;
  ativo: string;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 text-sm outline-none focus:border-primary-500';

export default function PlataformaPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nome: '', slug: '', preco: '', ciclo: 'mensal' as 'mensal' | 'anual' });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await platformApi.GET('/api/platform/planos');
    setPlanos((data as Plano[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await platformApi.POST('/api/platform/planos', {
      body: {
        nome: form.nome,
        slug: form.slug,
        precoCentavos: Math.round(parseFloat(form.preco.replace(',', '.') || '0') * 100),
        ciclo: form.ciclo,
      },
    });
    setBusy(false);
    if (error) {
      setErr('Falha ao criar (slug repetido?).');
      return;
    }
    setForm({ nome: '', slug: '', preco: '', ciclo: 'mensal' });
    void load();
  }

  async function editarPreco(p: Plano) {
    const entrada = prompt(`Novo preço de "${p.nome}" (R$):`, (p.precoCentavos / 100).toFixed(2).replace('.', ','));
    if (entrada == null) return;
    const centavos = Math.round(parseFloat(entrada.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos < 0) return;
    setBusy(true);
    await platformApi.PUT('/api/platform/planos/{id}', { params: { path: { id: p.id } }, body: { precoCentavos: centavos } });
    setBusy(false);
    void load();
  }

  async function alternarAtivo(p: Plano) {
    setBusy(true);
    await platformApi.PUT('/api/platform/planos/{id}', {
      params: { path: { id: p.id } },
      body: { ativo: p.ativo === 'true' ? 'false' : 'true' },
    });
    setBusy(false);
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Planos</h1>
        <p className="text-sm text-gray-500">Catálogo de planos do SaaS.</p>
      </div>

      <Card>
        <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-5 gap-3 md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Nome</span>
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Slug</span>
            <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputCls} placeholder="essencial" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Preço (R$)</span>
            <input required value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} inputMode="decimal" className={inputCls} placeholder="149,00" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Ciclo</span>
            <select value={form.ciclo} onChange={(e) => setForm({ ...form, ciclo: e.target.value as 'mensal' | 'anual' })} className={inputCls}>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </select>
          </label>
          <Button type="submit" disabled={busy}>Adicionar</Button>
        </form>
        {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
      </Card>

      <Card>
        {loading ? (
          <p className="text-sm text-gray-500 py-6 text-center">Carregando…</p>
        ) : planos.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhum plano.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 pr-4 font-medium">Nome</th>
                <th className="py-2 pr-4 font-medium">Slug</th>
                <th className="py-2 pr-4 font-medium text-right">Preço</th>
                <th className="py-2 pr-4 font-medium">Ciclo</th>
                <th className="py-2 pr-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr key={p.id} className={`border-b border-gray-50 dark:border-[#172036]/50 ${p.ativo === 'false' ? 'opacity-50' : ''}`}>
                  <td className="py-2.5 pr-4">{p.nome}</td>
                  <td className="py-2.5 pr-4 font-mono text-gray-500">{p.slug}</td>
                  <td className="py-2.5 pr-4 text-right">{brl(p.precoCentavos)}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{p.ciclo}</td>
                  <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                    <button disabled={busy} onClick={() => editarPreco(p)} className="text-primary-600 hover:underline text-xs mr-3">Preço</button>
                    <button disabled={busy} onClick={() => alternarAtivo(p)} className="text-gray-500 hover:underline text-xs">
                      {p.ativo === 'false' ? 'Ativar' : 'Desativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
