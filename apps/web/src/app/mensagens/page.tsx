'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface VacinaVencendo {
  vacinaId: string;
  animalId: string;
  animalNome: string;
  responsavelId: string;
  responsavelNome: string;
  vacina: string;
  proximaEm: string;
  diasRestantes: number;
}
interface Mensagem {
  id: string;
  responsavelId?: string | null;
  responsavelNome?: string | null;
  canal: string;
  corpo: string;
  status: string;
  referenciaTipo?: string | null;
  disparadoPorNome?: string | null;
  criadaEm: string;
}

const CANAL_ICONE: Record<string, string> = {
  whatsapp: 'ri-whatsapp-line',
  email: 'ri-mail-line',
  sms: 'ri-message-2-line',
  manual: 'ri-sticky-note-line',
};

// CRM / Mensageria (doc 17 slice 3): vacinas a vencer (lembrete) + histórico geral.
export default function MensagensPage() {
  const [dias, setDias] = useState(30);
  const [vencendo, setVencendo] = useState<VacinaVencendo[]>([]);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadVencendo = useCallback(async () => {
    const { data } = await api.GET('/api/mensagens/vacinas-vencendo', { params: { query: { dias } } });
    setVencendo((data as VacinaVencendo[]) ?? []);
  }, [dias]);

  const loadHistorico = useCallback(async () => {
    const { data } = await api.GET('/api/mensagens', { params: { query: {} } });
    setHistorico((data as Mensagem[]) ?? []);
  }, []);

  useEffect(() => {
    void loadVencendo();
  }, [loadVencendo]);
  useEffect(() => {
    void loadHistorico();
  }, [loadHistorico]);

  async function registrarLembrete(v: VacinaVencendo) {
    setBusy(v.vacinaId);
    const dataFmt = new Date(v.proximaEm).toLocaleDateString('pt-BR');
    const corpo = `Olá ${v.responsavelNome}, a vacina ${v.vacina} do ${v.animalNome} está prevista para ${dataFmt}. Podemos agendar?`;
    const { error } = await api.POST('/api/clientes/{id}/mensagens', {
      params: { path: { id: v.responsavelId } },
      body: { canal: 'whatsapp', corpo, referenciaTipo: 'vacina', referenciaId: v.vacinaId },
    });
    setBusy(null);
    if (error) {
      alert('Não foi possível registrar o lembrete.');
      return;
    }
    void loadHistorico();
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">Mensagens & CRM</h1>
        <p className="text-sm text-gray-500">Lembretes de vacina e histórico de contatos com os clientes.</p>
      </div>

      {/* Vacinas a vencer (doc 17 slice 3) */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="text-base font-semibold text-black dark:text-white">Vacinas a vencer</h2>
            <p className="text-xs text-gray-500">Próximas doses previstas — registre o lembrete para o tutor.</p>
          </div>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-1.5 text-sm outline-none focus:border-primary-500"
          >
            <option value={15}>Próximos 15 dias</option>
            <option value={30}>Próximos 30 dias</option>
            <option value={60}>Próximos 60 dias</option>
            <option value={90}>Próximos 90 dias</option>
          </select>
        </div>
        {vencendo.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma vacina a vencer nesse período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                  <th className="py-2 pr-4 font-medium">Paciente / Tutor</th>
                  <th className="py-2 pr-4 font-medium">Vacina</th>
                  <th className="py-2 pr-4 font-medium">Próxima</th>
                  <th className="py-2 pr-4 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {vencendo.map((v) => (
                  <tr key={v.vacinaId} className="border-b border-gray-50 dark:border-[#172036]/50 align-top">
                    <td className="py-2.5 pr-4">
                      <Link href={`/animais/${v.animalId}`} className="font-medium text-black dark:text-white hover:text-primary-500">
                        {v.animalNome}
                      </Link>
                      <p className="text-xs text-gray-500">{v.responsavelNome}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{v.vacina}</td>
                    <td className="py-2.5 pr-4">
                      <span className={v.diasRestantes < 0 ? 'text-red-500' : v.diasRestantes <= 15 ? 'text-amber-600' : 'text-gray-500'}>
                        {new Date(v.proximaEm).toLocaleDateString('pt-BR')}
                        {v.diasRestantes < 0 ? ' (vencida)' : ` (${v.diasRestantes}d)`}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                      <Button variant="ghost" disabled={busy === v.vacinaId} onClick={() => registrarLembrete(v)}>
                        <i className="ri-whatsapp-line"></i> {busy === v.vacinaId ? '…' : 'Registrar lembrete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Histórico geral (doc 17) */}
      <Card>
        <h2 className="text-base font-semibold text-black dark:text-white mb-4">Histórico de mensagens</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma mensagem registrada ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-50 dark:divide-[#172036]/50 text-sm">
            {historico.map((m) => (
              <li key={m.id} className="py-2.5 flex items-start gap-3">
                <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary-50 text-primary-500 shrink-0">
                  <i className={CANAL_ICONE[m.canal] ?? 'ri-chat-1-line'}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">{m.corpo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.responsavelId ? (
                      <Link href={`/clientes/${m.responsavelId}`} className="hover:text-primary-500">{m.responsavelNome ?? 'Cliente'}</Link>
                    ) : (
                      'Cliente'
                    )}
                    {' · '}
                    {new Date(m.criadaEm).toLocaleString('pt-BR')} · {m.canal}
                    {m.referenciaTipo && ` · ${m.referenciaTipo}`}
                    {m.disparadoPorNome && ` · ${m.disparadoPorNome}`}
                    {' · '}<span className="capitalize">{m.status}</span>
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
