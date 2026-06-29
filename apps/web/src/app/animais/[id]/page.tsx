'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
  fotoUrl?: string | null;
}
interface Evento {
  id: string;
  tipo: string;
  descricao: string;
  valorCentavos?: number | null;
  data: string;
}
interface Fatura {
  id: string;
  status: string;
  totalCentavos: number;
  itens: { id: string; descricao: string; valorCentavos: number }[];
}

const TIPOS = ['atendimento', 'peso', 'vacina', 'exame', 'receita', 'observacao', 'internacao'] as const;
type Tipo = (typeof TIPOS)[number];
const ICONE: Record<string, string> = {
  atendimento: 'ri-stethoscope-line',
  peso: 'ri-scales-3-line',
  vacina: 'ri-syringe-line',
  exame: 'ri-test-tube-line',
  receita: 'ri-file-list-3-line',
  observacao: 'ri-sticky-note-line',
  internacao: 'ri-hospital-line',
};

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ProntuarioPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<Tipo>('atendimento');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [faturar, setFaturar] = useState(true);

  const [editAnimal, setEditAnimal] = useState(false);
  const [aForm, setAForm] = useState<{ nome: string; especie: string; raca: string; sexo: '' | 'M' | 'F'; castrado: boolean; status: 'vivo' | 'falecido' }>({
    nome: '',
    especie: '',
    raca: '',
    sexo: '',
    castrado: false,
    status: 'vivo',
  });
  const [saving, setSaving] = useState(false);

  const loadFatura = useCallback(async (responsavelId: string) => {
    const { data } = await api.GET('/api/clientes/{id}/fatura', { params: { path: { id: responsavelId } } });
    setFatura((data as Fatura) ?? null);
  }, []);

  const load = useCallback(async () => {
    const [a, e] = await Promise.all([
      api.GET('/api/animais/{id}', { params: { path: { id } } }),
      api.GET('/api/animais/{id}/eventos', { params: { path: { id } } }),
    ]);
    const an = (a.data as Animal) ?? null;
    setAnimal(an);
    if (an) {
      setAForm({
        nome: an.nome,
        especie: an.especie ?? '',
        raca: an.raca ?? '',
        sexo: (an.sexo as '' | 'M' | 'F') ?? '',
        castrado: an.castrado,
        status: (an.status as 'vivo' | 'falecido') ?? 'vivo',
      });
    }
    setEventos((e.data as Evento[]) ?? []);
    if (an) await loadFatura(an.responsavelId);
    setLoading(false);
  }, [id, loadFatura]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddEvento(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const valorCentavos = valor ? Math.round(parseFloat(valor.replace(',', '.')) * 100) : undefined;
    const { data } = await api.POST('/api/animais/{id}/eventos', {
      params: { path: { id } },
      body: { tipo, descricao, valorCentavos, faturar },
    });
    setSaving(false);
    if (data) {
      setDescricao('');
      setValor('');
      setShowForm(false);
      await load();
    }
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sign = await api.POST('/api/animais/{id}/foto/sign-upload', {
        params: { path: { id } },
        body: { contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' },
      });
      if (!sign.data) throw new Error('sign falhou');
      const put = await fetch(sign.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!put.ok) throw new Error('upload falhou');
      await api.POST('/api/animais/{id}/foto', { params: { path: { id } }, body: { key: sign.data.key } });
      await load();
    } catch {
      alert('Falha no upload da foto. Verifique se o storage (R2/MinIO) e o CORS estão configurados.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onSaveAnimal(e: FormEvent) {
    e.preventDefault();
    await api.PATCH('/api/animais/{id}', {
      params: { path: { id } },
      body: {
        nome: aForm.nome,
        especie: aForm.especie || undefined,
        raca: aForm.raca || undefined,
        sexo: aForm.sexo || undefined,
        castrado: aForm.castrado,
        status: aForm.status,
      },
    });
    setEditAnimal(false);
    await load();
  }

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

      <Card>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative w-16 h-16 rounded-full overflow-hidden bg-primary-50 text-primary-500 grid place-items-center group"
            title="Trocar foto"
            aria-label="Trocar foto"
          >
            {animal.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={animal.fotoUrl} alt={animal.nome} className="w-full h-full object-cover" />
            ) : (
              <i className="ri-bear-smile-line text-3xl"></i>
            )}
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white">
              <i className={`text-xl ${uploading ? 'ri-loader-4-line animate-spin' : 'ri-camera-line'}`}></i>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickFoto} />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-black dark:text-white">{animal.nome}</h1>
            <p className="text-sm text-gray-500">
              {[animal.especie, animal.raca, animal.sexo, animal.castrado ? 'Castrado' : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditAnimal((v) => !v)}>
              <i className="ri-edit-line"></i> Editar
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>
              <i className="ri-add-line"></i> Registrar evento
            </Button>
          </div>
        </div>

        {editAnimal && (
          <form onSubmit={onSaveAnimal} className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Nome</span>
              <input required value={aForm.nome} onChange={(e) => setAForm({ ...aForm, nome: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Espécie</span>
              <input value={aForm.especie} onChange={(e) => setAForm({ ...aForm, especie: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Raça</span>
              <input value={aForm.raca} onChange={(e) => setAForm({ ...aForm, raca: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Sexo</span>
              <select value={aForm.sexo} onChange={(e) => setAForm({ ...aForm, sexo: e.target.value as '' | 'M' | 'F' })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500">
                <option value="">—</option>
                <option value="M">Macho</option>
                <option value="F">Fêmea</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Situação</span>
              <select value={aForm.status} onChange={(e) => setAForm({ ...aForm, status: e.target.value as 'vivo' | 'falecido' })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500">
                <option value="vivo">Vivo</option>
                <option value="falecido">Falecido</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={aForm.castrado} onChange={(e) => setAForm({ ...aForm, castrado: e.target.checked })} />
              <span className="text-gray-600 dark:text-gray-300">Castrado</span>
            </label>
            <div className="md:col-span-3 flex gap-2">
              <Button type="submit"><i className="ri-save-line"></i> Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setEditAnimal(false)}>Cancelar</Button>
            </div>
          </form>
        )}

        {showForm && (
          <form onSubmit={onAddEvento} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Tipo</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Tipo)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500 capitalize"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Valor (R$) — opcional</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="150,00"
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Descrição</span>
              <input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={faturar} onChange={(e) => setFaturar(e.target.checked)} />
              <span className="text-gray-600 dark:text-gray-300">Lançar na fatura do cliente (faturamento automático)</span>
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar evento'}</Button>
            </div>
          </form>
        )}
      </Card>

      {/* Fatura em aberto (faturamento acoplado) */}
      {fatura && fatura.itens.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-black dark:text-white">Fatura em aberto</h2>
            <span className="text-lg font-bold text-primary-600">{brl(fatura.totalCentavos)}</span>
          </div>
          <ul className="mt-3 divide-y divide-gray-50 dark:divide-[#172036]/50 text-sm">
            {fatura.itens.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-300">{i.descricao}</span>
                <span className="text-black dark:text-white">{brl(i.valorCentavos)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Linha do tempo */}
      <Card>
        <h2 className="text-base font-semibold text-black dark:text-white mb-4">Linha do tempo</h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-gray-400">Sem eventos registrados ainda.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {eventos.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <span className="inline-grid place-items-center w-9 h-9 rounded-full bg-primary-50 text-primary-500 shrink-0">
                  <i className={ICONE[ev.tipo] ?? 'ri-circle-line'}></i>
                </span>
                <div className="flex-1 border-b border-gray-50 dark:border-[#172036]/50 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-black dark:text-white capitalize">{ev.tipo}</p>
                    {ev.valorCentavos ? (
                      <span className="text-sm text-primary-600">{brl(ev.valorCentavos)}</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500">{ev.descricao}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ev.data).toLocaleString('pt-BR')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
