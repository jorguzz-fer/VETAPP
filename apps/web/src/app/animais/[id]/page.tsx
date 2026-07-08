'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Animal {
  id: string;
  responsavelId: string;
  nome: string;
  especie?: string | null;
  raca?: string | null;
  pelagem?: string | null;
  sexo?: string | null;
  castrado: boolean;
  microchip?: string | null;
  marcacoes?: string[];
  pedigree?: boolean;
  pedigreeNumero?: string | null;
  status: string;
  fotoUrl?: string | null;
}
interface Evento {
  id: string;
  tipo: string;
  descricao: string;
  valorCentavos?: number | null;
  data: string;
  anexoUrl?: string | null;
  registradoPorNome?: string | null;
}
interface Fatura {
  id: string;
  status: string;
  totalCentavos: number;
  itens: { id: string; descricao: string; valorCentavos: number }[];
}
interface Vacina {
  id: string;
  nome: string;
  laboratorio?: string | null;
  lote?: string | null;
  aplicadaEm: string;
  proximaEm?: string | null;
  aplicadaPorNome?: string | null;
  observacao?: string | null;
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
  const router = useRouter();
  const id = params.id;
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [filtroMedico, setFiltroMedico] = useState<string>('');
  const [vacinas, setVacinas] = useState<Vacina[]>([]);
  const [vacForm, setVacForm] = useState({ nome: '', laboratorio: '', lote: '', aplicadaEm: '', proximaEm: '' });
  const [showVacForm, setShowVacForm] = useState(false);
  const [salvandoVac, setSalvandoVac] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<Tipo>('atendimento');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [itemId, setItemId] = useState<string>('');
  const [quantidade, setQuantidade] = useState('1');
  const [faturar, setFaturar] = useState(true);
  const [anexoEvento, setAnexoEvento] = useState<File | null>(null);

  // Internação: modal com listas gerenciadas (motivo/box) — escolhe da lista ou cria.
  const [internarOpen, setInternarOpen] = useState(false);
  const [motivoInput, setMotivoInput] = useState('');
  const [boxInput, setBoxInput] = useState('');
  const [altaPrevistaInput, setAltaPrevistaInput] = useState('');
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[]>([]);
  const [boxes, setBoxes] = useState<{ id: string; nome: string }[]>([]);
  const [internando, setInternando] = useState(false);
  const [internarErr, setInternarErr] = useState<string | null>(null);

  // Gerar documento/receita a partir de um modelo.
  const [docOpen, setDocOpen] = useState(false);
  const [modelos, setModelos] = useState<{ id: string; tipo: string; nome: string }[]>([]);
  const [modeloId, setModeloId] = useState('');
  const [gerado, setGerado] = useState<{ titulo: string; conteudo: string } | null>(null);
  const [gerando, setGerando] = useState(false);

  // Itens do catálogo (tabela de preços) — selecionar preenche descrição/valor.
  const [catalogo, setCatalogo] = useState<{ id: string; codigo: string; nome: string; precoCentavos: number }[]>([]);
  useEffect(() => {
    if (!showForm || catalogo.length > 0) return;
    void api.GET('/api/catalogo', { params: { query: {} } }).then(({ data }) => {
      setCatalogo((data as typeof catalogo) ?? []);
    });
  }, [showForm, catalogo.length]);

  function onPickCatalogo(selId: string) {
    setItemId(selId);
    const item = catalogo.find((c) => c.id === selId);
    if (!item) return;
    setDescricao(`${item.nome} (cód. ${item.codigo})`);
    setValor((item.precoCentavos / 100).toFixed(2).replace('.', ','));
  }

  const [editAnimal, setEditAnimal] = useState(false);
  const [aForm, setAForm] = useState<{
    nome: string;
    especie: string;
    raca: string;
    pelagem: string;
    sexo: '' | 'M' | 'F';
    castrado: boolean;
    microchip: string;
    marcacoes: string;
    pedigree: boolean;
    pedigreeNumero: string;
    status: 'vivo' | 'falecido';
  }>({
    nome: '',
    especie: '',
    raca: '',
    pelagem: '',
    sexo: '',
    castrado: false,
    microchip: '',
    marcacoes: '',
    pedigree: false,
    pedigreeNumero: '',
    status: 'vivo',
  });
  const [saving, setSaving] = useState(false);

  const loadFatura = useCallback(async (responsavelId: string) => {
    const { data } = await api.GET('/api/clientes/{id}/fatura', { params: { path: { id: responsavelId } } });
    setFatura((data as Fatura) ?? null);
  }, []);

  const loadVacinas = useCallback(async () => {
    const { data } = await api.GET('/api/animais/{id}/vacinas', { params: { path: { id } } });
    setVacinas((data as Vacina[]) ?? []);
  }, [id]);

  async function onAddVacina(e: FormEvent) {
    e.preventDefault();
    if (!vacForm.nome.trim() || !vacForm.aplicadaEm) return;
    setSalvandoVac(true);
    const { error } = await api.POST('/api/animais/{id}/vacinas', {
      params: { path: { id } },
      body: {
        nome: vacForm.nome.trim(),
        laboratorio: vacForm.laboratorio || undefined,
        lote: vacForm.lote || undefined,
        aplicadaEm: vacForm.aplicadaEm,
        proximaEm: vacForm.proximaEm || undefined,
      },
    });
    setSalvandoVac(false);
    if (error) {
      alert('Não foi possível registrar a vacina (permissão de perfil clínico?).');
      return;
    }
    setVacForm({ nome: '', laboratorio: '', lote: '', aplicadaEm: '', proximaEm: '' });
    setShowVacForm(false);
    await Promise.all([loadVacinas(), load()]);
  }

  // Efetuar cobrança (doc 16 B3): baixa integral da comanda em aberto.
  async function onEfetuarCobranca() {
    if (!fatura || !animal) return;
    if (!confirm(`Efetuar cobrança de ${brl(fatura.totalCentavos)} e marcar a comanda como paga?`)) return;
    setCobrando(true);
    const { error } = await api.POST('/api/faturas/{id}/pagar', { params: { path: { id: fatura.id } } });
    setCobrando(false);
    if (error) {
      alert('Não foi possível efetuar a cobrança.');
      return;
    }
    await loadFatura(animal.responsavelId);
  }

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
        pelagem: an.pelagem ?? '',
        sexo: (an.sexo as '' | 'M' | 'F') ?? '',
        castrado: an.castrado,
        microchip: an.microchip ?? '',
        marcacoes: (an.marcacoes ?? []).join(', '),
        pedigree: an.pedigree ?? false,
        pedigreeNumero: an.pedigreeNumero ?? '',
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

  useEffect(() => {
    void loadVacinas();
  }, [loadVacinas]);

  async function onAddEvento(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const valorCentavos = valor ? Math.round(parseFloat(valor.replace(',', '.')) * 100) : undefined;

      // Anexo opcional: sobe primeiro ao storage e obtém a key.
      let anexoKey: string | undefined;
      if (anexoEvento) {
        const sign = await api.POST('/api/animais/{id}/prontuario/sign-upload', {
          params: { path: { id } },
          body: { contentType: anexoEvento.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | 'video/mp4' },
        });
        if (!sign.data) throw new Error('sign falhou');
        const put = await fetch(sign.data.uploadUrl, { method: 'PUT', body: anexoEvento, headers: { 'Content-Type': anexoEvento.type } });
        if (!put.ok) throw new Error('upload falhou');
        anexoKey = sign.data.key;
      }

      const qtd = Math.max(1, parseInt(quantidade, 10) || 1);
      const { data } = await api.POST('/api/animais/{id}/eventos', {
        params: { path: { id } },
        body: { tipo, descricao, valorCentavos, faturar, anexoKey, itemId: itemId || undefined, quantidade: qtd },
      });
      if (data) {
        if (itemId && !data.estoqueBaixado) {
          alert('Evento registrado, mas o estoque não foi baixado (item não estocável ou sem saldo).');
        }
        setDescricao('');
        setValor('');
        setItemId('');
        setQuantidade('1');
        setAnexoEvento(null);
        setShowForm(false);
        await load();
      }
    } catch {
      alert('Falha ao registrar. Se anexou arquivo, verifique o storage/CORS.');
    } finally {
      setSaving(false);
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

  function onInternar() {
    setInternarErr(null);
    setMotivoInput('');
    setBoxInput('');
    setInternarOpen(true);
    void api
      .GET('/api/internacoes/motivos')
      .then(({ data }) => setMotivos((data as { id: string; nome: string }[]) ?? []));
    void api
      .GET('/api/internacoes/boxes')
      .then(({ data }) => setBoxes((data as { id: string; nome: string }[]) ?? []));
  }

  async function confirmarInternar(e: FormEvent) {
    e.preventDefault();
    const motivo = motivoInput.trim();
    const box = boxInput.trim();
    if (!motivo) {
      setInternarErr('Informe o motivo.');
      return;
    }
    setInternando(true);
    setInternarErr(null);
    // Persiste na lista (dedup no servidor) o que for novo, para reaproveitar depois.
    await api.POST('/api/internacoes/motivos', { body: { nome: motivo } });
    if (box) await api.POST('/api/internacoes/boxes', { body: { nome: box } });
    const { error } = await api.POST('/api/internacoes', {
      body: { animalId: id, motivo, box: box || undefined, altaPrevista: altaPrevistaInput || undefined },
    });
    setInternando(false);
    if (error) {
      setInternarErr('Não foi possível internar (animal já internado?).');
      return;
    }
    setInternarOpen(false);
    router.push('/internacao');
  }

  function onDocumentos() {
    setGerado(null);
    setModeloId('');
    setDocOpen(true);
    void api
      .GET('/api/modelos', { params: { query: {} } })
      .then(({ data }) => setModelos((data as { id: string; tipo: string; nome: string }[]) ?? []));
  }

  async function gerarDoc() {
    if (!modeloId) return;
    setGerando(true);
    const { data } = await api.POST('/api/modelos/{id}/gerar', {
      params: { path: { id: modeloId } },
      body: { animalId: id },
    });
    setGerando(false);
    if (data) setGerado(data as { titulo: string; conteudo: string });
  }

  function imprimirDoc() {
    if (!gerado) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(
      `<html><head><title>${esc(gerado.titulo)}</title><style>body{font-family:system-ui,sans-serif;padding:40px;white-space:pre-wrap;line-height:1.6;color:#111}</style></head><body>${esc(gerado.conteudo)}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  async function onSaveAnimal(e: FormEvent) {
    e.preventDefault();
    await api.PATCH('/api/animais/{id}', {
      params: { path: { id } },
      body: {
        nome: aForm.nome,
        especie: aForm.especie || undefined,
        raca: aForm.raca || undefined,
        pelagem: aForm.pelagem || undefined,
        sexo: aForm.sexo || undefined,
        castrado: aForm.castrado,
        microchip: aForm.microchip || undefined,
        marcacoes: aForm.marcacoes
          ? aForm.marcacoes.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        pedigree: aForm.pedigree,
        pedigreeNumero: aForm.pedigreeNumero || undefined,
        status: aForm.status,
      },
    });
    setEditAnimal(false);
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (!animal) return <p className="text-sm text-gray-500">Animal não encontrado.</p>;

  // Evolução por médico (doc 16 PR7): profissionais presentes na timeline + filtro.
  const medicosNaTimeline = Array.from(
    new Set(eventos.map((e) => e.registradoPorNome).filter((n): n is string => !!n)),
  ).sort();
  const eventosFiltrados = filtroMedico ? eventos.filter((e) => e.registradoPorNome === filtroMedico) : eventos;
  // Blocos por data (doc 16 PR5): agrupa por dia preservando a ordem (mais recente primeiro).
  const timelinePorDia = Object.entries(
    eventosFiltrados.reduce<Record<string, Evento[]>>((acc, ev) => {
      const dia = new Date(ev.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      (acc[dia] ??= []).push(ev);
      return acc;
    }, {}),
  );

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
              {[animal.especie, animal.raca, animal.pelagem, animal.sexo, animal.castrado ? 'Castrado' : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            {animal.marcacoes && animal.marcacoes.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {animal.marcacoes.map((m) => (
                  <span key={m} className="inline-flex items-center rounded-full bg-amber-50 dark:bg-[#15203c] text-amber-600 dark:text-amber-300 px-2 py-0.5 text-xs">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditAnimal((v) => !v)}>
              <i className="ri-edit-line"></i> Editar
            </Button>
            <Button variant="ghost" onClick={onInternar}>
              <i className="ri-hospital-line"></i> Internar
            </Button>
            <Button variant="ghost" onClick={onDocumentos}>
              <i className="ri-file-text-line"></i> Documento
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>
              <i className="ri-add-line"></i> Registrar evento
            </Button>
          </div>
        </div>

        <Modal open={internarOpen} onClose={() => setInternarOpen(false)} title={`Internar ${animal.nome}`}>
          <form onSubmit={confirmarInternar} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Motivo *</span>
              <input
                list="internar-motivos"
                autoFocus
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                placeholder="Escolha da lista ou digite um novo…"
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
              <datalist id="internar-motivos">
                {motivos.map((m) => (
                  <option key={m.id} value={m.nome} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Box (opcional)</span>
              <input
                list="internar-boxes"
                value={boxInput}
                onChange={(e) => setBoxInput(e.target.value)}
                placeholder="Escolha da lista ou digite um novo…"
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
              <datalist id="internar-boxes">
                {boxes.map((b) => (
                  <option key={b.id} value={b.nome} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Previsão de alta (opcional)</span>
              <input
                type="date"
                value={altaPrevistaInput}
                onChange={(e) => setAltaPrevistaInput(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
            </label>
            <p className="text-xs text-gray-400">
              Motivos e boxes novos são salvos na lista automaticamente (sem duplicar).
            </p>
            {internarErr && <p className="text-sm text-red-500">{internarErr}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <Button type="button" variant="ghost" onClick={() => setInternarOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={internando}>
                {internando ? 'Internando…' : 'Internar'}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal open={docOpen} onClose={() => setDocOpen(false)} title={`Documento — ${animal.nome}`}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Modelo</span>
              <div className="flex gap-2">
                <select
                  value={modeloId}
                  onChange={(e) => {
                    setModeloId(e.target.value);
                    setGerado(null);
                  }}
                  className="flex-1 rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
                >
                  <option value="">— escolha —</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.tipo})
                    </option>
                  ))}
                </select>
                <Button type="button" onClick={gerarDoc} disabled={!modeloId || gerando}>
                  {gerando ? 'Gerando…' : 'Gerar'}
                </Button>
              </div>
            </label>

            {modelos.length === 0 && (
              <p className="text-xs text-gray-400">
                Nenhum modelo ainda. Crie em <span className="text-primary-500">Modelos</span> no menu.
              </p>
            )}

            {gerado && (
              <>
                <textarea
                  readOnly
                  value={gerado.conteudo}
                  rows={10}
                  className="rounded-md border border-gray-200 dark:border-[#172036] bg-gray-50 dark:bg-[#0c1427] px-3 py-2 text-sm whitespace-pre-wrap"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setDocOpen(false)}>
                    Fechar
                  </Button>
                  <Button type="button" onClick={imprimirDoc}>
                    <i className="ri-printer-line"></i> Imprimir
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>

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
              <span className="text-gray-600 dark:text-gray-300">Pelagem</span>
              <input value={aForm.pelagem} onChange={(e) => setAForm({ ...aForm, pelagem: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" placeholder="Ex.: Preto e marrom" />
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
              <span className="text-gray-600 dark:text-gray-300">Castrado/esterilizado</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Microchip</span>
              <input value={aForm.microchip} onChange={(e) => setAForm({ ...aForm, microchip: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" placeholder="Nº do microchip" />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Marcações (separe por vírgula)</span>
              <input value={aForm.marcacoes} onChange={(e) => setAForm({ ...aForm, marcacoes: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" placeholder="Ex.: renal, diabético" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={aForm.pedigree} onChange={(e) => setAForm({ ...aForm, pedigree: e.target.checked })} />
              <span className="text-gray-600 dark:text-gray-300">Possui pedigree</span>
            </label>
            {aForm.pedigree && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Nº do pedigree</span>
                <input value={aForm.pedigreeNumero} onChange={(e) => setAForm({ ...aForm, pedigreeNumero: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
              </label>
            )}
            <div className="md:col-span-3 flex gap-2">
              <Button type="submit"><i className="ri-save-line"></i> Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setEditAnimal(false)}>Cancelar</Button>
            </div>
          </form>
        )}

        {showForm && (
          <form onSubmit={onAddEvento} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalogo.length > 0 && (
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Item do catálogo (preenche descrição e valor)</span>
                <select
                  defaultValue=""
                  onChange={(e) => onPickCatalogo(e.target.value)}
                  className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
                >
                  <option value="">— selecionar da tabela de preços —</option>
                  {catalogo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} · {c.nome} · {(c.precoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
            {itemId && (
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">
                  Quantidade (baixa do estoque, se o item for estocável)
                </span>
                <input
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500 w-32"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Descrição</span>
              <input
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Anexo (documento/exame/vídeo) — opcional</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                onChange={(e) => setAnexoEvento(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:text-primary-600 file:px-3 file:py-1.5"
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

      {/* A cobrar / comanda (doc 16 B1-B3) — faturamento acoplado */}
      {fatura && fatura.itens.length > 0 && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-black dark:text-white">A cobrar</h2>
              {/* Status nítido: em aberto vs. faturado/fechado (B2). */}
              {fatura.status === 'aberta' ? (
                <span className="text-xs rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-600">Em aberto</span>
              ) : (
                <span className="text-xs rounded-full px-2.5 py-0.5 bg-green-50 text-green-600 capitalize">{fatura.status}</span>
              )}
            </div>
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
          {fatura.status === 'aberta' && (
            <div className="mt-4 flex justify-end gap-2">
              <Link href="/faturas" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-gray-500 hover:text-primary-500">
                <i className="ri-external-link-line"></i> Ver no financeiro
              </Link>
              <Button onClick={onEfetuarCobranca} disabled={cobrando}>
                <i className="ri-money-dollar-circle-line"></i> {cobrando ? 'Cobrando…' : 'Efetuar cobrança'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Protocolos vacinais (doc 16 PR9) */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-black dark:text-white">Protocolos vacinais</h2>
          <Button variant="ghost" onClick={() => setShowVacForm((v) => !v)}>
            <i className="ri-syringe-line"></i> Registrar vacina
          </Button>
        </div>
        {showVacForm && (
          <form onSubmit={onAddVacina} className="grid grid-cols-1 md:grid-cols-5 gap-2 md:items-end mb-4">
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Vacina</span>
              <input required value={vacForm.nome} onChange={(e) => setVacForm({ ...vacForm, nome: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" placeholder="Ex.: Antirrábica" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Laboratório</span>
              <input value={vacForm.laboratorio} onChange={(e) => setVacForm({ ...vacForm, laboratorio: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Lote</span>
              <input value={vacForm.lote} onChange={(e) => setVacForm({ ...vacForm, lote: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Aplicada em</span>
              <input type="date" required value={vacForm.aplicadaEm} onChange={(e) => setVacForm({ ...vacForm, aplicadaEm: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Próxima dose</span>
              <input type="date" value={vacForm.proximaEm} onChange={(e) => setVacForm({ ...vacForm, proximaEm: e.target.value })} className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500" />
            </label>
            <Button type="submit" disabled={salvandoVac} className="md:col-span-5 md:justify-self-start">
              {salvandoVac ? 'Salvando…' : 'Salvar'}
            </Button>
          </form>
        )}
        {vacinas.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma vacina registrada.</p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-[#172036]/50 text-sm">
            {vacinas.map((v) => {
              const prox = v.proximaEm ? new Date(v.proximaEm) : null;
              const dias = prox ? Math.floor((prox.getTime() - Date.now()) / 86_400_000) : null;
              const proxCls =
                dias == null ? '' : dias < 0 ? 'text-red-500' : dias <= 30 ? 'text-amber-600' : 'text-gray-500';
              return (
                <li key={v.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-black dark:text-white">{v.nome}</p>
                    <p className="text-xs text-gray-500">
                      Aplicada em {new Date(v.aplicadaEm).toLocaleDateString('pt-BR')}
                      {v.laboratorio && ` · ${v.laboratorio}`}
                      {v.lote && ` · lote ${v.lote}`}
                      {v.aplicadaPorNome && ` · ${v.aplicadaPorNome}`}
                    </p>
                  </div>
                  {prox && (
                    <span className={`text-xs whitespace-nowrap ${proxCls}`}>
                      Próxima {prox.toLocaleDateString('pt-BR')}
                      {dias != null && dias < 0 ? ' (vencida)' : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Linha do tempo — blocos por data (PR5) + evolução por médico (PR7) */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-base font-semibold text-black dark:text-white">Linha do tempo</h2>
          {medicosNaTimeline.length > 0 && (
            <select
              value={filtroMedico}
              onChange={(e) => setFiltroMedico(e.target.value)}
              className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-1.5 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Todos os profissionais</option>
              {medicosNaTimeline.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
        {eventosFiltrados.length === 0 ? (
          <p className="text-sm text-gray-400">
            {filtroMedico ? 'Nenhum evento deste profissional.' : 'Sem eventos registrados ainda.'}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {timelinePorDia.map(([dia, itens]) => (
              <div key={dia}>
                {/* Bloco de data */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-black dark:text-white capitalize">{dia}</span>
                  <span className="h-px flex-1 bg-gray-100 dark:bg-[#172036]"></span>
                </div>
                <ul className="flex flex-col gap-4">
                  {itens.map((ev) => (
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
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <p className="text-xs text-gray-400">
                            {new Date(ev.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {ev.registradoPorNome && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 dark:bg-[#15203c] text-gray-500 px-2 py-0.5 text-xs">
                              <i className="ri-user-3-line"></i> {ev.registradoPorNome}
                            </span>
                          )}
                          {ev.anexoUrl ? (
                            <a href={ev.anexoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-500 hover:underline inline-flex items-center gap-1">
                              <i className="ri-attachment-2"></i> Ver anexo
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
