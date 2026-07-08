'use client';

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Internacao {
  id: string;
  animalId: string;
  animalNome: string;
  responsavelId: string;
  responsavelNome: string;
  motivo: string;
  box: string | null;
  status: string;
  entradaEm: string;
  altaPrevistaEm: string | null;
  altaEm: string | null;
  pendentes: number;
  fotoUrl: string | null;
}

interface Execucao {
  id: string;
  itemId: string | null;
  descricao: string;
  quantidade: number;
  valorCentavos: number | null;
  executadaEm: string | null;
}

interface ItemCatalogo {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  precoCentavos: number;
}

interface ModeloPrescricao {
  id: string;
  nome: string;
  itens: { itemId: string | null; descricao: string; quantidade: number }[];
}

interface Parametro {
  id: string;
  pesoKg: number | null;
  temperaturaC: number | null;
  fc: number | null;
  fr: number | null;
  observacao: string | null;
  registradoEm: string;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputCls =
  'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

function diasDesde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return dias === 0 ? 'hoje' : dias === 1 ? '1 dia' : `${dias} dias`;
}

export default function InternacaoPage() {
  const [internacoes, setInternacoes] = useState<Internacao[]>([]);
  const [filtro, setFiltro] = useState<'internado' | 'alta' | 'todas'>('internado');
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<{ itemId: string; descricao: string; quantidade: string; valor: string }>({
    itemId: '',
    descricao: '',
    quantidade: '1',
    valor: '',
  });

  // Modelos de prescrição + parâmetros clínicos (doc 05 §9.5/§9.6).
  const [modelos, setModelos] = useState<ModeloPrescricao[]>([]);
  const [modeloSel, setModeloSel] = useState('');
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [paramForm, setParamForm] = useState({ pesoKg: '', temperaturaC: '', fc: '', fr: '', observacao: '' });
  // Modal de gestão de modelos de prescrição.
  const [tplOpen, setTplOpen] = useState(false);
  const [tplNome, setTplNome] = useState('');
  const [tplItens, setTplItens] = useState<{ itemId: string; descricao: string; quantidade: string }[]>([
    { itemId: '', descricao: '', quantidade: '1' },
  ]);

  const loadModelos = useCallback(async () => {
    const { data } = await api.GET('/api/internacoes/modelos-prescricao');
    setModelos((data as ModeloPrescricao[]) ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.GET('/api/internacoes', {
      params: { query: { status: filtro === 'todas' ? undefined : filtro } },
    });
    setInternacoes((data as Internacao[]) ?? []);
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.GET('/api/catalogo', { params: { query: {} } }).then(({ data }) => {
      setItens((data as ItemCatalogo[]) ?? []);
    });
    void loadModelos();
  }, [loadModelos]);

  async function abrir(id: string, forcar = false) {
    if (expandida === id && !forcar) {
      setExpandida(null);
      return;
    }
    setExpandida(id);
    setModeloSel('');
    const { data } = await api.GET('/api/internacoes/{id}', { params: { path: { id } } });
    setExecucoes(((data as { execucoes?: Execucao[] })?.execucoes as Execucao[]) ?? []);
    const p = await api.GET('/api/internacoes/{id}/parametros', { params: { path: { id } } });
    setParametros((p.data as Parametro[]) ?? []);
  }

  async function aplicarModelo(internacaoId: string) {
    if (!modeloSel) return;
    await api.POST('/api/internacoes/{id}/aplicar-modelo', {
      params: { path: { id: internacaoId } },
      body: { modeloId: modeloSel },
    });
    setModeloSel('');
    void abrir(internacaoId, true);
    void load();
  }

  async function onParametro(e: FormEvent, internacaoId: string) {
    e.preventDefault();
    const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : undefined);
    const body = {
      pesoKg: num(paramForm.pesoKg),
      temperaturaC: num(paramForm.temperaturaC),
      fc: paramForm.fc.trim() ? parseInt(paramForm.fc, 10) : undefined,
      fr: paramForm.fr.trim() ? parseInt(paramForm.fr, 10) : undefined,
      observacao: paramForm.observacao.trim() || undefined,
    };
    if (Object.values(body).every((v) => v === undefined)) return;
    await api.POST('/api/internacoes/{id}/parametros', { params: { path: { id: internacaoId } }, body });
    setParamForm({ pesoKg: '', temperaturaC: '', fc: '', fr: '', observacao: '' });
    const p = await api.GET('/api/internacoes/{id}/parametros', { params: { path: { id: internacaoId } } });
    setParametros((p.data as Parametro[]) ?? []);
  }

  async function salvarTemplate(e: FormEvent) {
    e.preventDefault();
    const itens = tplItens
      .filter((it) => it.itemId || it.descricao.trim())
      .map((it) => ({
        itemId: it.itemId || undefined,
        descricao: it.descricao.trim() || undefined,
        quantidade: parseInt(it.quantidade || '1', 10),
      }));
    if (!tplNome.trim() || itens.length === 0) return;
    await api.POST('/api/internacoes/modelos-prescricao', { body: { nome: tplNome.trim(), itens } });
    setTplNome('');
    setTplItens([{ itemId: '', descricao: '', quantidade: '1' }]);
    void loadModelos();
  }

  async function removerTemplate(id: string) {
    if (!confirm('Excluir este modelo de prescrição?')) return;
    await api.DELETE('/api/internacoes/modelos-prescricao/{id}', { params: { path: { id } } });
    void loadModelos();
  }

  async function onPrescrever(e: FormEvent, internacaoId: string) {
    e.preventDefault();
    if (!form.itemId && !form.descricao.trim()) return;
    setSalvando(true);
    await api.POST('/api/internacoes/{id}/execucoes', {
      params: { path: { id: internacaoId } },
      body: {
        itemId: form.itemId || undefined,
        descricao: form.descricao.trim() || undefined,
        quantidade: parseInt(form.quantidade || '1', 10),
        valorCentavos: form.valor ? Math.round(parseFloat(form.valor.replace(',', '.')) * 100) : undefined,
      },
    });
    setSalvando(false);
    setForm({ itemId: '', descricao: '', quantidade: '1', valor: '' });
    void abrir(internacaoId, true);
    void load();
  }

  async function onExecutar(internacaoId: string, exec: Execucao) {
    const { data } = await api.POST('/api/internacoes/{id}/execucoes/{execId}/executar', {
      params: { path: { id: internacaoId, execId: exec.id } },
    });
    const r = data as { estoqueBaixado?: boolean } | undefined;
    if (r && exec.itemId && r.estoqueBaixado === false) {
      alert('Executado — mas SEM baixa de estoque (saldo insuficiente). Ajuste o estoque.');
    }
    void abrir(internacaoId, true);
    void load();
  }

  async function onAlta(i: Internacao) {
    const obs = prompt(`Alta de ${i.animalNome} — observações (opcional):`);
    if (obs === null) return;
    await api.POST('/api/internacoes/{id}/alta', {
      params: { path: { id: i.id } },
      body: { observacoes: obs || undefined },
    });
    setExpandida(null);
    void load();
  }

  const internados = internacoes.filter((i) => i.status === 'internado').length;

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Internação</h1>
          <p className="text-sm text-gray-500">
            Executar prescrição = baixa de estoque + faturamento automático. Admissão pelo prontuário do animal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {internados > 0 && (
            <span className="text-sm text-gray-500">
              Internados: <span className="font-semibold text-primary-600">{internados}</span>
            </span>
          )}
          <Button variant="ghost" onClick={() => setTplOpen(true)}>
            <i className="ri-file-list-3-line"></i> Modelos de prescrição
          </Button>
        </div>
      </div>

      {/* Dashboard de internação: cards dos pacientes internados (doc 16 I1-I4). */}
      {internacoes.some((i) => i.status === 'internado') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {internacoes
            .filter((i) => i.status === 'internado')
            .map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => abrir(i.id)}
                className="text-left rounded-lg border border-gray-100 dark:border-[#172036] bg-white dark:bg-[#0c1427] p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full overflow-hidden bg-primary-50 text-primary-500 grid place-items-center shrink-0">
                    {i.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.fotoUrl} alt={i.animalNome} className="w-full h-full object-cover" />
                    ) : (
                      <i className="ri-bear-smile-line text-2xl"></i>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-black dark:text-white truncate">{i.animalNome}</p>
                    <p className="text-xs text-gray-500 truncate">{i.responsavelNome}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span><i className="ri-time-line"></i> {diasDesde(i.entradaEm)}</span>
                  {i.box && <span><i className="ri-home-4-line"></i> {i.box}</span>}
                </div>
                <p className={`mt-1 text-xs ${i.altaPrevistaEm ? 'text-gray-500' : 'text-gray-400'}`}>
                  {i.altaPrevistaEm
                    ? `Alta prevista ${new Date(i.altaPrevistaEm).toLocaleDateString('pt-BR')}`
                    : 'Sem previsão de alta'}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  {i.pendentes > 0 ? (
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-600">
                      <i className="ri-syringe-line"></i> {i.pendentes} pendente(s)
                    </span>
                  ) : (
                    <span className="text-xs text-green-600"><i className="ri-check-line"></i> sem pendências</span>
                  )}
                  <span className="text-xs text-primary-500">Abrir mapa →</span>
                </div>
              </button>
            ))}
        </div>
      )}

      <Card>
        <div className="flex gap-2 mb-4">
          {(['internado', 'alta', 'todas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`text-sm rounded-full px-4 py-1.5 capitalize transition-all ${
                filtro === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-50 dark:bg-[#15203c] text-gray-500 hover:text-primary-500'
              }`}
            >
              {f === 'todas' ? 'Todas' : f === 'internado' ? 'Internados' : 'Altas'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : internacoes.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma internação {filtro !== 'todas' ? `(${filtro})` : ''}. Para internar, abra o prontuário do
            animal e use a ação <span className="font-medium">Internar</span>.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-[#172036]">
                <th className="py-2 font-medium">Animal</th>
                <th className="py-2 font-medium">Responsável</th>
                <th className="py-2 font-medium">Motivo</th>
                <th className="py-2 font-medium">Box</th>
                <th className="py-2 font-medium">Entrada</th>
                <th className="py-2 font-medium text-right">Pendentes</th>
                <th className="py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {internacoes.map((i) => (
                <Fragment key={i.id}>
                  <tr className="border-b border-gray-50 dark:border-[#172036]/50">
                    <td className="py-2.5">
                      <Link href={`/animais/${i.animalId}`} className="text-black dark:text-white hover:text-primary-500">
                        {i.animalNome}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <Link href={`/clientes/${i.responsavelId}`} className="text-gray-500 hover:text-primary-500">
                        {i.responsavelNome}
                      </Link>
                    </td>
                    <td className="py-2.5 text-gray-500">{i.motivo}</td>
                    <td className="py-2.5 text-gray-500">{i.box ?? '—'}</td>
                    <td className="py-2.5 text-gray-500">
                      {new Date(i.entradaEm).toLocaleDateString('pt-BR')}{' '}
                      {i.status === 'internado' && <span className="text-xs">({diasDesde(i.entradaEm)})</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      {i.pendentes > 0 ? (
                        <span className="text-xs rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-600">
                          {i.pendentes}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <Button variant="ghost" onClick={() => abrir(i.id)}>
                        <i className={expandida === i.id ? 'ri-arrow-up-s-line' : 'ri-stethoscope-line'}></i>{' '}
                        {expandida === i.id ? 'Fechar' : 'Mapa'}
                      </Button>
                      {i.status === 'internado' && (
                        <Button variant="ghost" onClick={() => onAlta(i)}>
                          <i className="ri-logout-box-r-line"></i> Alta
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandida === i.id && (
                    <tr className="bg-gray-50/60 dark:bg-[#15203c]/40">
                      <td colSpan={7} className="px-3 py-3">
                        {i.status === 'internado' && modelos.length > 0 && (
                          <div className="flex items-end gap-2 mb-3">
                            <label className="flex flex-col gap-1 text-xs flex-1">
                              <span className="text-gray-600 dark:text-gray-300">Aplicar modelo de prescrição</span>
                              <select value={modeloSel} onChange={(e) => setModeloSel(e.target.value)} className={inputCls}>
                                <option value="">— escolha —</option>
                                {modelos.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nome} ({m.itens.length} itens)
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button type="button" variant="ghost" disabled={!modeloSel} onClick={() => aplicarModelo(i.id)}>
                              <i className="ri-add-line"></i> Aplicar
                            </Button>
                          </div>
                        )}

                        {i.status === 'internado' && (
                          <form onSubmit={(e) => onPrescrever(e, i.id)} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 md:items-end">
                            <label className="flex flex-col gap-1 text-xs md:col-span-2">
                              <span className="text-gray-600 dark:text-gray-300">Item do catálogo</span>
                              <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
                                <option value="">— livre —</option>
                                {itens.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.codigo} — {it.nome} ({brl(it.precoCentavos)})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs md:col-span-2">
                              <span className="text-gray-600 dark:text-gray-300">Descrição</span>
                              <input
                                value={form.descricao}
                                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                                className={inputCls}
                                placeholder="Dipirona 25mg/kg IV"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              <span className="text-gray-600 dark:text-gray-300">Qtd</span>
                              <input
                                value={form.quantidade}
                                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                                inputMode="numeric"
                                className={inputCls}
                              />
                            </label>
                            <div className="flex gap-2 items-end">
                              <label className="flex flex-col gap-1 text-xs flex-1">
                                <span className="text-gray-600 dark:text-gray-300">Valor (R$)</span>
                                <input
                                  value={form.valor}
                                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                                  inputMode="decimal"
                                  className={inputCls}
                                  placeholder="catálogo"
                                />
                              </label>
                              <Button type="submit" disabled={salvando}>
                                {salvando ? '…' : 'Prescrever'}
                              </Button>
                            </div>
                          </form>
                        )}

                        {execucoes.length === 0 ? (
                          <p className="text-xs text-gray-500">Sem prescrições.</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {execucoes.map((ex) => (
                              <li key={ex.id} className="flex items-center gap-3 text-xs">
                                <span
                                  className={`rounded-full px-2 py-0.5 ${
                                    ex.executadaEm ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                                  }`}
                                >
                                  {ex.executadaEm ? 'executada' : 'pendente'}
                                </span>
                                <span className="text-black dark:text-white">
                                  {ex.descricao}
                                  {ex.quantidade > 1 ? ` x${ex.quantidade}` : ''}
                                </span>
                                {ex.valorCentavos != null && (
                                  <span className="text-gray-500">{brl(ex.valorCentavos * ex.quantidade)}</span>
                                )}
                                {ex.executadaEm ? (
                                  <span className="text-gray-400 ml-auto">
                                    {new Date(ex.executadaEm).toLocaleString('pt-BR')}
                                  </span>
                                ) : (
                                  i.status === 'internado' && (
                                    <button
                                      type="button"
                                      onClick={() => onExecutar(i.id, ex)}
                                      className="ml-auto text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                      <i className="ri-check-double-line"></i> Executar
                                    </button>
                                  )
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-4 border-t border-gray-100 dark:border-[#172036] pt-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Parâmetros clínicos</p>
                          {i.status === 'internado' && (
                            <form onSubmit={(e) => onParametro(e, i.id)} className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3 md:items-end">
                              <label className="flex flex-col gap-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">Peso (kg)</span>
                                <input value={paramForm.pesoKg} onChange={(e) => setParamForm({ ...paramForm, pesoKg: e.target.value })} inputMode="decimal" className={inputCls} />
                              </label>
                              <label className="flex flex-col gap-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">Temp (°C)</span>
                                <input value={paramForm.temperaturaC} onChange={(e) => setParamForm({ ...paramForm, temperaturaC: e.target.value })} inputMode="decimal" className={inputCls} />
                              </label>
                              <label className="flex flex-col gap-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">FC (bpm)</span>
                                <input value={paramForm.fc} onChange={(e) => setParamForm({ ...paramForm, fc: e.target.value })} inputMode="numeric" className={inputCls} />
                              </label>
                              <label className="flex flex-col gap-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">FR (rpm)</span>
                                <input value={paramForm.fr} onChange={(e) => setParamForm({ ...paramForm, fr: e.target.value })} inputMode="numeric" className={inputCls} />
                              </label>
                              <label className="flex flex-col gap-1 text-xs">
                                <span className="text-gray-600 dark:text-gray-300">Obs</span>
                                <input value={paramForm.observacao} onChange={(e) => setParamForm({ ...paramForm, observacao: e.target.value })} className={inputCls} />
                              </label>
                              <Button type="submit" variant="ghost">Registrar</Button>
                            </form>
                          )}
                          {parametros.length === 0 ? (
                            <p className="text-xs text-gray-400">Sem parâmetros registrados.</p>
                          ) : (
                            <ul className="flex flex-col gap-1 text-xs">
                              {parametros.map((p) => (
                                <li key={p.id} className="flex flex-wrap items-center gap-3 text-gray-600 dark:text-gray-300">
                                  <span className="text-gray-400">{new Date(p.registradoEm).toLocaleString('pt-BR')}</span>
                                  {p.pesoKg != null && <span>{p.pesoKg} kg</span>}
                                  {p.temperaturaC != null && <span>{p.temperaturaC} °C</span>}
                                  {p.fc != null && <span>FC {p.fc}</span>}
                                  {p.fr != null && <span>FR {p.fr}</span>}
                                  {p.observacao && <span className="text-gray-500">— {p.observacao}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Modelos de prescrição">
        <div className="flex flex-col gap-4">
          <form onSubmit={salvarTemplate} className="flex flex-col gap-2">
            <input
              value={tplNome}
              onChange={(e) => setTplNome(e.target.value)}
              placeholder="Nome do modelo (ex.: Pós-cirúrgico)"
              className={inputCls}
            />
            <div className="flex flex-col gap-2">
              {tplItens.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={it.itemId}
                    onChange={(e) =>
                      setTplItens(tplItens.map((x, i) => (i === idx ? { ...x, itemId: e.target.value } : x)))
                    }
                    className={`${inputCls} flex-1 text-sm`}
                  >
                    <option value="">— item livre —</option>
                    {itens.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} — {c.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    value={it.descricao}
                    onChange={(e) =>
                      setTplItens(tplItens.map((x, i) => (i === idx ? { ...x, descricao: e.target.value } : x)))
                    }
                    placeholder="Descrição"
                    className={`${inputCls} flex-1 text-sm`}
                  />
                  <input
                    value={it.quantidade}
                    onChange={(e) =>
                      setTplItens(tplItens.map((x, i) => (i === idx ? { ...x, quantidade: e.target.value } : x)))
                    }
                    inputMode="numeric"
                    className={`${inputCls} w-16 text-sm`}
                  />
                  <button
                    type="button"
                    onClick={() => setTplItens(tplItens.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500"
                    aria-label="Remover linha"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTplItens([...tplItens, { itemId: '', descricao: '', quantidade: '1' }])}
                className="text-xs text-primary-500 self-start"
              >
                <i className="ri-add-line"></i> Adicionar item
              </button>
            </div>
            <Button type="submit">Salvar modelo</Button>
          </form>

          <div className="border-t border-gray-100 dark:border-[#172036] pt-3">
            {modelos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum modelo ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-100 dark:divide-[#172036]">
                {modelos.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-black dark:text-white">
                      {m.nome} <span className="text-xs text-gray-400">({m.itens.length} itens)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removerTemplate(m.id)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Excluir"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
