import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, ne, or } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { itensCatalogo } from '../../database/schema';
import type { CreateItemDto, ItemCatalogoDto, UpdateItemDto } from './catalogo.dto';

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

  async create(tenantId: string, dto: CreateItemDto): Promise<ItemCatalogoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const existente = await tx.query.itensCatalogo.findFirst({
        where: and(eq(itensCatalogo.tenantId, tenantId), eq(itensCatalogo.codigo, dto.codigo)),
      });
      if (existente) throw new ConflictException(`Código "${dto.codigo}" já está em uso`);
      const [row] = await tx.insert(itensCatalogo).values({ ...dto, tenantId }).returning();
      return row;
    });
  }

  async update(tenantId: string, id: string, dto: UpdateItemDto): Promise<ItemCatalogoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
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
      if (!row) throw new NotFoundException('Item não encontrado');
      return row;
    });
  }

  async remove(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(itensCatalogo).where(eq(itensCatalogo.id, id)).returning({ id: itensCatalogo.id });
      if (rows.length === 0) throw new NotFoundException('Item não encontrado');
      return { ok: true };
    });
  }
}
