import { BadRequestException, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { agendamentos } from '../../database/schema';
import type { AgendamentoDto, CreateAgendamentoDto } from './agenda.dto';

@Injectable()
export class AgendaService {
  constructor(private readonly database: DatabaseService) {}

  async list(tenantId: string, from?: string, to?: string): Promise<AgendamentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(agendamentos.tenantId, tenantId)];
      if (from) conds.push(gte(agendamentos.inicio, new Date(from)));
      if (to) conds.push(lte(agendamentos.inicio, new Date(to)));
      const rows = await tx
        .select()
        .from(agendamentos)
        .where(and(...conds))
        .orderBy(asc(agendamentos.inicio));
      return rows.map(this.toDto);
    });
  }

  async create(tenantId: string, dto: CreateAgendamentoDto): Promise<AgendamentoDto> {
    const inicio = new Date(dto.inicio);
    const fim = new Date(dto.fim);
    if (fim <= inicio) throw new BadRequestException('Fim deve ser depois do início');

    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .insert(agendamentos)
        .values({
          tenantId,
          titulo: dto.titulo,
          inicio,
          fim,
          animalId: dto.animalId ?? null,
          responsavelId: dto.responsavelId ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning();
      return this.toDto(row);
    });
  }

  async cancelar(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      await tx.update(agendamentos).set({ status: 'cancelado' }).where(eq(agendamentos.id, id));
      return { ok: true };
    });
  }

  private toDto(r: typeof agendamentos.$inferSelect): AgendamentoDto {
    return {
      id: r.id,
      titulo: r.titulo,
      inicio: r.inicio as unknown as string,
      fim: r.fim as unknown as string,
      status: r.status,
      animalId: r.animalId,
      responsavelId: r.responsavelId,
      observacoes: r.observacoes,
    };
  }
}
