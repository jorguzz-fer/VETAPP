import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, responsaveis } from '../../database/schema';
import type {
  AnimalDto,
  CreateAnimalDto,
  CreateResponsavelDto,
  ResponsavelComAnimaisDto,
  ResponsavelDto,
} from './clientes.dto';

// Todas as operações são escopadas ao tenant via withTenant (RLS reforça no banco).
@Injectable()
export class ClientesService {
  constructor(private readonly database: DatabaseService) {}

  async listResponsaveis(tenantId: string, search?: string): Promise<ResponsavelDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const where = search
        ? and(eq(responsaveis.tenantId, tenantId), ilike(responsaveis.nome, `%${search}%`))
        : eq(responsaveis.tenantId, tenantId);
      return tx
        .select()
        .from(responsaveis)
        .where(where)
        .orderBy(desc(responsaveis.createdAt))
        .limit(100);
    });
  }

  async createResponsavel(tenantId: string, dto: CreateResponsavelDto): Promise<ResponsavelDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .insert(responsaveis)
        .values({ ...dto, tenantId })
        .returning();
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

  async createAnimal(tenantId: string, responsavelId: string, dto: CreateAnimalDto): Promise<AnimalDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      if (!resp) throw new NotFoundException('Responsável não encontrado');
      const [row] = await tx
        .insert(animais)
        .values({ ...dto, tenantId, responsavelId })
        .returning();
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
}
