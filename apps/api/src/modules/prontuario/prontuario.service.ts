import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, faturaItens, faturas, prontuarioEventos } from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import { FaturamentoService } from '../financeiro/faturamento.service';
import type {
  CreateEventoDto,
  EventoDto,
  FaturaDto,
  SignUploadResponseDto,
} from './prontuario.dto';

type EventoRow = typeof prontuarioEventos.$inferSelect;

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
        .select()
        .from(prontuarioEventos)
        .where(eq(prontuarioEventos.animalId, animalId))
        .orderBy(desc(prontuarioEventos.data)),
    );
    return Promise.all(rows.map((r) => this.toEventoDto(r)));
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
    const evento = await this.database.withTenant(tenantId, async (tx) => {
      const animal = await tx.query.animais.findFirst({ where: eq(animais.id, animalId) });
      if (!animal) throw new NotFoundException('Animal não encontrado');

      const [ev] = await tx
        .insert(prontuarioEventos)
        .values({
          tenantId,
          animalId,
          tipo: dto.tipo,
          descricao: dto.descricao,
          valorCentavos: dto.valorCentavos ?? null,
          anexoKey: dto.anexoKey ?? null,
        })
        .returning();

      const deveFaturar = (dto.valorCentavos ?? 0) > 0 && dto.faturar !== false;
      if (deveFaturar) {
        await this.faturamento.lancar(tx, tenantId, animal.responsavelId, {
          descricao: `${dto.tipo}: ${dto.descricao}`,
          valorCentavos: dto.valorCentavos!,
          eventoId: ev.id,
          // Quem registra o atendimento é comissionado (doc 05 §5).
          profissionalId: autorUserId ?? null,
        });
      }
      return ev;
    });

    return this.toEventoDto(evento);
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

  private async toEventoDto(r: EventoRow): Promise<EventoDto> {
    return {
      id: r.id,
      animalId: r.animalId,
      tipo: r.tipo,
      descricao: r.descricao,
      valorCentavos: r.valorCentavos,
      data: r.data as unknown as string,
      anexoUrl: await this.storage.signDownload(r.anexoKey),
    };
  }

}
