import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { agendamentos, memberships, tiposAtendimento, users } from '../../database/schema';
import type {
  AgendamentoDto,
  CreateAgendamentoDto,
  CreateTipoAtendimentoDto,
  ProfissionalDto,
  TipoAtendimentoDto,
  UpdateTipoAtendimentoDto,
} from './agenda.dto';

// Agenda avançada (doc 05 §3 + §8.5): tipos de atendimento com duração/cor,
// profissional por agendamento e filtro por profissional ("minha agenda").
// Google Agenda + IA e escala → fase 2 (doc 06).
@Injectable()
export class AgendaService {
  constructor(private readonly database: DatabaseService) {}

  async list(tenantId: string, from?: string, to?: string, profissionalId?: string): Promise<AgendamentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(agendamentos.tenantId, tenantId)];
      if (from) conds.push(gte(agendamentos.inicio, new Date(from)));
      if (to) conds.push(lte(agendamentos.inicio, new Date(to)));
      if (profissionalId) conds.push(eq(agendamentos.profissionalId, profissionalId));
      const rows = await tx
        .select({
          a: agendamentos,
          tipoNome: tiposAtendimento.nome,
          cor: tiposAtendimento.cor,
          profissionalNome: users.name,
        })
        .from(agendamentos)
        .leftJoin(tiposAtendimento, eq(tiposAtendimento.id, agendamentos.tipoAtendimentoId))
        .leftJoin(users, eq(users.id, agendamentos.profissionalId))
        .where(and(...conds))
        .orderBy(asc(agendamentos.inicio));
      return rows.map((r) => this.toDto(r.a, r.tipoNome, r.cor, r.profissionalNome));
    });
  }

  async create(tenantId: string, dto: CreateAgendamentoDto): Promise<AgendamentoDto> {
    const inicio = new Date(dto.inicio);

    return this.database.withTenant(tenantId, async (tx) => {
      // Fim explícito ou derivado da duração do tipo de atendimento (§8.5).
      let fim = dto.fim ? new Date(dto.fim) : null;
      let tipo: typeof tiposAtendimento.$inferSelect | undefined;
      if (dto.tipoAtendimentoId) {
        tipo = await tx.query.tiposAtendimento.findFirst({
          where: eq(tiposAtendimento.id, dto.tipoAtendimentoId),
        });
        if (!tipo) throw new NotFoundException('Tipo de atendimento não encontrado');
        if (!fim) fim = new Date(inicio.getTime() + tipo.duracaoMinutos * 60_000);
      }
      if (!fim) throw new BadRequestException('Informe o fim ou um tipo de atendimento');
      if (fim <= inicio) throw new BadRequestException('Fim deve ser depois do início');

      if (dto.profissionalId) {
        const membro = await tx.query.memberships.findFirst({
          where: eq(memberships.userId, dto.profissionalId),
        });
        if (!membro) throw new BadRequestException('Profissional não é membro desta clínica');
      }

      const [row] = await tx
        .insert(agendamentos)
        .values({
          tenantId,
          titulo: dto.titulo,
          inicio,
          fim,
          tipoAtendimentoId: dto.tipoAtendimentoId ?? null,
          profissionalId: dto.profissionalId ?? null,
          animalId: dto.animalId ?? null,
          responsavelId: dto.responsavelId ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning();
      return this.toDto(row, tipo?.nome ?? null, tipo?.cor ?? null, null);
    });
  }

  async updateStatus(tenantId: string, id: string, status: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(agendamentos)
        .set({ status })
        .where(eq(agendamentos.id, id))
        .returning({ id: agendamentos.id });
      if (!row) throw new NotFoundException('Agendamento não encontrado');
      return { ok: true };
    });
  }

  async cancelar(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.updateStatus(tenantId, id, 'cancelado');
  }

  /** Membros do tenant (para o seletor de profissional / "minha agenda"). */
  async listProfissionais(tenantId: string): Promise<ProfissionalDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({ userId: memberships.userId, nome: users.name, role: memberships.role })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .orderBy(asc(users.name));
      return rows;
    });
  }

  // ───────── Tipos de atendimento (doc 05 §8.5) ─────────

  async listTipos(tenantId: string, incluirInativos = false): Promise<TipoAtendimentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(tiposAtendimento.tenantId, tenantId)];
      if (!incluirInativos) conds.push(eq(tiposAtendimento.ativo, true));
      const rows = await tx
        .select()
        .from(tiposAtendimento)
        .where(and(...conds))
        .orderBy(asc(tiposAtendimento.nome));
      return rows.map(this.toTipoDto);
    });
  }

  async createTipo(tenantId: string, dto: CreateTipoAtendimentoDto): Promise<TipoAtendimentoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .insert(tiposAtendimento)
        .values({
          tenantId,
          nome: dto.nome,
          duracaoMinutos: dto.duracaoMinutos ?? 30,
          cor: dto.cor ?? null,
        })
        .returning();
      return this.toTipoDto(row);
    });
  }

  async updateTipo(tenantId: string, id: string, dto: UpdateTipoAtendimentoDto): Promise<TipoAtendimentoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(tiposAtendimento)
        .set({
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.duracaoMinutos !== undefined ? { duracaoMinutos: dto.duracaoMinutos } : {}),
          ...(dto.cor !== undefined ? { cor: dto.cor } : {}),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tiposAtendimento.id, id))
        .returning();
      if (!row) throw new NotFoundException('Tipo de atendimento não encontrado');
      return this.toTipoDto(row);
    });
  }

  private toDto(
    r: typeof agendamentos.$inferSelect,
    tipoNome: string | null,
    cor: string | null,
    profissionalNome: string | null,
  ): AgendamentoDto {
    return {
      id: r.id,
      titulo: r.titulo,
      inicio: r.inicio as unknown as string,
      fim: r.fim as unknown as string,
      status: r.status,
      tipoAtendimentoId: r.tipoAtendimentoId,
      tipoNome,
      cor,
      profissionalId: r.profissionalId,
      profissionalNome,
      animalId: r.animalId,
      responsavelId: r.responsavelId,
      observacoes: r.observacoes,
    };
  }

  private toTipoDto(r: typeof tiposAtendimento.$inferSelect): TipoAtendimentoDto {
    return { id: r.id, nome: r.nome, duracaoMinutos: r.duracaoMinutos, cor: r.cor, ativo: r.ativo };
  }
}
