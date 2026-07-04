'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TipoAtendimento {
  id: string;
  nome: string;
  duracaoMinutos: number;
  cor: string | null;
  ativo: boolean;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

// Cadastros de apoio (doc 05 §8). Fase 1: tipos de atendimento (§8.5).
// Espécies/raças/patologias via base externa e modelos de receita/documento → fase 2.
export default function CadastrosPage() {
  const [tipos, setTipos] = useState<TipoAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ nome: string; duracao: string; cor: string }>({
    nome: '',
    duracao: '30',
    cor: '#7c5cff',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/agenda/tipos', { params: { query: { incluirInativos: true } } });
    setTipos((data as TipoAtendimento[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error: err } = await api.POST('/api/agenda/tipos', {
      body: {
        nome: form.nome,
        duracaoMinutos: parseInt(form.duracao || '30', 10),
        cor: form.cor || undefined,
      },
    });
    setSaving(false);
    if (err) {
      setError('Não foi possível salvar (nome já em uso?).');
      return;
    }
    setForm({ nome: '', duracao: '30', cor: '#7c5cff' });
    setShowForm(false);
    void load();
  }

  async function onToggleAtivo(t: TipoAtendimento) {
    await api.PATCH('/api/agenda/tipos/{id}', { params: { path: { id: t.id } }, body: { ativo: !t.ativo } });
    void load();
  }

  async function onEditDuracao(t: TipoAtendimento) {
    const val = prompt(`Duração de "${t.nome}" (minutos):`, String(t.duracaoMinutos));
    if (val == null) return;
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 5) return;
    await api.PATCH('/api/agenda/tipos/{id}', { params: { path: { id: t.id } }, body: { duracaoMinutos: n } });
    void load();
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Cadastros</h1>
          <p className="text-sm text-gray-500">
            Cadastros de apoio da clínica. Produtos/serviços ficam na Tabela de preços.
          </p>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-black dark:text-white">Tipos de atendimento</h2>
            <p className="text-xs text-gray-500">Duração padrão e cor dos eventos na agenda.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <i className="ri-add-line"></i> Novo tipo
          </Button>
        </div>

        {showForm && (
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end mb-4">
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} placeholder="Consulta" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Duração (min)</span>
              <input required value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} inputMode="numeric" className={inputCls} />
            </label>
            <div className="flex gap-2 items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Cor</span>
                <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-[42px] w-14 rounded-md border border-gray-200 dark:border-[#172036] bg-transparent" />
              </label>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
            </div>
            {error && <p className="text-sm text-red-500 md:col-span-4">{error}</p>}
          </form>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : tipos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum tipo cadastrado — crie &quot;Consulta&quot;, &quot;Vacina&quot;, &quot;Cirurgia&quot;…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Nome</th>
                <th className="py-2 font-medium">Duração</th>
                <th className="py-2 font-medium">Cor</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className={`border-b border-gray-50 dark:border-[#172036]/50 ${t.ativo ? '' : 'opacity-50'}`}>
                  <td className="py-2.5 text-black dark:text-white">{t.nome}</td>
                  <td className="py-2.5 text-gray-500">
                    <button type="button" onClick={() => onEditDuracao(t)} className="hover:text-primary-500" title="Editar duração">
                      {t.duracaoMinutos} min
                    </button>
                  </td>
                  <td className="py-2.5">
                    {t.cor ? (
                      <span className="inline-block w-5 h-5 rounded-full border border-gray-200 dark:border-[#172036]" style={{ backgroundColor: t.cor }} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleAtivo(t)}
                      className={`${t.ativo ? 'text-green-500' : 'text-gray-400'} hover:opacity-70`}
                      title={t.ativo ? 'Desativar' : 'Ativar'}
                      aria-label={t.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <i className={t.ativo ? 'ri-toggle-fill text-xl' : 'ri-toggle-line text-xl'}></i>
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
