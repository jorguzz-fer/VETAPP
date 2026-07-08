import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { mensagens, responsaveis, users } from '../../database/schema';
import { resolveMensagemProvider } from './mensagem-provider';
import type { CreateMensagemDto, MensagemDto } from './mensageria.dto';

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
          disparadoPor: userId,
        })
        .returning();
      return this.toDto(row, resp.nome, null);
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
