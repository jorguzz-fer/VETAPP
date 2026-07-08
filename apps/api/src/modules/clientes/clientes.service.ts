import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, responsaveis } from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import type {
  AnimalDto,
  BuscaAnimalDto,
  CreateAnimalDto,
  CreateResponsavelDto,
  ListResponsaveisDto,
  OkDto,
  ResponsavelComAnimaisDto,
  ResponsavelDto,
  SignUploadResponseDto,
  UpdateAnimalDto,
  UpdateResponsavelDto,
} from './clientes.dto';

interface ListOpts {
  search?: string;
  page: number;
  pageSize: number;
}

type AnimalRow = typeof animais.$inferSelect;

// Todas as operações são escopadas ao tenant via withTenant (RLS reforça no banco).
@Injectable()
export class ClientesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  async listResponsaveis(tenantId: string, opts: ListOpts): Promise<ListResponsaveisDto> {
    const { search, page, pageSize } = opts;
    return this.database.withTenant(tenantId, async (tx) => {
      const where = search
        ? and(
            eq(responsaveis.tenantId, tenantId),
            or(ilike(responsaveis.nome, `%${search}%`), ilike(responsaveis.telefone, `%${search}%`)),
          )
        : eq(responsaveis.tenantId, tenantId);

      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(responsaveis)
        .where(where);

      const items = await tx
        .select()
        .from(responsaveis)
        .where(where)
        .orderBy(desc(responsaveis.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      // Pets da página em uma única query (doc 16 C4): tutor + pacientes na linha.
      const ids = items.map((r) => r.id);
      const petRows = ids.length
        ? await tx
            .select({ id: animais.id, nome: animais.nome, codigo: animais.codigo, responsavelId: animais.responsavelId })
            .from(animais)
            .where(inArray(animais.responsavelId, ids))
            .orderBy(asc(animais.nome))
        : [];
      const petsPorResp = new Map<string, { id: string; nome: string; codigo: string | null }[]>();
      for (const p of petRows) {
        const lista = petsPorResp.get(p.responsavelId) ?? [];
        lista.push({ id: p.id, nome: p.nome, codigo: p.codigo });
        petsPorResp.set(p.responsavelId, lista);
      }

      const itemsComPets = items.map((r) => ({ ...r, pets: petsPorResp.get(r.id) ?? [] }));
      return { items: itemsComPets, total, page, pageSize };
    });
  }

  /**
   * Busca de paciente para o Prontuário: por nome do animal OU nome/telefone do
   * tutor. Retorna o animal + tutor para abrir a ficha (timeline) direto.
   */
  async buscarAnimais(tenantId: string, search?: string): Promise<BuscaAnimalDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const base = eq(animais.tenantId, tenantId);
      const where = search
        ? and(
            base,
            or(
              ilike(animais.nome, `%${search}%`),
              ilike(responsaveis.nome, `%${search}%`),
              ilike(responsaveis.telefone, `%${search}%`),
            ),
          )
        : base;
      return tx
        .select({
          id: animais.id,
          nome: animais.nome,
          especie: animais.especie,
          raca: animais.raca,
          status: animais.status,
          responsavelId: animais.responsavelId,
          responsavelNome: responsaveis.nome,
        })
        .from(animais)
        .innerJoin(responsaveis, eq(responsaveis.id, animais.responsavelId))
        .where(where)
        .orderBy(asc(animais.nome))
        .limit(30);
    });
  }

  async createResponsavel(tenantId: string, dto: CreateResponsavelDto): Promise<ResponsavelDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx.insert(responsaveis).values({ ...dto, tenantId }).returning();
      return row;
    });
  }

  async getFicha(tenantId: string, id: string): Promise<ResponsavelComAnimaisDto> {
    const resp = await this.database.withTenant(tenantId, async (tx) => {
      const r = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, id) });
      if (!r) throw new NotFoundException('Responsável não encontrado');
      const pets = await tx
        .select()
        .from(animais)
        .where(eq(animais.responsavelId, id))
        .orderBy(desc(animais.createdAt));
      return { r, pets };
    });
    const animaisDto = await Promise.all(resp.pets.map((p) => this.toAnimalDto(p)));
    return { ...resp.r, animais: animaisDto } as ResponsavelComAnimaisDto;
  }

  async updateResponsavel(tenantId: string, id: string, dto: UpdateResponsavelDto): Promise<ResponsavelDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(responsaveis)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(responsaveis.id, id))
        .returning();
      if (!row) throw new NotFoundException('Responsável não encontrado');
      return row;
    });
  }

  async deleteResponsavel(tenantId: string, id: string): Promise<OkDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(responsaveis).where(eq(responsaveis.id, id)).returning({ id: responsaveis.id });
      if (rows.length === 0) throw new NotFoundException('Responsável não encontrado');
      return { ok: true };
    });
  }

  async createAnimal(tenantId: string, responsavelId: string, dto: CreateAnimalDto): Promise<AnimalDto> {
    const row = await this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      if (!resp) throw new NotFoundException('Responsável não encontrado');
      const [r] = await tx.insert(animais).values({ ...dto, tenantId, responsavelId }).returning();
      return r;
    });
    return this.toAnimalDto(row);
  }

  async getAnimal(tenantId: string, id: string): Promise<AnimalDto> {
    const row = await this.database.withTenant(tenantId, async (tx) => {
      const r = await tx.query.animais.findFirst({ where: eq(animais.id, id) });
      if (!r) throw new NotFoundException('Animal não encontrado');
      return r;
    });
    return this.toAnimalDto(row);
  }

  async updateAnimal(tenantId: string, id: string, dto: UpdateAnimalDto): Promise<AnimalDto> {
    const row = await this.database.withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .update(animais)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(animais.id, id))
        .returning();
      if (!r) throw new NotFoundException('Animal não encontrado');
      return r;
    });
    return this.toAnimalDto(row);
  }

  async deleteAnimal(tenantId: string, id: string): Promise<OkDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx.delete(animais).where(eq(animais.id, id)).returning({ id: animais.id });
      if (rows.length === 0) throw new NotFoundException('Animal não encontrado');
      return { ok: true };
    });
  }

  // ───────── Foto do animal (storage R2) ─────────

  async signAnimalFotoUpload(tenantId: string, animalId: string, contentType: string): Promise<SignUploadResponseDto> {
    await this.getAnimal(tenantId, animalId); // garante existência + escopo de tenant
    const key = this.storage.buildKey(tenantId, 'animais', animalId, 'foto');
    const uploadUrl = await this.storage.signUpload(key, contentType);
    return { key, uploadUrl };
  }

  async confirmAnimalFoto(tenantId: string, animalId: string, key: string): Promise<AnimalDto> {
    // A key precisa pertencer a este tenant+animal (evita gravar referência forjada).
    const prefix = `${tenantId}/animais/${animalId}/`;
    if (!key.startsWith(prefix)) throw new BadRequestException('Chave inválida para este animal');
    const row = await this.database.withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .update(animais)
        .set({ fotoKey: key, updatedAt: new Date() })
        .where(eq(animais.id, animalId))
        .returning();
      if (!r) throw new NotFoundException('Animal não encontrado');
      return r;
    });
    return this.toAnimalDto(row);
  }

  private async toAnimalDto(r: AnimalRow): Promise<AnimalDto> {
    return {
      id: r.id,
      responsavelId: r.responsavelId,
      codigo: r.codigo,
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
}
