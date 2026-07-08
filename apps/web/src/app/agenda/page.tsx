'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Agendamento {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  status: string;
  tipoNome?: string | null;
  cor?: string | null;
  profissionalId?: string | null;
  profissionalNome?: string | null;
  departamentoId?: string | null;
  departamentoNome?: string | null;
}

interface Departamento {
  id: string;
  nome: string;
  cor: string | null;
  ativo: boolean;
}

interface TipoAtendimento {
  id: string;
  nome: string;
  duracaoMinutos: number;
  cor: string | null;
  ativo: boolean;
}

interface Profissional {
  userId: string;
  nome: string;
  role: string;
}

export default function AgendaPage() {
  const [eventos, setEventos] = useState<EventInput[]>([]);
  const [tipos, setTipos] = useState<TipoAtendimento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [filtroProf, setFiltroProf] = useState<string>('');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [filtroDep, setFiltroDep] = useState<string>('');
  const [depId, setDepId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [profId, setProfId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [ags, setAgs] = useState<Agendamento[]>([]);
  const [sel, setSel] = useState<Agendamento | null>(null);
  const [acaoBusy, setAcaoBusy] = useState(false);
  const calRef = useRef<FullCalendar>(null);

  const load = useCallback(async () => {
    // Só busca a janela visível do calendário (via datesSet) — evita puxar toda a
    // agenda do tenant conforme ela cresce.
    if (!range.from || !range.to) return;
    const { data } = await api.GET('/api/agenda', {
      params: {
        query: {
          profissionalId: filtroProf || undefined,
          departamentoId: filtroDep || undefined,
          from: range.from,
          to: range.to,
        },
      },
    });
    const items = (data as Agendamento[]) ?? [];
    setAgs(items);
    setEventos(
      items
        .filter((a) => a.status !== 'cancelado')
        .map((a) => ({
          id: a.id,
          title: a.profissionalNome ? `${a.titulo} · ${a.profissionalNome.split(' ')[0]}` : a.titulo,
          start: a.inicio,
          end: a.fim,
          backgroundColor: a.cor ?? undefined,
          borderColor: a.cor ?? undefined,
          classNames: a.status === 'concluido' ? ['opacity-60'] : undefined,
        })),
    );
  }, [filtroProf, filtroDep, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.GET('/api/agenda/tipos', { params: { query: {} } }).then(({ data }) => {
      setTipos((data as TipoAtendimento[]) ?? []);
    });
    void api.GET('/api/agenda/profissionais').then(({ data }) => {
      setProfissionais((data as Profissional[]) ?? []);
    });
    void api.GET('/api/agenda/departamentos', { params: { query: {} } }).then(({ data }) => {
      setDepartamentos((data as Departamento[]) ?? []);
    });
    void api.GET('/api/auth/me').then(({ data }) => {
      const me = data as { userId?: string } | undefined;
      if (me?.userId) setMeuId(me.userId);
    });
  }, []);

  // Tipo escolhido preenche o fim automaticamente a partir da duração.
  function onTipoChange(id: string) {
    setTipoId(id);
    const tipo = tipos.find((t) => t.id === id);
    if (tipo && inicio) {
      const start = new Date(inicio);
      setFim(toLocalInput(new Date(start.getTime() + tipo.duracaoMinutos * 60_000)));
    }
  }

  function onDateClick(arg: DateClickArg) {
    const start = new Date(arg.date);
    const tipo = tipos.find((t) => t.id === tipoId);
    const durMin = tipo?.duracaoMinutos ?? 60;
    setInicio(toLocalInput(start));
    setFim(toLocalInput(new Date(start.getTime() + durMin * 60_000)));
    setShowForm(true);
  }

  // Clique no evento abre o painel lateral (slider) com detalhes + ações — sem
  // prompt e sem nova janela (doc 16 A3).
  function onEventClick(arg: EventClickArg) {
    const ag = ags.find((a) => a.id === arg.event.id);
    if (ag) setSel(ag);
  }

  async function mudarStatus(status: 'confirmado' | 'concluido' | 'faltou' | 'cancelado') {
    if (!sel) return;
    setAcaoBusy(true);
    await api.PATCH('/api/agenda/{id}/status', { params: { path: { id: sel.id } }, body: { status } });
    setAcaoBusy(false);
    setSel(null);
    await load();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (fim && new Date(fim) <= new Date(inicio)) {
      setError('O fim deve ser depois do início.');
      return;
    }
    setSaving(true);
    const { data, error: err } = await api.POST('/api/agenda', {
      body: {
        titulo,
        inicio: new Date(inicio).toISOString(),
        fim: fim ? new Date(fim).toISOString() : undefined,
        tipoAtendimentoId: tipoId || undefined,
        profissionalId: profId || undefined,
        departamentoId: depId || undefined,
      },
    });
    setSaving(false);
    if (err) {
      setError('Não foi possível agendar. Confira os campos.');
      return;
    }
    if (data) {
      setTitulo('');
      setInicio('');
      setFim('');
      setDepId('');
      setShowForm(false);
      await load();
    }
  }

  const inputCls =
    'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Agenda</h1>
          <p className="text-sm text-gray-500">
            Clique num horário para agendar; num evento para concluir/cancelar.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={filtroProf} onChange={(e) => setFiltroProf(e.target.value)} className={`${inputCls} text-sm`}>
            <option value="">Todos os profissionais</option>
            {meuId && <option value={meuId}>Minha agenda</option>}
            {profissionais
              .filter((p) => p.userId !== meuId)
              .map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.nome}
                </option>
              ))}
          </select>
          {departamentos.length > 0 && (
            <select value={filtroDep} onChange={(e) => setFiltroDep(e.target.value)} className={`${inputCls} text-sm`}>
              <option value="">Todos os departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          )}
          <Button onClick={() => setShowForm((v) => !v)}>
            <i className="ri-add-line"></i> Novo agendamento
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end">
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Título</span>
              <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} placeholder="Consulta — Rex" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Tipo de atendimento</span>
              <select value={tipoId} onChange={(e) => onTipoChange(e.target.value)} className={inputCls}>
                <option value="">— livre —</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.duracaoMinutos} min)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Profissional</span>
              <select value={profId} onChange={(e) => setProfId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {profissionais.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            {departamentos.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Departamento</span>
                <select value={depId} onChange={(e) => setDepId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Início</span>
              <input
                type="datetime-local"
                required
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                  const tipo = tipos.find((t) => t.id === tipoId);
                  if (tipo && e.target.value) {
                    setFim(toLocalInput(new Date(new Date(e.target.value).getTime() + tipo.duracaoMinutos * 60_000)));
                  }
                }}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Fim {tipoId ? '(auto pelo tipo)' : ''}</span>
              <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={inputCls} />
            </label>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Agendar'}</Button>
            {error && <p className="text-sm text-red-500 md:col-span-4">{error}</p>}
          </form>
        </Card>
      )}

      <Card>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={ptBrLocale}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          height="auto"
          nowIndicator
          events={eventos}
          datesSet={(arg) => setRange({ from: arg.startStr, to: arg.endStr })}
          dateClick={onDateClick}
          eventClick={onEventClick}
        />
      </Card>

      {/* Slider de detalhe do agendamento (doc 16 A3) — sem nova janela. */}
      {sel && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setSel(null)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[380px] bg-white dark:bg-[#0c1427] shadow-xl border-l border-gray-100 dark:border-[#172036] flex flex-col">
            <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100 dark:border-[#172036]">
              <h2 className="font-semibold text-black dark:text-white">Agendamento</h2>
              <button type="button" onClick={() => setSel(null)} className="text-gray-400 hover:text-red-500" aria-label="Fechar">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              <div>
                <p className="text-lg font-semibold text-black dark:text-white">{sel.titulo}</p>
                <span
                  className={`inline-block mt-1 text-xs rounded-full px-2.5 py-0.5 ${STATUS_STYLE[sel.status] ?? 'bg-gray-100 text-gray-500'}`}
                >
                  {STATUS_LABEL[sel.status] ?? sel.status}
                </span>
              </div>
              <InfoLinha icon="ri-calendar-line" label="Início" value={new Date(sel.inicio).toLocaleString('pt-BR')} />
              <InfoLinha icon="ri-time-line" label="Fim" value={new Date(sel.fim).toLocaleString('pt-BR')} />
              {sel.tipoNome && <InfoLinha icon="ri-bookmark-line" label="Tipo" value={sel.tipoNome} />}
              {sel.profissionalNome && <InfoLinha icon="ri-user-3-line" label="Profissional" value={sel.profissionalNome} />}
              {sel.departamentoNome && <InfoLinha icon="ri-building-line" label="Departamento" value={sel.departamentoNome} />}
            </div>
            {sel.status !== 'concluido' && sel.status !== 'cancelado' && (
              <div className="p-5 border-t border-gray-100 dark:border-[#172036] flex flex-col gap-2">
                {sel.status !== 'confirmado' && (
                  <Button disabled={acaoBusy} onClick={() => mudarStatus('confirmado')} className="justify-center">
                    <i className="ri-user-follow-line"></i> Informar chegada do cliente
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" disabled={acaoBusy} onClick={() => mudarStatus('concluido')} className="justify-center">
                    <i className="ri-check-line"></i> Concluir
                  </Button>
                  <Button variant="ghost" disabled={acaoBusy} onClick={() => mudarStatus('faltou')} className="justify-center">
                    <i className="ri-user-unfollow-line"></i> Faltou
                  </Button>
                </div>
                <button
                  type="button"
                  disabled={acaoBusy}
                  onClick={() => mudarStatus('cancelado')}
                  className="text-sm text-red-500 hover:underline mt-1"
                >
                  Cancelar agendamento
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  agendado: 'bg-blue-50 text-blue-600',
  confirmado: 'bg-green-50 text-green-600',
  concluido: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
  faltou: 'bg-amber-50 text-amber-600',
  cancelado: 'bg-red-50 text-red-500 line-through',
};
const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Cliente chegou',
  concluido: 'Concluído',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
};

function InfoLinha({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <i className={`${icon} text-gray-400`}></i>
      <span className="text-gray-500 w-24">{label}</span>
      <span className="text-black dark:text-white">{value}</span>
    </div>
  );
}

// Converte Date para o formato do input datetime-local (YYYY-MM-DDTHH:mm) em hora local.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
