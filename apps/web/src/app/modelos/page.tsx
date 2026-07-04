'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Modelo {
  id: string;
  tipo: string;
  nome: string;
  conteudo: string;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

type TipoModelo = 'receita' | 'documento';
const emptyForm = { tipo: 'documento' as TipoModelo, nome: '', conteudo: '' };

export default function ModelosPage() {
  const [items, setItems] = useState<Modelo[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/api/modelos', { params: { query: {} } });
    setItems((data as Modelo[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function editar(m: Modelo) {
    setEditId(m.id);
    setForm({ tipo: m.tipo as TipoModelo, nome: m.nome, conteudo: m.conteudo });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function novo() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editId) {
      await api.PATCH('/api/modelos/{id}', { params: { path: { id: editId } }, body: form });
    } else {
      await api.POST('/api/modelos', { body: { tipo: form.tipo, nome: form.nome, conteudo: form.conteudo } });
    }
    setSaving(false);
    novo();
    void load();
  }

  async function remover(id: string) {
    if (!confirm('Excluir este modelo?')) return;
    await api.DELETE('/api/modelos/{id}', { params: { path: { id } } });
    if (editId === id) novo();
    void load();
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">Modelos</h1>
        <p className="text-sm text-gray-500">
          Modelos de receita e documento. Use placeholders — preenchidos ao gerar a partir da ficha do animal.
        </p>
      </div>

      <Card>
        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Tipo</span>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoModelo })} className={inputCls}>
              <option value="documento">Documento</option>
              <option value="receita">Receita</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-3">
            <span className="text-gray-600 dark:text-gray-300">Nome</span>
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} placeholder="Ex.: Termo de internação" />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-4">
            <span className="text-gray-600 dark:text-gray-300">Conteúdo</span>
            <textarea
              required
              value={form.conteudo}
              onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              className={inputCls}
              rows={8}
              placeholder={'Ex.: Autorizo a internação de {{animal}} ({{especie}}), de responsabilidade de {{tutor}}.\nData: {{data}} — {{clinica}}'}
            />
            <span className="text-xs text-gray-400">
              Placeholders: {'{{animal}}'} {'{{especie}}'} {'{{raca}}'} {'{{tutor}}'} {'{{telefone}}'} {'{{data}}'} {'{{clinica}}'}
            </span>
          </label>
          <div className="md:col-span-4 flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editId ? 'Salvar alterações' : 'Criar modelo'}</Button>
            {editId && (
              <Button type="button" variant="ghost" onClick={novo}>
                Cancelar edição
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum modelo cadastrado ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036]">
            {items.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black dark:text-white truncate">
                    {m.nome}
                    <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-gray-100 dark:bg-[#15203c] text-gray-500 capitalize">
                      {m.tipo}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">{m.conteudo.slice(0, 120)}</p>
                </div>
                <div className="flex gap-3 whitespace-nowrap">
                  <button onClick={() => editar(m)} className="text-sm text-primary-500 hover:underline">Editar</button>
                  <button onClick={() => remover(m.id)} className="text-sm text-gray-400 hover:text-red-500" title="Excluir" aria-label="Excluir">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
