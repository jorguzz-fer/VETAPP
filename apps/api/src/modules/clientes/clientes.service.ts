import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, responsaveis } from '../../database/schema';
import type {
  AnimalDto,
  CreateAnimalDto,
  CreateResponsavelDto,
  ListResponsaveisDto,
  OkDto,
  ResponsavelComAnimaisDto,
  ResponsavelDto,
  UpdateAnimalDto,
  UpdateResponsavelDto,
} from './clientes.dto';

interface ListOpts {
  search?: string;
  page: number;
  pageSize: number;
}

// Todas as operações são escopadas ao tenant via withTenant (RLS reforça no banco).
@Injectable()
export class ClientesService {
  constructor(private readonly database: DatabaseService) {}

  async listResponsaveis(tenantId: string, opts: ListOpts): Promise<ListResponsaveisDto> {
    const { search, page, pageSize } = opts;
    return this.database.withTenant(tenantId, async (tx) => {
      // Busca por nome OU telefone (first-class — docs/spec/05 §2.1).
      const where = search
        ? and(
            eq(responsaveis.tenantId, tenantId),
            or(ilike(responsaveis.nome, `%${search}%`), ilike(responsaveis.telefone, `%${search}%`)),
          )
        : eq(responsaveis.tenantId, tenantId);

      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(responsaveis)
        .where(where);

      const items = await tx
        .select()
        .from(responsaveis)
        .where(where)
        .orderBy(desc(responsaveis.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { items, total, page, pageSize };
    });
  }

  async createResponsavel(tenantId: string, dto: CreateResponsavelDto): Promise<ResponsavelDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx.insert(responsaveis).values({ ...dto, tenantId }).returning();
      return row;
    });
  }

  async getFicha(tenantId: string, id: string): Promise<ResponsavelComAnimaisDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, id) });
      if (!resp) throw new NotFoundException('Responsável não encontrado');
      const pets = await tx
        .select()
        .from(animais)
        .where(eq(animais.responsavelId, id))
        .orderBy(desc(animais.createdAt));
      return { ...resp, animais: pets } as ResponsavelComAnimaisDto;
    });
  }

  async updateResponsavel(tenantId: string, id: string, dto: UpdateResponsavelDto): Promise<ResponsavelDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(responsaveis)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(responsaveis.id, id))
        .returning();
      if (!row) throw new NotFoundException('Responsável não encontrado');
      return row;
    });
  }

  async deleteResponsavel(tenantId: string, id: string): Promise<OkDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(responsaveis).where(eq(responsaveis.id, id)).returning({ id: responsaveis.id });
      if (rows.length === 0) throw new NotFoundException('Responsável não encontrado');
      return { ok: true };
    });
  }

  async createAnimal(tenantId: string, responsavelId: string, dto: CreateAnimalDto): Promise<AnimalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      if (!resp) throw new NotFoundException('Responsável não encontrado');
      const [row] = await tx.insert(animais).values({ ...dto, tenantId, responsavelId }).returning();
      return row as AnimalDto;
    });
  }

  async getAnimal(tenantId: string, id: string): Promise<AnimalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const row = await tx.query.animais.findFirst({ where: eq(animais.id, id) });
      if (!row) throw new NotFoundException('Animal não encontrado');
      return row as AnimalDto;
    });
  }

  async updateAnimal(tenantId: string, id: string, dto: UpdateAnimalDto): Promise<AnimalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(animais)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(animais.id, id))
        .returning();
      if (!row) throw new NotFoundException('Animal não encontrado');
      return row as AnimalDto;
    });
  }

  async deleteAnimal(tenantId: string, id: string): Promise<OkDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(animais).where(eq(animais.id, id)).returning({ id: animais.id });
      if (rows.length === 0) throw new NotFoundException('Animal não encontrado');
      return { ok: true };
    });
  }
}
