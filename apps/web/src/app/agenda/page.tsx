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
}

export default function AgendaPage() {
  const [eventos, setEventos] = useState<EventInput[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calRef = useRef<FullCalendar>(null);

  const load = useCallback(async () => {
    const { data } = await api.GET('/api/agenda', { params: { query: {} } });
    const items = (data as Agendamento[]) ?? [];
    setEventos(
      items
        .filter((a) => a.status !== 'cancelado')
        .map((a) => ({ id: a.id, title: a.titulo, start: a.inicio, end: a.fim })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onDateClick(arg: DateClickArg) {
    // Pré-preenche o formulário com a data clicada (1h de duração).
    const start = new Date(arg.date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setInicio(toLocalInput(start));
    setFim(toLocalInput(end));
    setShowForm(true);
  }

  async function onEventClick(arg: EventClickArg) {
    if (!confirm(`Cancelar "${arg.event.title}"?`)) return;
    await api.DELETE('/api/agenda/{id}', { params: { path: { id: arg.event.id } } });
    await load();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (new Date(fim) <= new Date(inicio)) {
      setError('O fim deve ser depois do início.');
      return;
    }
    setSaving(true);
    const { data } = await api.POST('/api/agenda', {
      body: { titulo, inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString() },
    });
    setSaving(false);
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
          <p className="text-sm text-gray-500">Clique num horário para agendar; num evento para cancelar.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line"></i> Novo agendamento
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end">
            <label className="flex flex-col gap-1 text-sm md:col-span-3">
              <span className="text-gray-600 dark:text-gray-300">Título</span>
              <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} placeholder="Consulta — Rex" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Início</span>
              <input type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Fim</span>
              <input type="datetime-local" required value={fim} onChange={(e) => setFim(e.target.value)} className={inputCls} />
            </label>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Agendar'}</Button>
            {error && <p className="text-sm text-red-500 md:col-span-3">{error}</p>}
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
