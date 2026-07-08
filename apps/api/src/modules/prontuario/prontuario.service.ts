import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, estoqueMovimentos, faturaItens, faturas, itensCatalogo, prontuarioEventos, users } from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import { FaturamentoService } from '../financeiro/faturamento.service';
import type {
  CreateEventoDto,
  EventoDto,
  FaturaDto,
  SignUploadResponseDto,
} from './prontuario.dto';

type EventoRow = typeof prontuarioEventos.$inferSelect;

// Tipos de item do catálogo com saldo físico (mesma regra dos módulos Estoque e
// Internação). Serviços/exames/cirurgias não controlam estoque.
const TIPOS_ESTOCAVEIS = new Set(['produto', 'medicamento', 'vacina']);

@Injectable()
export class ProntuarioService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly faturamento: FaturamentoService,
  ) {}

  async listEventos(tenantId: string, animalId: string): Promise<EventoDto[]> {
    const rows = await this.database.withTenant(tenantId, async (tx) =>
      tx
        .select({ e: prontuarioEventos, autorNome: users.name })
        .from(prontuarioEventos)
        .leftJoin(users, eq(users.id, prontuarioEventos.registradoPor))
        .where(eq(prontuarioEventos.animalId, animalId))
        .orderBy(desc(prontuarioEventos.data)),
    );
    return Promise.all(rows.map((r) => this.toEventoDto(r.e, r.autorNome)));
  }

  /** URL pré-assinada para anexar arquivo a um evento do prontuário deste animal. */
  async signAnexoUpload(tenantId: string, animalId: string, contentType: string): Promise<SignUploadResponseDto> {
    await this.database.withTenant(tenantId, async (tx) => {
      const a = await tx.query.animais.findFirst({ where: eq(animais.id, animalId) });
      if (!a) throw new NotFoundException('Animal não encontrado');
    });
    const key = this.storage.buildKey(tenantId, 'animais', animalId, 'prontuario');
    const uploadUrl = await this.storage.signUpload(key, contentType);
    return { key, uploadUrl };
  }

  /**
   * Registra um evento clínico e, se tiver valor e `faturar`, lança automaticamente
   * na fatura ABERTA do responsável (doc 04 §3). Anexo opcional (key já enviada).
   */
  async createEvento(
    tenantId: string,
    animalId: string,
    dto: CreateEventoDto,
    autorUserId?: string,
  ): Promise<EventoDto> {
    if (dto.anexoKey && !dto.anexoKey.startsWith(`${tenantId}/animais/${animalId}/`)) {
      throw new BadRequestException('Chave de anexo inválida para este animal');
    }
    const quantidade = dto.quantidade && dto.quantidade > 0 ? dto.quantidade : 1;
    const { evento, estoqueBaixado } = await this.database.withTenant(tenantId, async (tx) => {
      const animal = await tx.query.animais.findFirst({ where: eq(animais.id, animalId) });
      if (!animal) throw new NotFoundException('Animal não encontrado');

      // Item do catálogo (opcional): valida existência e escopo do tenant.
      if (dto.itemId) {
        const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, dto.itemId) });
        if (!item) throw new BadRequestException('Item do catálogo inválido');
      }

      const [ev] = await tx
        .insert(prontuarioEventos)
        .values({
          tenantId,
          animalId,
          tipo: dto.tipo,
          descricao: dto.descricao,
          itemId: dto.itemId ?? null,
          quantidade,
          valorCentavos: dto.valorCentavos ?? null,
          anexoKey: dto.anexoKey ?? null,
          registradoPor: autorUserId ?? null,
        })
        .returning();

      // Baixa automática de estoque: só quando o item é estocável e há saldo (fase
      // 1 não permite saldo negativo; o registro clínico não é bloqueado por isso —
      // mesma regra da internação, doc 13 §2).
      let baixou = false;
      if (dto.itemId) {
        const item = await tx.query.itensCatalogo.findFirst({ where: eq(itensCatalogo.id, dto.itemId) });
        if (item && TIPOS_ESTOCAVEIS.has(item.tipo)) {
          const [{ saldo }] = await tx
            .select({ saldo: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade}), 0)::int` })
            .from(estoqueMovimentos)
            .where(eq(estoqueMovimentos.itemId, dto.itemId));
          if (saldo >= quantidade) {
            await tx.insert(estoqueMovimentos).values({
              tenantId,
              itemId: dto.itemId,
              tipo: 'saida',
              quantidade: -quantidade,
              motivo: `prontuário: ${dto.descricao}`,
            });
            baixou = true;
          }
        }
      }

      const deveFaturar = (dto.valorCentavos ?? 0) > 0 && dto.faturar !== false;
      if (deveFaturar) {
        await this.faturamento.lancar(tx, tenantId, animal.responsavelId, {
          descricao: `${dto.tipo}: ${dto.descricao}`,
          valorCentavos: dto.valorCentavos!,
          eventoId: ev.id,
          // Rastreio p/ comissão: item de origem e quem registrou (doc 05 §5).
          itemId: dto.itemId ?? null,
          profissionalId: autorUserId ?? null,
        });
      }
      return { evento: ev, estoqueBaixado: baixou };
    });

    return { ...(await this.toEventoDto(evento)), estoqueBaixado };
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

  private async toEventoDto(r: EventoRow, registradoPorNome?: string | null): Promise<EventoDto> {
    return {
      id: r.id,
      animalId: r.animalId,
      tipo: r.tipo,
      descricao: r.descricao,
      itemId: r.itemId,
      quantidade: r.quantidade,
      valorCentavos: r.valorCentavos,
      data: r.data as unknown as string,
      anexoUrl: await this.storage.signDownload(r.anexoKey),
      registradoPorNome: registradoPorNome ?? null,
    };
  }

}
