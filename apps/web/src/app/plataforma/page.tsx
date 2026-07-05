'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { platformApi, brl } from '@/lib/platformApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Clinica {
  tenantId: string;
  nome: string;
  usuarios: number;
  status: string;
  planoNome: string | null;
  precoCentavos: number;
  vigenteAte: string | null;
}
interface Plano {
  id: string;
  nome: string;
  precoCentavos: number;
  ciclo: string;
}
interface Kpis {
  totalClinicas: number;
  porStatus: Record<string, number>;
  mrrCentavos: number;
}

const STATUS_STYLE: Record<string, string> = {
  trial: 'bg-blue-50 text-blue-600',
  ativa: 'bg-green-50 text-green-600',
  inadimplente: 'bg-amber-50 text-amber-600',
  suspensa: 'bg-red-50 text-red-500',
  cancelada: 'bg-gray-100 dark:bg-[#15203c] text-gray-400 line-through',
  'sem-assinatura': 'bg-gray-100 dark:bg-[#15203c] text-gray-500',
};

const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 text-sm outline-none focus:border-primary-500';

export default function PlataformaPainel() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [k, c, p] = await Promise.all([
      platformApi.GET('/api/platform/kpis'),
      platformApi.GET('/api/platform/clinicas'),
      platformApi.GET('/api/platform/planos'),
    ]);
    setKpis((k.data as Kpis) ?? null);
    setClinicas((c.data as Clinica[]) ?? []);
    setPlanos((p.data as Plano[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pagar(c: Clinica) {
    setBusy(true);
    await platformApi.POST('/api/platform/clinicas/{tenantId}/assinatura/pagar', {
      params: { path: { tenantId: c.tenantId } },
    });
    setBusy(false);
    void load();
  }

  async function mudarStatus(c: Clinica, status: 'trial' | 'ativa' | 'inadimplente' | 'suspensa' | 'cancelada') {
    if (!confirm(`Confirmar: assinatura de "${c.nome}" → ${status}?`)) return;
    setBusy(true);
    await platformApi.PUT('/api/platform/clinicas/{tenantId}/assinatura', {
      params: { path: { tenantId: c.tenantId } },
      body: { status },
    });
    setBusy(false);
    void load();
  }

  // Modal: definir plano
  const [planoModal, setPlanoModal] = useState<Clinica | null>(null);
  const [planoSel, setPlanoSel] = useState('');
  async function salvarPlano() {
    if (!planoModal || !planoSel) return;
    setBusy(true);
    await platformApi.PUT('/api/platform/clinicas/{tenantId}/assinatura', {
      params: { path: { tenantId: planoModal.tenantId } },
      body: { planoId: planoSel },
    });
    setBusy(false);
    setPlanoModal(null);
    setPlanoSel('');
    void load();
  }

  // Modal: provisionar clínica
  const [provOpen, setProvOpen] = useState(false);
  const [prov, setProv] = useState({ nome: '', adminNome: '', adminEmail: '' });
  const [senhaTemp, setSenhaTemp] = useState<string | null>(null);
  const [provErr, setProvErr] = useState<string | null>(null);
  async function provisionar(e: FormEvent) {
    e.preventDefault();
    setProvErr(null);
    setBusy(true);
    const { data, error } = await platformApi.POST('/api/platform/clinicas', {
      body: { nome: prov.nome, adminNome: prov.adminNome, adminEmail: prov.adminEmail },
    });
    setBusy(false);
    if (error || !data) {
      setProvErr('Falha ao provisionar (e-mail já usado?).');
      return;
    }
    setSenhaTemp(data.senhaTemporaria);
    setProv({ nome: '', adminNome: '', adminEmail: '' });
    void load();
  }

  const kpiCards = kpis
    ? [
        { label: 'Clínicas', valor: String(kpis.totalClinicas), icon: 'ri-community-line' },
        { label: 'Ativas', valor: String(kpis.porStatus.ativa ?? 0), icon: 'ri-checkbox-circle-line' },
        { label: 'Trial', valor: String(kpis.porStatus.trial ?? 0), icon: 'ri-time-line' },
        { label: 'Inadimplentes', valor: String((kpis.porStatus.inadimplente ?? 0) + (kpis.porStatus.suspensa ?? 0)), icon: 'ri-error-warning-line' },
        { label: 'MRR', valor: brl(kpis.mrrCentavos), icon: 'ri-line-chart-line' },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Painel da plataforma</h1>
          <p className="text-sm text-gray-500">Clínicas, assinaturas e indicadores do SaaS.</p>
        </div>
        <Button onClick={() => { setSenhaTemp(null); setProvOpen(true); }}>
          <i className="ri-add-line"></i> Provisionar clínica
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpiCards.map((k) => (
          <Card key={k.label} className="!p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs"><i className={k.icon}></i> {k.label}</div>
            <div className="text-xl font-semibold mt-1">{k.valor}</div>
          </Card>
        ))}
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-gray-500 py-6 text-center">Carregando…</p>
        ) : clinicas.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhuma clínica ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#172036]">
                  <th className="py-2 pr-4 font-medium">Clínica</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Plano</th>
                  <th className="py-2 pr-4 font-medium">Vigente até</th>
                  <th className="py-2 pr-4 font-medium">Usuários</th>
                  <th className="py-2 pr-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clinicas.map((c) => (
                  <tr key={c.tenantId} className="border-b border-gray-50 dark:border-[#172036]/50 align-middle">
                    <td className="py-2.5 pr-4">{c.nome}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? ''}`}>{c.status}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {c.planoNome ?? '—'} {c.precoCentavos > 0 && <span className="text-gray-400">· {brl(c.precoCentavos)}</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {c.vigenteAte ? new Date(c.vigenteAte).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">{c.usuarios}</td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                      <button disabled={busy} onClick={() => pagar(c)} className="text-green-600 hover:underline text-xs mr-3" title="Registrar pagamento">Pagar</button>
                      <button disabled={busy} onClick={() => { setPlanoModal(c); setPlanoSel(''); }} className="text-primary-600 hover:underline text-xs mr-3">Plano</button>
                      {c.status === 'suspensa' || c.status === 'cancelada' ? (
                        <button disabled={busy} onClick={() => mudarStatus(c, 'ativa')} className="text-green-600 hover:underline text-xs">Reativar</button>
                      ) : (
                        <button disabled={busy} onClick={() => mudarStatus(c, 'suspensa')} className="text-red-500 hover:underline text-xs">Suspender</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={planoModal !== null} onClose={() => setPlanoModal(null)} title={`Plano — ${planoModal?.nome ?? ''}`}>
        <div className="flex flex-col gap-3">
          <select value={planoSel} onChange={(e) => setPlanoSel(e.target.value)} className={inputCls}>
            <option value="">— selecionar plano —</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} · {brl(p.precoCentavos)}/{p.ciclo}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPlanoModal(null)}>Cancelar</Button>
            <Button disabled={!planoSel || busy} onClick={salvarPlano}>Definir plano</Button>
          </div>
        </div>
      </Modal>

      <Modal open={provOpen} onClose={() => setProvOpen(false)} title="Provisionar clínica">
        {senhaTemp ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>Clínica criada! Senha temporária do admin (mostrada uma vez):</p>
            <code className="rounded bg-gray-50 dark:bg-[#15203c] px-3 py-2 font-mono text-center select-all">{senhaTemp}</code>
            <Button onClick={() => { setProvOpen(false); setSenhaTemp(null); }} className="justify-center">Fechar</Button>
          </div>
        ) : (
          <form onSubmit={provisionar} className="flex flex-col gap-3">
            <input required placeholder="Nome da clínica" value={prov.nome} onChange={(e) => setProv({ ...prov, nome: e.target.value })} className={inputCls} />
            <input required placeholder="Nome do admin" value={prov.adminNome} onChange={(e) => setProv({ ...prov, adminNome: e.target.value })} className={inputCls} />
            <input required type="email" placeholder="E-mail do admin" value={prov.adminEmail} onChange={(e) => setProv({ ...prov, adminEmail: e.target.value })} className={inputCls} />
            {provErr && <p className="text-sm text-red-500">{provErr}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setProvOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>Provisionar</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
