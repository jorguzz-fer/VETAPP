import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  agendamentos,
  animais,
  faturaItens,
  faturas,
  notasFiscais,
  prontuarioEventos,
  recebimentos,
  tiposAtendimento,
  users,
} from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import type {
  PortalAgendamentoDto,
  PortalFaturaDetalheDto,
  PortalFaturaResumoDto,
  PortalHistoricoDto,
  PortalPetDetalheDto,
  PortalPetDto,
  PortalVacinaDto,
} from './portal.dto';

// Tipos de evento do prontuário expostos ao tutor. `observacao` (notas internas
// livres) fica de FORA por privacidade (doc 13 §5.2 — sem notas clínicas internas).
const HISTORICO_TIPOS = ['atendimento', 'vacina', 'exame', 'receita', 'internacao', 'peso'];

// Portal do tutor (doc 13 §5): leitura dos PRÓPRIOS dados. Todo acesso é escopado
// por tenant (withTenant + RLS) E por responsavelId (o tutor logado) — defesa em
// profundidade: mesmo com um id forjado, RLS + filtro barram dados de terceiros.
@Injectable()
export class PortalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private recebidoExpr = sql<number>`coalesce((select sum(${recebimentos.valorCentavos})
    from ${recebimentos} where ${recebimentos.faturaId} = ${faturas.id}), 0)::int`;

  // Nota fiscal ativa (não cancelada) mais recente da fatura, se houver.
  private notaNumeroExpr = sql<string | null>`(select ${notasFiscais.numero} from ${notasFiscais}
    where ${notasFiscais.faturaId} = ${faturas.id} and ${notasFiscais.status} <> 'cancelada'
    order by ${notasFiscais.createdAt} desc limit 1)`;
  private notaStatusExpr = sql<string | null>`(select ${notasFiscais.status} from ${notasFiscais}
    where ${notasFiscais.faturaId} = ${faturas.id} and ${notasFiscais.status} <> 'cancelada'
    order by ${notasFiscais.createdAt} desc limit 1)`;

  async meusPets(tenantId: string, responsavelId: string): Promise<PortalPetDto[]> {
    const rows = await this.database.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(animais)
        .where(eq(animais.responsavelId, responsavelId))
        .orderBy(desc(animais.createdAt)),
    );
    return Promise.all(rows.map((r) => this.toPetDto(r)));
  }

  async petDetalhe(tenantId: string, responsavelId: string, petId: string): Promise<PortalPetDetalheDto> {
    const data = await this.database.withTenant(tenantId, async (tx) => {
      const pet = await tx.query.animais.findFirst({ where: eq(animais.id, petId) });
      // Autorização por objeto: o pet tem de ser deste tutor.
      if (!pet || pet.responsavelId !== responsavelId) {
        throw new NotFoundException('Pet não encontrado');
      }
      const eventos = await tx
        .select({
          id: prontuarioEventos.id,
          tipo: prontuarioEventos.tipo,
          descricao: prontuarioEventos.descricao,
          data: prontuarioEventos.data,
        })
        .from(prontuarioEventos)
        .where(
          and(eq(prontuarioEventos.animalId, petId), inArray(prontuarioEventos.tipo, HISTORICO_TIPOS)),
        )
        .orderBy(desc(prontuarioEventos.data))
        .limit(200);
      return { pet, eventos };
    });

    const historico: PortalHistoricoDto[] = data.eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      descricao: e.descricao,
      data: e.data as unknown as string,
    }));
    const vacinas: PortalVacinaDto[] = data.eventos
      .filter((e) => e.tipo === 'vacina')
      .map((e) => ({ id: e.id, descricao: e.descricao, data: e.data as unknown as string }));

    return { pet: await this.toPetDto(data.pet), vacinas, historico };
  }

  async meusAgendamentos(tenantId: string, responsavelId: string): Promise<PortalAgendamentoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: agendamentos.id,
          titulo: agendamentos.titulo,
          petNome: animais.nome,
          tipoNome: tiposAtendimento.nome,
          profissionalNome: users.name,
          inicio: agendamentos.inicio,
          fim: agendamentos.fim,
          status: agendamentos.status,
        })
        .from(agendamentos)
        .leftJoin(animais, eq(animais.id, agendamentos.animalId))
        .leftJoin(tiposAtendimento, eq(tiposAtendimento.id, agendamentos.tipoAtendimentoId))
        .leftJoin(users, eq(users.id, agendamentos.profissionalId))
        .where(eq(agendamentos.responsavelId, responsavelId))
        .orderBy(desc(agendamentos.inicio))
        .limit(200);
      return rows.map((r) => ({
        ...r,
        inicio: r.inicio as unknown as string,
        fim: r.fim as unknown as string,
      }));
    });
  }

  async minhasFaturas(tenantId: string, responsavelId: string): Promise<PortalFaturaResumoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: faturas.id,
          status: faturas.status,
          totalCentavos: faturas.totalCentavos,
          recebidoCentavos: this.recebidoExpr,
          notaNumero: this.notaNumeroExpr,
          notaStatus: this.notaStatusExpr,
          criadaEm: faturas.createdAt,
        })
        .from(faturas)
        .where(eq(faturas.responsavelId, responsavelId))
        .orderBy(desc(faturas.createdAt))
        .limit(200);
      return rows.map((r) => this.toFaturaResumo(r));
    });
  }

  async faturaDetalhe(
    tenantId: string,
    responsavelId: string,
    faturaId: string,
  ): Promise<PortalFaturaDetalheDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({
          id: faturas.id,
          responsavelId: faturas.responsavelId,
          status: faturas.status,
          totalCentavos: faturas.totalCentavos,
          recebidoCentavos: this.recebidoExpr,
          notaNumero: this.notaNumeroExpr,
          notaStatus: this.notaStatusExpr,
          criadaEm: faturas.createdAt,
        })
        .from(faturas)
        .where(eq(faturas.id, faturaId))
        .limit(1);
      if (!row || row.responsavelId !== responsavelId) {
        throw new NotFoundException('Fatura não encontrada');
      }
      const itens = await tx
        .select({ descricao: faturaItens.descricao, valorCentavos: faturaItens.valorCentavos })
        .from(faturaItens)
        .where(eq(faturaItens.faturaId, faturaId))
        .orderBy(faturaItens.createdAt);
      return { fatura: this.toFaturaResumo(row), itens };
    });
  }

  // ───────── mapeadores ─────────

  private async toPetDto(r: typeof animais.$inferSelect): Promise<PortalPetDto> {
    return {
      id: r.id,
      nome: r.nome,
      especie: r.especie,
      raca: r.raca,
      sexo: r.sexo,
      castrado: r.castrado,
      nascimento: r.nascimento,
      status: r.status,
      fotoUrl: await this.storage.signDownload(r.fotoKey),
    };
  }

  private toFaturaResumo(r: {
    id: string;
    status: string;
    totalCentavos: number;
    recebidoCentavos: number;
    notaNumero: string | null;
    notaStatus: string | null;
    criadaEm: unknown;
  }): PortalFaturaResumoDto {
    return {
      id: r.id,
      status: r.status,
      totalCentavos: r.totalCentavos,
      recebidoCentavos: r.recebidoCentavos,
      saldoCentavos: r.totalCentavos - r.recebidoCentavos,
      notaNumero: r.notaNumero,
      notaStatus: r.notaStatus,
      criadaEm: r.criadaEm as string,
    };
  }
}
