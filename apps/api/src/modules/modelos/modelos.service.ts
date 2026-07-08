import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, modelosDocumento, responsaveis, tenants } from '../../database/schema';
import type { CreateModeloDto, ModeloDto, ModeloGeradoDto, UpdateModeloDto } from './modelos.dto';

@Injectable()
export class ModelosService {
  constructor(private readonly database: DatabaseService) {}

  async list(tenantId: string, tipo?: string): Promise<ModeloDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(modelosDocumento.tenantId, tenantId)];
      if (tipo) conds.push(eq(modelosDocumento.tipo, tipo));
      return tx
        .select({
          id: modelosDocumento.id,
          tipo: modelosDocumento.tipo,
          nome: modelosDocumento.nome,
          conteudo: modelosDocumento.conteudo,
        })
        .from(modelosDocumento)
        .where(and(...conds))
        .orderBy(asc(modelosDocumento.nome))
        .limit(300);
    });
  }

  async create(tenantId: string, dto: CreateModeloDto): Promise<ModeloDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx.insert(modelosDocumento).values({ ...dto, tenantId }).returning();
      return this.toDto(row);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateModeloDto): Promise<ModeloDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(modelosDocumento)
        .set({
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.conteudo !== undefined ? { conteudo: dto.conteudo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(modelosDocumento.id, id))
        .returning();
      if (!row) throw new NotFoundException('Modelo não encontrado');
      return this.toDto(row);
    });
  }

  async remove(tenantId: string, id: string): Promise<{ ok: boolean }> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .delete(modelosDocumento)
        .where(eq(modelosDocumento.id, id))
        .returning({ id: modelosDocumento.id });
      if (rows.length === 0) throw new NotFoundException('Modelo não encontrado');
      return { ok: true };
    });
  }

  /** Preenche os placeholders do modelo com os dados do animal/tutor/clínica. */
  async gerar(tenantId: string, id: string, animalId: string): Promise<ModeloGeradoDto> {
    const clinica = await this.database.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    return this.database.withTenant(tenantId, async (tx) => {
      const modelo = await tx.query.modelosDocumento.findFirst({ where: eq(modelosDocumento.id, id) });
      if (!modelo) throw new NotFoundException('Modelo não encontrado');
      const animal = await tx.query.animais.findFirst({ where: eq(animais.id, animalId) });
      if (!animal) throw new NotFoundException('Animal não encontrado');
      const tutor = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, animal.responsavelId) });

      const hoje = new Date().toLocaleDateString('pt-BR');
      const valores: Record<string, string> = {
        animal: animal.nome,
        especie: animal.especie ?? '',
        raca: animal.raca ?? '',
        tutor: tutor?.nome ?? '',
        telefone: tutor?.telefone ?? '',
        data: hoje,
        clinica: clinica?.name ?? '',
      };
      const conteudo = modelo.conteudo.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, chave: string) =>
        chave in valores ? valores[chave] : m,
      );
      return { titulo: `${modelo.nome} — ${animal.nome}`, conteudo };
    });
  }

  private toDto(r: typeof modelosDocumento.$inferSelect): ModeloDto {
    return { id: r.id, tipo: r.tipo, nome: r.nome, conteudo: r.conteudo };
  }
}
