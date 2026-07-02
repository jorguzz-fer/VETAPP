import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import { estoqueMovimentos, itensCatalogo } from '../../database/schema';
import type {
  CreateMovimentoDto,
  MovimentoDto,
  MovimentoResultDto,
  SaldoItemDto,
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
          motivo: dto.motivo ?? null,
        })
        .returning();
      return { ...this.toDto(mov), saldoAtual: saldoAtual + delta };
    });
  }

  /** Define o ponto de reposição (estoque mínimo) do item. */
  async definirMinimo(tenantId: string, itemId: string, estoqueMinimo: number): Promise<SaldoItemDto> {
    await this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(itensCatalogo)
        .set({ estoqueMinimo, updatedAt: new Date() })
        .where(eq(itensCatalogo.id, itemId))
        .returning({ id: itensCatalogo.id });
      if (!row) throw new NotFoundException('Item não encontrado');
    });
    const [saldo] = await this.listSaldos(tenantId).then((all) => all.filter((s) => s.itemId === itemId));
    if (!saldo) throw new NotFoundException('Item não encontrado');
    return saldo;
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

  private toDto(r: typeof estoqueMovimentos.$inferSelect): MovimentoDto {
    return {
      id: r.id,
      itemId: r.itemId,
      tipo: r.tipo,
      quantidade: r.quantidade,
      custoCentavos: r.custoCentavos,
      motivo: r.motivo,
      criadoEm: r.createdAt as unknown as string,
    };
  }
}
