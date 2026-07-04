'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';

interface Dashboard {
  agendamentosHoje: number;
  minhaAgendaHoje: number;
  proximos: { id: string; titulo: string; inicio: string; profissionalNome: string | null; cor: string | null }[];
  internados: number;
  execucoesPendentes: number;
  faturasAbertas: number;
  faturasAbertasCentavos: number;
  receitaMesCentavos: number;
  estoqueAbaixoMinimo: number;
  orcamentosAbertos: number;
  clientes: number;
  minhasComissoesMesCentavos: number;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Kpi({ label, value, icon, href, alerta }: { label: string; value: string; icon: string; href?: string; alerta?: boolean }) {
  const inner = (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${alerta ? 'text-red-500' : 'text-black dark:text-white'}`}>{value}</p>
        </div>
        <span className={`inline-grid place-items-center w-12 h-12 rounded-md ${alerta ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-500'}`}>
          <i className={`${icon} text-2xl`}></i>
        </span>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// Home por persona (doc 05 §1): gestão vê o gerencial; recepção, a agenda do
// dia; médico, a sua agenda + comissões. O superset vem de /api/dashboard.
export default function DashboardPage() {
  const [dados, setDados] = useState<Dashboard | null>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    void api.GET('/api/dashboard').then(({ data }) => setDados((data as Dashboard) ?? null));
    void api.GET('/api/auth/me').then(({ data }) => {
      const me = data as { role?: string } | undefined;
      if (me?.role) setRole(me.role);
    });
  }, []);

  const gestor = role === 'admin' || role === 'gestor';
  const vet = role === 'veterinario';

  return (
    <div className="flex flex-col gap-[25px]">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">Início</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {!dados ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px]">
            <Kpi
              label={vet ? 'Minha agenda hoje' : 'Agenda hoje'}
              value={String(vet ? dados.minhaAgendaHoje : dados.agendamentosHoje)}
              icon="ri-calendar-2-line"
              href="/agenda"
            />
            <Kpi
              label="Internados agora"
              value={String(dados.internados)}
              icon="ri-hospital-line"
              href="/internacao"
              alerta={dados.execucoesPendentes > 0}
            />
            {gestor ? (
              <>
                <Kpi label="Receita do mês" value={brl(dados.receitaMesCentavos)} icon="ri-money-dollar-circle-line" href="/faturas" />
                <Kpi
                  label="Em aberto (faturas)"
                  value={brl(dados.faturasAbertasCentavos)}
                  icon="ri-bill-line"
                  href="/faturas"
                />
              </>
            ) : (
              <>
                <Kpi label="Orçamentos abertos" value={String(dados.orcamentosAbertos)} icon="ri-file-list-3-line" href="/orcamentos" />
                <Kpi label="Clientes" value={String(dados.clientes)} icon="ri-user-heart-line" href="/clientes" />
              </>
            )}
          </div>

          {gestor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px]">
              <Kpi label="Clientes" value={String(dados.clientes)} icon="ri-user-heart-line" href="/clientes" />
              <Kpi label="Orçamentos abertos" value={String(dados.orcamentosAbertos)} icon="ri-file-list-3-line" href="/orcamentos" />
              <Kpi
                label="Estoque abaixo do mínimo"
                value={String(dados.estoqueAbaixoMinimo)}
                icon="ri-archive-2-line"
                href="/estoque"
                alerta={dados.estoqueAbaixoMinimo > 0}
              />
              <Kpi
                label="Execuções pendentes"
                value={String(dados.execucoesPendentes)}
                icon="ri-syringe-line"
                href="/internacao"
                alerta={dados.execucoesPendentes > 0}
              />
            </div>
          )}

          {vet && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[25px]">
              <Kpi label="Minhas comissões (mês)" value={brl(dados.minhasComissoesMesCentavos)} icon="ri-hand-coin-line" href="/comissoes" />
              <Kpi
                label="Execuções pendentes (internação)"
                value={String(dados.execucoesPendentes)}
                icon="ri-syringe-line"
                href="/internacao"
                alerta={dados.execucoesPendentes > 0}
              />
            </div>
          )}

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-black dark:text-white">Próximos de hoje</h2>
              <Link href="/agenda" className="text-sm text-primary-500 hover:underline">
                Ver agenda
              </Link>
            </div>
            {dados.proximos.length === 0 ? (
              <p className="text-sm text-gray-500">Nada agendado para hoje.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dados.proximos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: p.cor ?? '#7c5cff' }}
                    />
                    <span className="font-medium text-black dark:text-white">{hora(p.inicio)}</span>
                    <span className="text-gray-600 dark:text-gray-300">{p.titulo}</span>
                    {p.profissionalNome && <span className="text-gray-400 text-xs ml-auto">{p.profissionalNome}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
