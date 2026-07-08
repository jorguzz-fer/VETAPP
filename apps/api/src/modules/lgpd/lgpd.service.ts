import { Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  agendamentos,
  animais,
  faturaItens,
  faturas,
  prontuarioEventos,
  recebimentos,
  responsaveis,
} from '../../database/schema';
import type { LgpdExportDto } from './lgpd.dto';

// Exportação de dados do titular (LGPD — doc 09 §5 / doc 02 §6). Agrega, sob o
// contexto do tenant (RLS), tudo que a clínica guarda de um responsável: cadastro,
// pets + prontuário, faturas + itens + recebimentos e agendamentos.
@Injectable()
export class LgpdService {
  constructor(private readonly database: DatabaseService) {}

  async exportarTitular(tenantId: string, responsavelId: string): Promise<LgpdExportDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      if (!resp) throw new NotFoundException('Responsável não encontrado');

      const pets = await tx.select().from(animais).where(eq(animais.responsavelId, responsavelId));
      const petIds = pets.map((p) => p.id);

      const eventos = petIds.length
        ? await tx
            .select()
            .from(prontuarioEventos)
            .where(inArray(prontuarioEventos.animalId, petIds))
            .orderBy(desc(prontuarioEventos.data))
        : [];
      const eventosPorPet = new Map<string, unknown[]>();
      for (const ev of eventos) {
        const arr = eventosPorPet.get(ev.animalId) ?? [];
        arr.push(this.semChaves(ev, ['tenantId', 'anexoKey']));
        eventosPorPet.set(ev.animalId, arr);
      }

      const fats = await tx.select().from(faturas).where(eq(faturas.responsavelId, responsavelId));
      const fatIds = fats.map((f) => f.id);
      const itens = fatIds.length
        ? await tx.select().from(faturaItens).where(inArray(faturaItens.faturaId, fatIds))
        : [];
      const recs = fatIds.length
        ? await tx.select().from(recebimentos).where(inArray(recebimentos.faturaId, fatIds))
        : [];

      const ags = await tx.select().from(agendamentos).where(eq(agendamentos.responsavelId, responsavelId));

      return {
        // Sem Date.now() (indisponível no runtime de workflow); aqui é a app normal.
        exportadoEm: new Date().toISOString(),
        responsavelId,
        responsavel: this.semChaves(resp, ['tenantId']),
        animais: pets.map((p) => ({
          ...this.semChaves(p, ['tenantId', 'fotoKey']),
          prontuario: eventosPorPet.get(p.id) ?? [],
        })),
        faturas: fats.map((f) => ({
          ...this.semChaves(f, ['tenantId']),
          itens: itens.filter((i) => i.faturaId === f.id).map((i) => this.semChaves(i, ['tenantId'])),
          recebimentos: recs.filter((r) => r.faturaId === f.id).map((r) => this.semChaves(r, ['tenantId'])),
        })),
        agendamentos: ags.map((a) => this.semChaves(a, ['tenantId'])),
      };
    });
  }

  /** Remove chaves internas (tenant_id, keys de storage) do objeto exportado. */
  private semChaves<T extends Record<string, unknown>>(row: T, chaves: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (chaves.includes(k)) continue;
      out[k] = v instanceof Date ? v.toISOString() : v;
    }
    return out;
  }
}
