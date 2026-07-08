import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import {
  animais,
  estoqueMovimentos,
  internacaoBoxes,
  internacaoExecucoes,
  internacaoMotivos,
  internacaoParametros,
  internacoes,
  itensCatalogo,
  modelosPrescricao,
  modelosPrescricaoItens,
  prontuarioEventos,
  responsaveis,
} from '../../database/schema';
import { FaturamentoService } from '../financeiro/faturamento.service';
import { StorageService } from '../storage/storage.service';
import type {
  AdmitirDto,
  AltaDto,
  CriarItemListaDto,
  CriarModeloPrescricaoDto,
  ExecucaoDto,
  ExecutarResultDto,
  InternacaoDetalheDto,
  InternacaoResumoDto,
  ItemListaDto,
  ModeloPrescricaoDto,
  ParametroDto,
  PrescreverDto,
  RegistrarParametroDto,
} from './internacao.dto';

// Tipos de item do catálogo com saldo físico (mesma regra do módulo Estoque).
const TIPOS_ESTOCAVEIS = new Set(['produto', 'medicamento', 'vacina']);

// Internação fase 1 (doc 05 §9): admissão explícita → mapa de execução →
// executar = baixa de estoque + faturamento automático → alta.
@Injectable()
export class InternacaoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly faturamento: FaturamentoService,
    private readonly storage: StorageService,
  ) {}

  // ───────── Listas gerenciadas da admissão (motivos/boxes) ─────────

  listMotivos(tenantId: string): Promise<ItemListaDto[]> {
    return this.listaSimples(tenantId, internacaoMotivos);
  }

  criarMotivo(tenantId: string, dto: CriarItemListaDto): Promise<ItemListaDto> {
    return this.criarItemLista(tenantId, internacaoMotivos, dto.nome);
  }

  listBoxes(tenantId: string): Promise<ItemListaDto[]> {
    return this.listaSimples(tenantId, internacaoBoxes);
  }

  criarBox(tenantId: string, dto: CriarItemListaDto): Promise<ItemListaDto> {
    return this.criarItemLista(tenantId, internacaoBoxes, dto.nome);
  }

  renomearMotivo(tenantId: string, id: string, nome: string): Promise<ItemListaDto> {
    return this.renomearItemLista(tenantId, internacaoMotivos, id, nome);
  }

  removerMotivo(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.removerItemLista(tenantId, internacaoMotivos, id);
  }

  renomearBox(tenantId: string, id: string, nome: string): Promise<ItemListaDto> {
    return this.renomearItemLista(tenantId, internacaoBoxes, id, nome);
  }

  removerBox(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.removerItemLista(tenantId, internacaoBoxes, id);
  }

  private renomearItemLista(
    tenantId: string,
    tabela: typeof internacaoMotivos | typeof internacaoBoxes,
    id: string,
    nomeRaw: string,
  ): Promise<ItemListaDto> {
    const nome = nomeRaw.trim();
    if (!nome) throw new BadRequestException('Nome obrigatório');
    return this.database.withTenant(tenantId, async (tx) => {
      const dup = await tx
        .select({ id: tabela.id })
        .from(tabela)
        .where(and(sql`lower(${tabela.nome}) = lower(${nome})`, ne(tabela.id, id)))
        .limit(1);
      if (dup[0]) throw new ConflictException('Já existe um item com esse nome');
      const [row] = await tx
        .update(tabela)
        .set({ nome })
        .where(eq(tabela.id, id))
        .returning({ id: tabela.id, nome: tabela.nome });
      if (!row) throw new NotFoundException('Item não encontrado');
      return row;
    });
  }

  private removerItemLista(
    tenantId: string,
    tabela: typeof internacaoMotivos | typeof internacaoBoxes,
    id: string,
  ): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(tabela).where(eq(tabela.id, id)).returning({ id: tabela.id });
      if (rows.length === 0) throw new NotFoundException('Item não encontrado');
      return { ok: true };
    });
  }

  private listaSimples(
    tenantId: string,
    tabela: typeof internacaoMotivos | typeof internacaoBoxes,
  ): Promise<ItemListaDto[]> {
    return this.database.withTenant(tenantId, (tx) =>
      tx.select({ id: tabela.id, nome: tabela.nome }).from(tabela).orderBy(asc(tabela.nome)).limit(500),
    );
  }

  /** Cria o item se não existir (dedup case-insensitive) — nunca duplica. */
  private criarItemLista(
    tenantId: string,
    tabela: typeof internacaoMotivos | typeof internacaoBoxes,
    nomeRaw: string,
  ): Promise<ItemListaDto> {
    const nome = nomeRaw.trim();
    if (!nome) throw new BadRequestException('Nome obrigatório');
    return this.database.withTenant(tenantId, async (tx) => {
      const existente = await tx
        .select({ id: tabela.id, nome: tabela.nome })
        .from(tabela)
        .where(sql`lower(${tabela.nome}) = lower(${nome})`)
        .limit(1);
      if (existente[0]) return existente[0];
      const [row] = await tx.insert(tabela).values({ tenantId, nome }).returning({ id: tabela.id, nome: tabela.nome });
      return row;
    });
  }

  // ───────── Modelos de prescrição (doc 05 §9.6) ─────────

  async listModelosPrescricao(tenantId: string): Promise<ModeloPrescricaoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const modelos = await tx
        .select({ id: modelosPrescricao.id, nome: modelosPrescricao.nome })
        .from(modelosPrescricao)
        .orderBy(asc(modelosPrescricao.nome))
        .limit(200);
      if (modelos.length === 0) return [];
      const itens = await tx
        .select({
          modeloId: modelosPrescricaoItens.modeloId,
          itemId: modelosPrescricaoItens.itemId,
          descricao: modelosPrescricaoItens.descricao,
          quantidade: modelosPrescricaoItens.quantidade,
        })
        .from(modelosPrescricaoItens)
        .where(inArray(modelosPrescricaoItens.modeloId, modelos.map((m) => m.id)));
      return modelos.map((m) => ({
        id: m.id,
        nome: m.nome,
        itens: itens
          .filter((i) => i.modeloId === m.id)
          .map((i) => ({ itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade })),
      }));
    });
  }

  async criarModeloPrescricao(tenantId: string, dto: CriarModeloPrescricaoDto): Promise<ModeloPrescricaoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [modelo] = await tx.insert(modelosPrescricao).values({ tenantId, nome: dto.nome }).returning();
      const itensOut: { itemId: string | null; descricao: string; quantidade: number }[] = [];
      for (const it of dto.itens) {
        let descricao = it.descricao?.trim();
        if (it.itemId) {
          const cat = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, it.itemId) });
          if (!cat) throw new NotFoundException('Item do catálogo não encontrado');
          descricao = descricao || cat.nome;
        }
        if (!descricao) throw new BadRequestException('Cada item precisa de descrição ou item de catálogo');
        const quantidade = it.quantidade ?? 1;
        await tx
          .insert(modelosPrescricaoItens)
          .values({ tenantId, modeloId: modelo.id, itemId: it.itemId ?? null, descricao, quantidade });
        itensOut.push({ itemId: it.itemId ?? null, descricao, quantidade });
      }
      return { id: modelo.id, nome: modelo.nome, itens: itensOut };
    });
  }

  async removerModeloPrescricao(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .delete(modelosPrescricao)
        .where(eq(modelosPrescricao.id, id))
        .returning({ id: modelosPrescricao.id });
      if (rows.length === 0) throw new NotFoundException('Modelo não encontrado');
      return { ok: true };
    });
  }

  /** Aplica um modelo: cria uma execução (linha do mapa) para cada item do modelo. */
  async aplicarModelo(tenantId: string, internacaoId: string, modeloId: string): Promise<ExecucaoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { internacao } = await this.carregar(tx, tenantId, internacaoId);
      if (internacao.status !== 'internado') throw new BadRequestException('Internação não está ativa');
      const modelo = await tx.query.modelosPrescricao.findFirst({ where: eq(modelosPrescricao.id, modeloId) });
      if (!modelo) throw new NotFoundException('Modelo não encontrado');
      const itens = await tx
        .select()
        .from(modelosPrescricaoItens)
        .where(eq(modelosPrescricaoItens.modeloId, modeloId));
      const criadas: ExecucaoDto[] = [];
      for (const it of itens) {
        let valor: number | null = null;
        if (it.itemId) {
          const cat = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, it.itemId) });
          valor = cat?.precoCentavos ?? null;
        }
        const [exec] = await tx
          .insert(internacaoExecucoes)
          .values({
            tenantId,
            internacaoId,
            itemId: it.itemId,
            descricao: it.descricao,
            quantidade: it.quantidade,
            valorCentavos: valor,
          })
          .returning();
        criadas.push(this.toExecucao(exec));
      }
      return criadas;
    });
  }

  // ───────── Parâmetros clínicos (doc 05 §9.5) ─────────

  async registrarParametro(
    tenantId: string,
    internacaoId: string,
    dto: RegistrarParametroDto,
  ): Promise<ParametroDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      await this.carregar(tx, tenantId, internacaoId); // valida existência + tenant
      const [row] = await tx
        .insert(internacaoParametros)
        .values({
          tenantId,
          internacaoId,
          pesoG: dto.pesoKg != null ? Math.round(dto.pesoKg * 1000) : null,
          temperaturaDecimos: dto.temperaturaC != null ? Math.round(dto.temperaturaC * 10) : null,
          freqCardiaca: dto.fc ?? null,
          freqRespiratoria: dto.fr ?? null,
          observacao: dto.observacao?.trim() || null,
        })
        .returning();
      return this.toParametro(row);
    });
  }

  async listParametros(tenantId: string, internacaoId: string): Promise<ParametroDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(internacaoParametros)
        .where(eq(internacaoParametros.internacaoId, internacaoId))
        .orderBy(desc(internacaoParametros.registradoEm))
        .limit(200);
      return rows.map((r) => this.toParametro(r));
    });
  }

  private toParametro(r: typeof internacaoParametros.$inferSelect): ParametroDto {
    return {
      id: r.id,
      pesoKg: r.pesoG != null ? r.pesoG / 1000 : null,
      temperaturaC: r.temperaturaDecimos != null ? r.temperaturaDecimos / 10 : null,
      fc: r.freqCardiaca,
      fr: r.freqRespiratoria,
      observacao: r.observacao,
      registradoEm: (r.registradoEm as Date).toISOString(),
    };
  }

  async admitir(tenantId: string, dto: AdmitirDto): Promise<InternacaoResumoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const animal = await tx.query.animais.findFirst({ where: eq(animais.id, dto.animalId) });
      if (!animal) throw new NotFoundException('Animal não encontrado');

      const ativa = await tx.query.internacoes.findFirst({
        where: and(eq(internacoes.animalId, dto.animalId), eq(internacoes.status, 'internado')),
      });
      if (ativa) throw new ConflictException('Animal já está internado');

      const [nova] = await tx
        .insert(internacoes)
        .values({
          tenantId,
          animalId: dto.animalId,
          motivo: dto.motivo,
          box: dto.box ?? null,
          altaPrevistaEm: dto.altaPrevista ?? null,
        })
        .returning();

      // Admissão vira evento na linha do tempo do animal (doc 05 §2.3).
      await tx.insert(prontuarioEventos).values({
        tenantId,
        animalId: dto.animalId,
        tipo: 'internacao',
        descricao: `Admissão: ${dto.motivo}${dto.box ? ` (${dto.box})` : ''}`,
      });

      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, animal.responsavelId) });
      return this.toResumo(nova, animal.nome, animal.responsavelId, resp?.nome ?? '', 0, animal.fotoKey);
    });
  }

  async list(tenantId: string, status?: string): Promise<InternacaoResumoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(internacoes.tenantId, tenantId)];
      if (status) conds.push(eq(internacoes.status, status));
      const rows = await tx
        .select({
          i: internacoes,
          animalNome: animais.nome,
          fotoKey: animais.fotoKey,
          responsavelId: animais.responsavelId,
          responsavelNome: responsaveis.nome,
          pendentes: sql<number>`(select count(*)::int from ${internacaoExecucoes}
            where ${internacaoExecucoes.internacaoId} = ${internacoes.id}
              and ${internacaoExecucoes.executadaEm} is null)`,
        })
        .from(internacoes)
        .innerJoin(animais, eq(animais.id, internacoes.animalId))
        .innerJoin(responsaveis, eq(responsaveis.id, animais.responsavelId))
        .where(and(...conds))
        .orderBy(desc(internacoes.entradaEm))
        .limit(200);
      return Promise.all(
        rows.map((r) => this.toResumo(r.i, r.animalNome, r.responsavelId, r.responsavelNome, r.pendentes, r.fotoKey)),
      );
    });
  }

  async detalhe(tenantId: string, id: string): Promise<InternacaoDetalheDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const base = await this.carregar(tx, tenantId, id);
      const execucoes = await tx
        .select()
        .from(internacaoExecucoes)
        .where(eq(internacaoExecucoes.internacaoId, id))
        .orderBy(desc(internacaoExecucoes.createdAt));
      const pendentes = execucoes.filter((e) => !e.executadaEm).length;
      const resumo = await this.toResumo(
        base.internacao,
        base.animal.nome,
        base.animal.responsavelId,
        base.responsavelNome,
        pendentes,
        base.animal.fotoKey,
      );
      return {
        ...resumo,
        observacoes: base.internacao.observacoes,
        execucoes: execucoes.map((e) => this.toExecucao(e)),
      };
    });
  }

  /** Prescreve um item/procedimento no mapa de execução. */
  async prescrever(tenantId: string, id: string, dto: PrescreverDto): Promise<ExecucaoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { internacao } = await this.carregar(tx, tenantId, id);
      if (internacao.status !== 'internado') throw new BadRequestException('Internação não está ativa');

      let descricao = dto.descricao?.trim();
      let valor = dto.valorCentavos ?? null;
      if (dto.itemId) {
        const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, dto.itemId) });
        if (!item) throw new NotFoundException('Item do catálogo não encontrado');
        descricao = descricao || item.nome;
        valor = valor ?? item.precoCentavos;
      }
      if (!descricao) throw new BadRequestException('Informe a descrição (ou um item do catálogo)');

      const [exec] = await tx
        .insert(internacaoExecucoes)
        .values({
          tenantId,
          internacaoId: id,
          itemId: dto.itemId ?? null,
          descricao,
          quantidade: dto.quantidade ?? 1,
          valorCentavos: valor,
        })
        .returning();
      return this.toExecucao(exec);
    });
  }

  /**
   * Executa uma prescrição: marca a hora, baixa o estoque (item estocável) e
   * fatura automático (doc 05 §9.2). A execução clínica NUNCA é bloqueada por
   * falta de saldo — nesse caso registra sem movimento e sinaliza no retorno.
   */
  async executar(tenantId: string, id: string, execId: string, executorUserId?: string): Promise<ExecutarResultDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { internacao, animal } = await this.carregar(tx, tenantId, id);
      if (internacao.status !== 'internado') throw new BadRequestException('Internação não está ativa');

      const exec = await tx.query.internacaoExecucoes.findFirst({
        where: and(eq(internacaoExecucoes.id, execId), eq(internacaoExecucoes.internacaoId, id)),
      });
      if (!exec) throw new NotFoundException('Prescrição não encontrada');
      if (exec.executadaEm) throw new BadRequestException('Prescrição já executada');

      const [atualizada] = await tx
        .update(internacaoExecucoes)
        .set({ executadaEm: new Date() })
        .where(eq(internacaoExecucoes.id, execId))
        .returning();

      // Baixa de estoque quando o item é estocável e há saldo (fase 1: sem
      // permitir saldo negativo; execução clínica não é bloqueada por isso).
      let estoqueBaixado = false;
      if (exec.itemId) {
        const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, exec.itemId) });
        if (item && TIPOS_ESTOCAVEIS.has(item.tipo)) {
          const [{ saldo }] = await tx
            .select({ saldo: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade}), 0)::int` })
            .from(estoqueMovimentos)
            .where(eq(estoqueMovimentos.itemId, exec.itemId));
          if (saldo >= exec.quantidade) {
            await tx.insert(estoqueMovimentos).values({
              tenantId,
              itemId: exec.itemId,
              tipo: 'saida',
              quantidade: -exec.quantidade,
              motivo: `internação: ${exec.descricao}`,
            });
            estoqueBaixado = true;
          }
        }
      }

      // Faturamento automático na fatura aberta do responsável.
      const total = (exec.valorCentavos ?? 0) * exec.quantidade;
      let faturado = false;
      if (total > 0) {
        await this.faturamento.lancar(tx, tenantId, animal.responsavelId, {
          descricao: `internação: ${exec.descricao}${exec.quantidade > 1 ? ` x${exec.quantidade}` : ''}`,
          valorCentavos: total,
          itemId: exec.itemId,
          // Quem executa é comissionado (doc 05 §5/§9.2).
          profissionalId: executorUserId ?? null,
        });
        faturado = true;
      }

      return { ...this.toExecucao(atualizada), estoqueBaixado, faturado };
    });
  }

  /** Alta: encerra a internação e registra na linha do tempo do animal. */
  async alta(tenantId: string, id: string, dto: AltaDto): Promise<InternacaoResumoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const { internacao, animal, responsavelNome } = await this.carregar(tx, tenantId, id);
      if (internacao.status !== 'internado') throw new BadRequestException('Internação não está ativa');

      const pendentes = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(internacaoExecucoes)
        .where(and(eq(internacaoExecucoes.internacaoId, id), isNull(internacaoExecucoes.executadaEm)));

      const [atualizada] = await tx
        .update(internacoes)
        .set({ status: 'alta', altaEm: new Date(), observacoes: dto.observacoes ?? null, updatedAt: new Date() })
        .where(eq(internacoes.id, id))
        .returning();

      await tx.insert(prontuarioEventos).values({
        tenantId,
        animalId: internacao.animalId,
        tipo: 'internacao',
        descricao: `Alta${dto.observacoes ? `: ${dto.observacoes}` : ''}`,
      });

      return this.toResumo(atualizada, animal.nome, animal.responsavelId, responsavelNome, pendentes[0]?.n ?? 0, animal.fotoKey);
    });
  }

  private async carregar(tx: Database, _tenantId: string, id: string) {
    const internacao = await tx.query.internacoes.findFirst({ where: eq(internacoes.id, id) });
    if (!internacao) throw new NotFoundException('Internação não encontrada');
    const animal = await tx.query.animais.findFirst({ where: eq(animais.id, internacao.animalId) });
    if (!animal) throw new NotFoundException('Animal não encontrado');
    const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, animal.responsavelId) });
    return { internacao, animal, responsavelNome: resp?.nome ?? '' };
  }

  private async toResumo(
    i: typeof internacoes.$inferSelect,
    animalNome: string,
    responsavelId: string,
    responsavelNome: string,
    pendentes: number,
    fotoKey?: string | null,
  ): Promise<InternacaoResumoDto> {
    return {
      id: i.id,
      animalId: i.animalId,
      animalNome,
      responsavelId,
      responsavelNome,
      motivo: i.motivo,
      box: i.box,
      status: i.status,
      entradaEm: i.entradaEm as unknown as string,
      altaPrevistaEm: (i.altaPrevistaEm as unknown as string | null) ?? null,
      altaEm: (i.altaEm as unknown as string | null) ?? null,
      pendentes,
      fotoUrl: await this.storage.signDownload(fotoKey ?? null),
    };
  }

  private toExecucao(e: typeof internacaoExecucoes.$inferSelect): ExecucaoDto {
    return {
      id: e.id,
      itemId: e.itemId,
      descricao: e.descricao,
      quantidade: e.quantidade,
      valorCentavos: e.valorCentavos,
      executadaEm: (e.executadaEm as unknown as string | null) ?? null,
    };
  }
}
