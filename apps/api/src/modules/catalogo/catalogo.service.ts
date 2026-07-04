import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { itensCatalogo, precoHistorico, users } from '../../database/schema';
import type { CreateItemDto, ItemCatalogoDto, PrecoHistoricoDto, UpdateItemDto } from './catalogo.dto';

@Injectable()
export class CatalogoService {
  constructor(private readonly database: DatabaseService) {}

  async list(tenantId: string, search?: string, tipo?: string, incluirInativos = false): Promise<ItemCatalogoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(itensCatalogo.tenantId, tenantId)];
      if (!incluirInativos) conds.push(eq(itensCatalogo.ativo, true));
      if (tipo) conds.push(eq(itensCatalogo.tipo, tipo));
      if (search) {
        // Busca por nome OU código (itens por código — doc 05 §4.11).
        conds.push(or(ilike(itensCatalogo.nome, `%${search}%`), ilike(itensCatalogo.codigo, `%${search}%`))!);
      }
      return tx
        .select()
        .from(itensCatalogo)
        .where(and(...conds))
        .orderBy(asc(itensCatalogo.codigo))
        .limit(200);
    });
  }

  async create(tenantId: string, dto: CreateItemDto, actorUserId?: string): Promise<ItemCatalogoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const existente = await tx.query.itensCatalogo.findFirst({
        where: and(eq(itensCatalogo.tenantId, tenantId), eq(itensCatalogo.codigo, dto.codigo)),
      });
      if (existente) throw new ConflictException(`Código "${dto.codigo}" já está em uso`);
      const [row] = await tx.insert(itensCatalogo).values({ ...dto, tenantId }).returning();
      // Vigência inicial: primeiro preço do item (doc 13 §2).
      await tx.insert(precoHistorico).values({
        tenantId,
        itemId: row.id,
        precoCentavos: row.precoCentavos,
        alteradoPor: actorUserId ?? null,
      });
      return row;
    });
  }

  async update(tenantId: string, id: string, dto: UpdateItemDto, actorUserId?: string): Promise<ItemCatalogoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const atual = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, id) });
      if (!atual) throw new NotFoundException('Item não encontrado');
      // Troca de código revalida unicidade (como no create) → 409 amigável em vez
      // de estourar 500 na violação do índice único do banco.
      if (dto.codigo) {
        const conflito = await tx.query.itensCatalogo.findFirst({
          where: and(
            eq(itensCatalogo.tenantId, tenantId),
            eq(itensCatalogo.codigo, dto.codigo),
            ne(itensCatalogo.id, id),
          ),
        });
        if (conflito) throw new ConflictException(`Código "${dto.codigo}" já está em uso`);
      }
      const [row] = await tx
        .update(itensCatalogo)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(itensCatalogo.id, id))
        .returning();
      // Mudança de preço → nova vigência no histórico (só quando o valor muda).
      if (dto.precoCentavos !== undefined && dto.precoCentavos !== atual.precoCentavos) {
        await tx.insert(precoHistorico).values({
          tenantId,
          itemId: id,
          precoCentavos: dto.precoCentavos,
          alteradoPor: actorUserId ?? null,
        });
      }
      return row;
    });
  }

  /** Histórico/vigência de preços de um item (mais recente primeiro). */
  async listPrecoHistorico(tenantId: string, itemId: string): Promise<PrecoHistoricoDto[]> {
    const rows = await this.database.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(precoHistorico)
        .where(eq(precoHistorico.itemId, itemId))
        .orderBy(desc(precoHistorico.vigenteDesde))
        .limit(100),
    );
    // Nomes dos autores (users é global).
    const ids = [...new Set(rows.map((r) => r.alteradoPor).filter((x): x is string => !!x))];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const us = await this.database.db.query.users.findMany({ where: inArray(users.id, ids) });
      for (const u of us) nomes.set(u.id, u.name);
    }
    return rows.map((r) => ({
      id: r.id,
      precoCentavos: r.precoCentavos,
      vigenteDesde: (r.vigenteDesde as Date).toISOString(),
      alteradoPor: r.alteradoPor,
      alteradoPorNome: r.alteradoPor ? nomes.get(r.alteradoPor) ?? null : null,
    }));
  }

  async remove(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(itensCatalogo).where(eq(itensCatalogo.id, id)).returning({ id: itensCatalogo.id });
      if (rows.length === 0) throw new NotFoundException('Item não encontrado');
      return { ok: true };
    });
  }
}
