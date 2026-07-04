'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Config {
  cnpj?: string | null;
  razaoSocial?: string | null;
  inscricaoMunicipal?: string | null;
  regimeTributario: 'simples' | 'presumido' | 'real';
  serieNfse: string;
  proximoNumero: number;
  provedor: 'manual' | 'focus' | 'nfe_io' | 'plugnotas';
  ambiente: 'homologacao' | 'producao';
  ativo: boolean;
}
interface Nota {
  id: string;
  faturaId: string;
  responsavelNome?: string | null;
  status: string;
  numero?: string | null;
  serie?: string | null;
  valorCentavos: number;
  mensagem?: string | null;
  criadaEm: string;
}
interface Fatura {
  id: string;
  responsavelNome: string;
  status: string;
  totalCentavos: number;
}

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

const STATUS_STYLE: Record<string, string> = {
  rascunho: 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
  processando: 'bg-blue-50 text-blue-600',
  emitida: 'bg-green-50 text-green-600',
  rejeitada: 'bg-red-50 text-red-500',
  cancelada: 'bg-gray-100 dark:bg-[#15203c] text-gray-400 line-through',
};

function brl(c: number): string {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FiscalPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [faturaSel, setFaturaSel] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [c, n, f] = await Promise.all([
      api.GET('/api/fiscal/config'),
      api.GET('/api/fiscal/notas'),
      api.GET('/api/faturas'),
    ]);
    setConfig((c.data as Config) ?? null);
    setNotas((n.data as Nota[]) ?? []);
    // Só faturas com algo a notar (não canceladas).
    setFaturas(((f.data as Fatura[]) ?? []).filter((x) => x.status !== 'cancelada'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveConfig(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSavingCfg(true);
    setMsg(null);
    const { error } = await api.PUT('/api/fiscal/config', {
      body: {
        cnpj: config.cnpj ?? undefined,
        razaoSocial: config.razaoSocial ?? undefined,
        inscricaoMunicipal: config.inscricaoMunicipal ?? undefined,
        regimeTributario: config.regimeTributario,
        serieNfse: config.serieNfse,
        proximoNumero: config.proximoNumero,
        provedor: config.provedor,
        ambiente: config.ambiente,
        ativo: config.ativo,
      },
    });
    setSavingCfg(false);
    setMsg(error ? { kind: 'err', text: 'Não foi possível salvar.' } : { kind: 'ok', text: 'Configuração salva.' });
    if (!error) void load();
  }

  async function onGerarNota() {
    if (!faturaSel) return;
    setBusy(true);
    setMsg(null);
    const { error } = await api.POST('/api/faturas/{faturaId}/nota', {
      params: { path: { faturaId: faturaSel } },
      body: { tipo: 'nfse' },
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: 'Não foi possível gerar a nota (já existe uma para esta fatura?).' });
      return;
    }
    setFaturaSel('');
    void load();
  }

  async function onEmitir(id: string) {
    setBusy(true);
    setMsg(null);
    const { data, error } = await api.POST('/api/fiscal/notas/{id}/emitir', { params: { path: { id } } });
    setBusy(false);
    if (error || !data) {
      setMsg({ kind: 'err', text: 'Emissão falhou. Confira a configuração (ativa?) e o provedor.' });
      return;
    }
    void load();
  }

  async function onCancelar(id: string) {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo) return;
    setBusy(true);
    const { error } = await api.POST('/api/fiscal/notas/{id}/cancelar', {
      params: { path: { id } },
      body: { motivo },
    });
    setBusy(false);
    if (error) setMsg({ kind: 'err', text: 'Cancelamento falhou.' });
    else void load();
  }

  if (!config) return <p className="text-sm text-gray-500">Carregando…</p>;

  return (
    <div className="flex flex-col gap-[25px]">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">Fiscal</h1>
        <p className="text-sm text-gray-500">Emissão de NFS-e a partir das faturas (doc 13 §3)</p>
      </div>

      {msg && (
        <p className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
      )}

      <Card>
        <h2 className="text-base font-semibold text-black dark:text-white mb-1">Configuração do emitente</h2>
        <p className="text-xs text-gray-500 mb-4">
          Certificado digital e credenciais do provedor ficam no cofre (nunca aqui). Provedor{' '}
          <strong>manual</strong>: a numeração é própria (série + sequência).
        </p>
        <form onSubmit={onSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="CNPJ">
            <input value={config.cnpj ?? ''} onChange={(e) => setConfig({ ...config, cnpj: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Razão social">
            <input value={config.razaoSocial ?? ''} onChange={(e) => setConfig({ ...config, razaoSocial: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Inscrição municipal">
            <input value={config.inscricaoMunicipal ?? ''} onChange={(e) => setConfig({ ...config, inscricaoMunicipal: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Regime tributário">
            <select value={config.regimeTributario} onChange={(e) => setConfig({ ...config, regimeTributario: e.target.value as Config['regimeTributario'] })} className={inputCls}>
              <option value="simples">Simples Nacional</option>
              <option value="presumido">Lucro Presumido</option>
              <option value="real">Lucro Real</option>
            </select>
          </Field>
          <Field label="Série NFS-e">
            <input value={config.serieNfse} onChange={(e) => setConfig({ ...config, serieNfse: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Próximo número">
            <input type="number" min={1} value={config.proximoNumero} onChange={(e) => setConfig({ ...config, proximoNumero: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Provedor">
            <select value={config.provedor} onChange={(e) => setConfig({ ...config, provedor: e.target.value as Config['provedor'] })} className={inputCls}>
              <option value="manual">Manual (numeração própria)</option>
              <option value="focus">Focus NFe (em breve)</option>
              <option value="nfe_io">NFe.io (em breve)</option>
              <option value="plugnotas">PlugNotas (em breve)</option>
            </select>
          </Field>
          <Field label="Ambiente">
            <select value={config.ambiente} onChange={(e) => setConfig({ ...config, ambiente: e.target.value as Config['ambiente'] })} className={inputCls}>
              <option value="homologacao">Homologação</option>
              <option value="producao">Produção</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={config.ativo} onChange={(e) => setConfig({ ...config, ativo: e.target.checked })} />
            <span className="text-gray-600 dark:text-gray-300">Emissão fiscal ativa</span>
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={savingCfg}>{savingCfg ? 'Salvando…' : 'Salvar configuração'}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
          <label className="flex flex-col gap-1 text-sm flex-1">
            <span className="text-gray-600 dark:text-gray-300">Gerar nota a partir de uma fatura</span>
            <select value={faturaSel} onChange={(e) => setFaturaSel(e.target.value)} className={inputCls}>
              <option value="">Selecione uma fatura…</option>
              {faturas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.responsavelNome} — {brl(f.totalCentavos)} ({f.status})
                </option>
              ))}
            </select>
          </label>
          <Button onClick={onGerarNota} disabled={!faturaSel || busy}>
            <i className="ri-add-line"></i> Gerar rascunho
          </Button>
        </div>

        <h2 className="text-base font-semibold text-black dark:text-white mb-3">Notas</h2>
        {notas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma nota ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                  <th className="py-2 pr-3 font-medium">Número</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Valor</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {notas.map((n) => (
                  <tr key={n.id} className="border-b border-gray-50 dark:border-[#101a30]">
                    <td className="py-2 pr-3">{n.numero ? `${n.serie ?? ''}·${n.numero}` : '—'}</td>
                    <td className="py-2 pr-3">{n.responsavelNome ?? '—'}</td>
                    <td className="py-2 pr-3">{brl(n.valorCentavos)}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLE[n.status] ?? ''}`}>{n.status}</span>
                      {n.mensagem && <span className="block text-xs text-gray-400 mt-0.5">{n.mensagem}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        {(n.status === 'rascunho' || n.status === 'rejeitada') && (
                          <button onClick={() => onEmitir(n.id)} disabled={busy} className="text-primary-500 hover:underline">
                            Emitir
                          </button>
                        )}
                        {n.status === 'emitida' && (
                          <button onClick={() => onCancelar(n.id)} disabled={busy} className="text-red-500 hover:underline">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}
