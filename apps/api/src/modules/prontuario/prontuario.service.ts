import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService, type Database } from '../../database/database.service';
import { animais, faturaItens, faturas, prontuarioEventos } from '../../database/schema';
import type { CreateEventoDto, EventoDto, FaturaDto } from './prontuario.dto';

@Injectable()
export class ProntuarioService {
  constructor(private readonly database: DatabaseService) {}

  async listEventos(tenantId: string, animalId: string): Promise<EventoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(prontuarioEventos)
        .where(eq(prontuarioEventos.animalId, animalId))
        .orderBy(desc(prontuarioEventos.data));
      return rows.map((r) => ({
        id: r.id,
        animalId: r.animalId,
        tipo: r.tipo,
        descricao: r.descricao,
        valorCentavos: r.valorCentavos,
        data: r.data as unknown as string,
      }));
    });
  }

  /**
   * Registra um evento clínico e, se tiver valor e `faturar`, lança automaticamente
   * na fatura ABERTA do responsável — consolidando a cobrança (doc 04 §3). Tudo na
   * mesma transação tenant-scoped (RLS).
   */
  async createEvento(tenantId: string, animalId: string, dto: CreateEventoDto): Promise<EventoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const animal = await tx.query.animais.findFirst({ where: eq(animais.id, animalId) });
      if (!animal) throw new NotFoundException('Animal não encontrado');

      const [evento] = await tx
        .insert(prontuarioEventos)
        .values({
          tenantId,
          animalId,
          tipo: dto.tipo,
          descricao: dto.descricao,
          valorCentavos: dto.valorCentavos ?? null,
        })
        .returning();

      const deveFaturar = (dto.valorCentavos ?? 0) > 0 && dto.faturar !== false;
      if (deveFaturar) {
        const fatura = await this.faturaAbertaOuNova(tx, tenantId, animal.responsavelId);
        await tx.insert(faturaItens).values({
          tenantId,
          faturaId: fatura.id,
          eventoId: evento.id,
          descricao: `${dto.tipo}: ${dto.descricao}`,
          valorCentavos: dto.valorCentavos!,
        });
        await tx
          .update(faturas)
          .set({
            totalCentavos: sql`${faturas.totalCentavos} + ${dto.valorCentavos!}`,
            updatedAt: new Date(),
          })
          .where(eq(faturas.id, fatura.id));
      }

      return {
        id: evento.id,
        animalId: evento.animalId,
        tipo: evento.tipo,
        descricao: evento.descricao,
        valorCentavos: evento.valorCentavos,
        data: evento.data as unknown as string,
      };
    });
  }

  async getFaturaAberta(tenantId: string, responsavelId: string): Promise<FaturaDto | null> {
    return this.database.withTenant(tenantId, async (tx) => {
      const fatura = await tx.query.faturas.findFirst({
        where: and(eq(faturas.responsavelId, responsavelId), eq(faturas.status, 'aberta')),
      });
      if (!fatura) return null;
      const itens = await tx
        .select()
        .from(faturaItens)
        .where(eq(faturaItens.faturaId, fatura.id))
        .orderBy(desc(faturaItens.createdAt));
      return {
        id: fatura.id,
        responsavelId: fatura.responsavelId,
        status: fatura.status,
        totalCentavos: fatura.totalCentavos,
        itens: itens.map((i) => ({
          id: i.id,
          descricao: i.descricao,
          valorCentavos: i.valorCentavos,
          eventoId: i.eventoId,
        })),
      };
    });
  }

  private async faturaAbertaOuNova(tx: Database, tenantId: string, responsavelId: string) {
    const existente = await tx.query.faturas.findFirst({
      where: and(eq(faturas.responsavelId, responsavelId), eq(faturas.status, 'aberta')),
    });
    if (existente) return existente;
    const [nova] = await tx.insert(faturas).values({ tenantId, responsavelId }).returning();
    return nova;
  }
}
