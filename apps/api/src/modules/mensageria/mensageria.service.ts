import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, mensagemTemplates, mensagens, responsaveis, users, vacinas } from '../../database/schema';
import { resolveMensagemProvider } from './mensagem-provider';
import type {
  CreateMensagemDto,
  CreateTemplateDto,
  MensagemDto,
  MensagemTemplateDto,
  UpdateTemplateDto,
  VacinaVencendoDto,
} from './mensageria.dto';

type MensagemRow = typeof mensagens.$inferSelect;

interface ListaFiltro {
  canal?: string;
  status?: string;
  limit?: number;
}

// Mensageria / CRM (doc 17). Tudo escopado ao tenant via withTenant (RLS reforça).
// Envio provider-agnostic: o driver `log` registra a mensagem (status `registrada`);
// o envio efetivo é manual até um provedor externo ser plugado.
@Injectable()
export class MensageriaService {
  constructor(private readonly database: DatabaseService) {}

  async registrarParaCliente(
    tenantId: string,
    responsavelId: string,
    userId: string,
    dto: CreateMensagemDto,
  ): Promise<MensagemDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      if (!resp) throw new NotFoundException('Cliente não encontrado');

      const provider = resolveMensagemProvider(dto.canal);
      const destino = dto.canal === 'email' ? resp.email : resp.telefone;
      const res = await provider.enviar({
        canal: dto.canal,
        corpo: dto.corpo,
        assunto: dto.assunto ?? null,
        destino,
      });

      const [row] = await tx
        .insert(mensagens)
        .values({
          tenantId,
          responsavelId,
          canal: dto.canal,
          assunto: dto.assunto ?? null,
          corpo: dto.corpo,
          status: res.status,
          erro: res.erro ?? null,
          enviadaEm: res.enviadaEm ?? null,
          referenciaTipo: dto.referenciaTipo ?? null,
          referenciaId: dto.referenciaId ?? null,
          templateId: dto.templateId ?? null,
          disparadoPor: userId,
        })
        .returning();
      return this.toDto(row, resp.nome, null);
    });
  }

  // ───────── Lembretes de vacina (doc 17 slice 3) ─────────

  // Vacinas com próxima dose vencendo até `dias` (inclui vencidas). Usa
  // vacinas.proxima_em (índice vacinas_proxima_idx). Ordena da mais urgente.
  async vacinasVencendo(tenantId: string, dias: number): Promise<VacinaVencendoDto[]> {
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const limiteStr = limite.toISOString().slice(0, 10); // AAAA-MM-DD
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          vacinaId: vacinas.id,
          animalId: vacinas.animalId,
          animalNome: animais.nome,
          responsavelId: animais.responsavelId,
          responsavelNome: responsaveis.nome,
          vacina: vacinas.nome,
          proximaEm: vacinas.proximaEm,
        })
        .from(vacinas)
        .innerJoin(animais, eq(animais.id, vacinas.animalId))
        .innerJoin(responsaveis, eq(responsaveis.id, animais.responsavelId))
        .where(and(isNotNull(vacinas.proximaEm), lte(vacinas.proximaEm, limiteStr)))
        .orderBy(asc(vacinas.proximaEm))
        .limit(300);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return rows.map((r) => {
        const prox = new Date(r.proximaEm as unknown as string);
        const diasRestantes = Math.round((prox.getTime() - hoje.getTime()) / 86_400_000);
        return {
          vacinaId: r.vacinaId,
          animalId: r.animalId,
          animalNome: r.animalNome,
          responsavelId: r.responsavelId,
          responsavelNome: r.responsavelNome,
          vacina: r.vacina,
          proximaEm: r.proximaEm as unknown as string,
          diasRestantes,
        };
      });
    });
  }

  // ───────── Templates (doc 17 slice 2) ─────────

  async listTemplates(tenantId: string, incluirInativos = false): Promise<MensagemTemplateDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(mensagemTemplates.tenantId, tenantId)];
      if (!incluirInativos) conds.push(eq(mensagemTemplates.ativo, true));
      const rows = await tx
        .select()
        .from(mensagemTemplates)
        .where(and(...conds))
        .orderBy(asc(mensagemTemplates.nome));
      return rows.map((r) => ({
        id: r.id,
        nome: r.nome,
        canal: r.canal,
        assunto: r.assunto,
        corpo: r.corpo,
        ativo: r.ativo,
      }));
    });
  }

  async createTemplate(tenantId: string, dto: CreateTemplateDto): Promise<MensagemTemplateDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .insert(mensagemTemplates)
        .values({ tenantId, nome: dto.nome, canal: dto.canal, assunto: dto.assunto ?? null, corpo: dto.corpo })
        .returning();
      return { id: r.id, nome: r.nome, canal: r.canal, assunto: r.assunto, corpo: r.corpo, ativo: r.ativo };
    });
  }

  async updateTemplate(tenantId: string, id: string, dto: UpdateTemplateDto): Promise<MensagemTemplateDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .update(mensagemTemplates)
        .set({
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.assunto !== undefined ? { assunto: dto.assunto } : {}),
          ...(dto.corpo !== undefined ? { corpo: dto.corpo } : {}),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(mensagemTemplates.id, id))
        .returning();
      if (!r) throw new NotFoundException('Template não encontrado');
      return { id: r.id, nome: r.nome, canal: r.canal, assunto: r.assunto, corpo: r.corpo, ativo: r.ativo };
    });
  }

  async listPorCliente(tenantId: string, responsavelId: string): Promise<MensagemDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({ m: mensagens, autorNome: users.name })
        .from(mensagens)
        .leftJoin(users, eq(users.id, mensagens.disparadoPor))
        .where(eq(mensagens.responsavelId, responsavelId))
        .orderBy(desc(mensagens.createdAt))
        .limit(200);
      return rows.map((r) => this.toDto(r.m, null, r.autorNome));
    });
  }

  async listGeral(tenantId: string, filtro: ListaFiltro): Promise<MensagemDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(mensagens.tenantId, tenantId)];
      if (filtro.canal) conds.push(eq(mensagens.canal, filtro.canal));
      if (filtro.status) conds.push(eq(mensagens.status, filtro.status));
      const rows = await tx
        .select({ m: mensagens, respNome: responsaveis.nome, autorNome: users.name })
        .from(mensagens)
        .leftJoin(responsaveis, eq(responsaveis.id, mensagens.responsavelId))
        .leftJoin(users, eq(users.id, mensagens.disparadoPor))
        .where(and(...conds))
        .orderBy(desc(mensagens.createdAt))
        .limit(Math.min(filtro.limit ?? 200, 500));
      return rows.map((r) => this.toDto(r.m, r.respNome, r.autorNome));
    });
  }

  private toDto(r: MensagemRow, responsavelNome: string | null, disparadoPorNome: string | null): MensagemDto {
    return {
      id: r.id,
      responsavelId: r.responsavelId,
      responsavelNome,
      canal: r.canal,
      direcao: r.direcao,
      assunto: r.assunto,
      corpo: r.corpo,
      status: r.status,
      referenciaTipo: r.referenciaTipo,
      disparadoPorNome,
      criadaEm: r.createdAt as unknown as string,
    };
  }
}
