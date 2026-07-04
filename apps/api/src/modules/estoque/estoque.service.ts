import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNotNull, lte, or, sql } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import { estoqueMovimentos, itensCatalogo } from '../../database/schema';
import type {
  CreateMovimentoDto,
  MovimentoDto,
  MovimentoResultDto,
  SaldoItemDto,
  VencimentoDto,
} from './estoque.dto';

// Estoque fase 1: saldo derivado das movimentações; serviços não têm saldo físico
// (doc 13 §2.2). Baixa automática do clínico e depósitos/lotes ficam para a fase 2.
@Injectable()
export class EstoqueService {
  constructor(private readonly database: DatabaseService) {}

  /** Saldo consolidado por item estocável (serviços ficam de fora — doc 13 §2.2). */
  async listSaldos(tenantId: string, search?: string, apenasBaixo = false): Promise<SaldoItemDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(itensCatalogo.tenantId, tenantId), eq(itensCatalogo.ativo, true)];
      // Serviços não são estocáveis.
      conds.push(sql`${itensCatalogo.tipo} <> 'servico'`);
      if (search) {
        conds.push(or(ilike(itensCatalogo.nome, `%${search}%`), ilike(itensCatalogo.codigo, `%${search}%`))!);
      }
      const saldoExpr = sql<number>`coalesce(sum(${estoqueMovimentos.quantidade}), 0)::int`;
      const rows = await tx
        .select({
          itemId: itensCatalogo.id,
          codigo: itensCatalogo.codigo,
          nome: itensCatalogo.nome,
          tipo: itensCatalogo.tipo,
          estoqueMinimo: itensCatalogo.estoqueMinimo,
          saldo: saldoExpr,
        })
        .from(itensCatalogo)
        .leftJoin(estoqueMovimentos, eq(estoqueMovimentos.itemId, itensCatalogo.id))
        .where(and(...conds))
        .groupBy(itensCatalogo.id)
        .orderBy(itensCatalogo.codigo)
        .limit(300);

      const saldos = rows.map((r) => ({
        ...r,
        abaixoDoMinimo: r.estoqueMinimo > 0 && r.saldo < r.estoqueMinimo,
      }));
      return apenasBaixo ? saldos.filter((s) => s.abaixoDoMinimo) : saldos;
    });
  }

  /** Histórico de movimentações de um item (mais recentes primeiro). */
  async listMovimentos(tenantId: string, itemId: string): Promise<MovimentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(estoqueMovimentos)
        .where(eq(estoqueMovimentos.itemId, itemId))
        .orderBy(desc(estoqueMovimentos.createdAt))
        .limit(200);
      return rows.map((r) => this.toDto(r));
    });
  }

  /** Registra entrada/saida/ajuste. Não permite saldo negativo (sem "vender sem estoque" ainda). */
  async registrar(tenantId: string, dto: CreateMovimentoDto): Promise<MovimentoResultDto> {
    const delta = this.deltaFrom(dto);
    return this.database.withTenant(tenantId, async (tx) => {
      const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, dto.itemId) });
      if (!item) throw new NotFoundException('Item não encontrado');
      if (item.tipo === 'servico') throw new BadRequestException('Serviços não controlam estoque');

      const saldoAtual = await this.saldoDe(tx, dto.itemId);
      if (saldoAtual + delta < 0) {
        throw new BadRequestException(`Estoque insuficiente (saldo ${saldoAtual}, movimento ${delta})`);
      }

      const [mov] = await tx
        .insert(estoqueMovimentos)
        .values({
          tenantId,
          itemId: dto.itemId,
          tipo: dto.tipo,
          quantidade: delta,
          custoCentavos: dto.tipo === 'entrada' ? dto.custoCentavos ?? null : null,
          // Lote/validade só fazem sentido na entrada.
          lote: dto.tipo === 'entrada' ? dto.lote ?? null : null,
          validade: dto.tipo === 'entrada' ? dto.validade ?? null : null,
          motivo: dto.motivo ?? null,
        })
        .returning();
      return { ...this.toDto(mov), saldoAtual: saldoAtual + delta };
    });
  }

  /** Define o ponto de reposição (estoque mínimo) do item. */
  async definirMinimo(tenantId: string, itemId: string, estoqueMinimo: number): Promise<SaldoItemDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      // Atualiza e calcula o saldo na MESMA transação: evita retornar "não
      // encontrado" quando o item é serviço ou está além do limite de listSaldos.
      const [row] = await tx
        .update(itensCatalogo)
        .set({ estoqueMinimo, updatedAt: new Date() })
        .where(eq(itensCatalogo.id, itemId))
        .returning({
          itemId: itensCatalogo.id,
          codigo: itensCatalogo.codigo,
          nome: itensCatalogo.nome,
          tipo: itensCatalogo.tipo,
          estoqueMinimo: itensCatalogo.estoqueMinimo,
        });
      if (!row) throw new NotFoundException('Item não encontrado');
      const saldo = await this.saldoDe(tx, itemId);
      return { ...row, saldo, abaixoDoMinimo: row.estoqueMinimo > 0 && saldo < row.estoqueMinimo };
    });
  }

  /** Converte a quantidade informada no delta com sinal aplicado ao saldo. */
  private deltaFrom(dto: CreateMovimentoDto): number {
    if (!Number.isInteger(dto.quantidade)) throw new BadRequestException('Quantidade inválida');
    if (dto.tipo === 'ajuste') {
      if (dto.quantidade === 0) throw new BadRequestException('Ajuste não pode ser zero');
      return dto.quantidade;
    }
    if (dto.quantidade <= 0) throw new BadRequestException('Quantidade deve ser positiva');
    return dto.tipo === 'saida' ? -dto.quantidade : dto.quantidade;
  }

  private async saldoDe(tx: Database, itemId: string): Promise<number> {
    const [row] = await tx
      .select({ saldo: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade}), 0)::int` })
      .from(estoqueMovimentos)
      .where(eq(estoqueMovimentos.itemId, itemId));
    return row?.saldo ?? 0;
  }

  /**
   * Lotes com validade dentro da janela (`dias`, default 90) — alerta de vencimento.
   * MVP: lista as ENTRADAS com validade no período (não desconta consumo por lote —
   * rastreio FIFO por lote é fase 3). Mais próximas de vencer primeiro.
   */
  async listVencimentos(tenantId: string, dias = 90): Promise<VencimentoDto[]> {
    const janela = Math.min(Math.max(dias, 1), 365);
    const hoje = new Date();
    const limite = new Date(hoje.getTime() + janela * 24 * 60 * 60 * 1000);
    const limiteStr = limite.toISOString().slice(0, 10);
    const hojeStr = hoje.toISOString().slice(0, 10);

    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          itemId: estoqueMovimentos.itemId,
          codigo: itensCatalogo.codigo,
          nome: itensCatalogo.nome,
          lote: estoqueMovimentos.lote,
          validade: estoqueMovimentos.validade,
          quantidade: estoqueMovimentos.quantidade,
        })
        .from(estoqueMovimentos)
        .innerJoin(itensCatalogo, eq(itensCatalogo.id, estoqueMovimentos.itemId))
        .where(
          and(
            eq(estoqueMovimentos.tipo, 'entrada'),
            isNotNull(estoqueMovimentos.validade),
            lte(estoqueMovimentos.validade, limiteStr),
          ),
        )
        .orderBy(asc(estoqueMovimentos.validade))
        .limit(300);

      const umDia = 24 * 60 * 60 * 1000;
      return rows.map((r) => ({
        itemId: r.itemId,
        codigo: r.codigo,
        nome: r.nome,
        lote: r.lote,
        validade: r.validade as string,
        quantidade: r.quantidade,
        diasParaVencer: Math.round(
          (new Date(r.validade as string).getTime() - new Date(hojeStr).getTime()) / umDia,
        ),
      }));
    });
  }

  private toDto(r: typeof estoqueMovimentos.$inferSelect): MovimentoDto {
    return {
      id: r.id,
      itemId: r.itemId,
      tipo: r.tipo,
      quantidade: r.quantidade,
      custoCentavos: r.custoCentavos,
      lote: r.lote,
      validade: r.validade,
      motivo: r.motivo,
      criadoEm: r.createdAt as unknown as string,
    };
  }
}
