'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface AuditItem {
  id: string;
  userId: string | null;
  userNome: string | null;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  resumo: string;
  detalhe: Record<string, unknown> | null;
  ip: string | null;
  criadoEm: string;
}
interface AuditPage {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
}

// Rótulos amigáveis por ação (fallback: a própria chave).
const ACAO_LABEL: Record<string, string> = {
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'auth.register': 'Cadastro de clínica',
  'usuario.criar': 'Usuário — criar/vincular',
  'usuario.atualizar': 'Usuário — atualizar',
  'usuario.reset_senha': 'Usuário — reset de senha',
  'usuario.remover': 'Usuário — remover acesso',
  'fiscal.emitir': 'Fiscal — emitir nota',
  'fiscal.cancelar': 'Fiscal — cancelar nota',
  'financeiro.receber': 'Financeiro — recebimento',
};

const ENTIDADES = ['sessao', 'usuario', 'nota_fiscal', 'fatura', 'tenant'] as const;
const ENTIDADE_LABEL: Record<string, string> = {
  sessao: 'Sessão',
  usuario: 'Usuário',
  nota_fiscal: 'Nota fiscal',
  fatura: 'Fatura',
  tenant: 'Clínica',
};

const ENTIDADE_STYLE: Record<string, string> = {
  sessao: 'bg-blue-50 text-blue-600',
  usuario: 'bg-purple-50 text-purple-600',
  nota_fiscal: 'bg-amber-50 text-amber-600',
  fatura: 'bg-green-50 text-green-600',
  tenant: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
};

const PAGE_SIZE = 50;

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 text-sm outline-none focus:border-primary-500';

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function AuditoriaPage() {
  const [page, setPage] = useState<AuditPage | null>(null);
  const [entidade, setEntidade] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const res = await api.GET('/api/auditoria', {
      params: { query: { limit: PAGE_SIZE, offset, ...(entidade ? { entidade } : {}) } },
    });
    if (res.error) {
      setErro('Não foi possível carregar a auditoria (apenas admin).');
      setPage(null);
    } else {
      setPage(res.data as AuditPage);
    }
    setLoading(false);
  }, [entidade, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = page?.total ?? 0;
  const inicio = total === 0 ? 0 : offset + 1;
  const fim = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-[25px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Trilha de auditoria</h1>
          <p className="text-sm text-gray-500">
            Registro imutável (append-only) das ações sensíveis da clínica — LGPD (doc 02 §6).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={inputCls}
            value={entidade}
            onChange={(e) => {
              setEntidade(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todas as entidades</option>
            {ENTIDADES.map((ent) => (
              <option key={ent} value={ent}>
                {ENTIDADE_LABEL[ent]}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        {erro ? (
          <p className="py-8 text-center text-sm text-red-500">{erro}</p>
        ) : loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>
        ) : !page || page.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Nenhum registro para o filtro atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Quando</th>
                  <th className="pb-3 pr-4 font-medium">Quem</th>
                  <th className="pb-3 pr-4 font-medium">Ação</th>
                  <th className="pb-3 pr-4 font-medium">Entidade</th>
                  <th className="pb-3 pr-4 font-medium">Detalhe</th>
                  <th className="pb-3 pr-4 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100 dark:border-[#172036] align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-gray-500">{fmt(it.criadoEm)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{it.userNome ?? '—'}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{ACAO_LABEL[it.acao] ?? it.acao}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          ENTIDADE_STYLE[it.entidade] ?? 'bg-gray-100 dark:bg-[#15203c] text-gray-500'
                        }`}
                      >
                        {ENTIDADE_LABEL[it.entidade] ?? it.entidade}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span>{it.resumo}</span>
                      {it.detalhe && Object.keys(it.detalhe).length > 0 && (
                        <button
                          type="button"
                          className="ml-2 text-xs text-primary-500 hover:underline"
                          onClick={() => setAberto(aberto === it.id ? null : it.id)}
                        >
                          {aberto === it.id ? 'ocultar' : 'ver mais'}
                        </button>
                      )}
                      {aberto === it.id && it.detalhe && (
                        <pre className="mt-2 overflow-x-auto rounded bg-gray-50 dark:bg-[#15203c] p-2 text-xs text-gray-600 dark:text-gray-300">
                          {JSON.stringify(it.detalhe, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-gray-400">{it.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>
                {inicio}–{fim} de {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Anterior
                </Button>
                <Button variant="ghost" disabled={fim >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
