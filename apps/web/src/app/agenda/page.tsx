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
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [profId, setProfId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const calRef = useRef<FullCalendar>(null);

  const load = useCallback(async () => {
    // Só busca a janela visível do calendário (via datesSet) — evita puxar toda a
    // agenda do tenant conforme ela cresce.
    if (!range.from || !range.to) return;
    const { data } = await api.GET('/api/agenda', {
      params: { query: { profissionalId: filtroProf || undefined, from: range.from, to: range.to } },
    });
    const items = (data as Agendamento[]) ?? [];
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
  }, [filtroProf, range.from, range.to]);

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

  async function onEventClick(arg: EventClickArg) {
    const acao = prompt(`"${arg.event.title}" — digite: concluir, faltou ou cancelar`, 'concluir');
    if (!acao) return;
    const mapa: Record<string, string> = { concluir: 'concluido', faltou: 'faltou', cancelar: 'cancelado' };
    const status = mapa[acao.trim().toLowerCase()];
    if (!status) return;
    await api.PATCH('/api/agenda/{id}/status', {
      params: { path: { id: arg.event.id } },
      body: { status: status as 'concluido' | 'faltou' | 'cancelado' },
    });
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
    </div>
  );
}

// Converte Date para o formato do input datetime-local (YYYY-MM-DDTHH:mm) em hora local.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
