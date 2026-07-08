import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { animais, faturas, prontuarioEventos, responsaveis, users, vacinas } from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import type {
  AnimalDto,
  BuscaAnimalDto,
  CreateAnimalDto,
  CreateResponsavelDto,
  ListResponsaveisDto,
  OkDto,
  CreateVacinaDto,
  ResponsavelComAnimaisDto,
  ResponsavelDto,
  SignUploadResponseDto,
  UpdateAnimalDto,
  UpdateResponsavelDto,
  VacinaDto,
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

      // Resumo de vendas do cliente (doc 16 F1): faturas não canceladas.
      const [v] = await tx
        .select({
          total: sql<number>`coalesce(sum(${faturas.totalCentavos}), 0)::int`,
          n: sql<number>`count(*)::int`,
          ultima: sql<string | null>`max(${faturas.createdAt})`,
        })
        .from(faturas)
        .where(and(eq(faturas.responsavelId, id), ne(faturas.status, 'cancelada')));
      return { r, pets, v };
    });

    const animaisDto = await Promise.all(resp.pets.map((p) => this.toAnimalDto(p)));
    const total = Number(resp.v?.total ?? 0);
    const n = Number(resp.v?.n ?? 0);
    const vendas = {
      totalVendidoCentavos: total,
      ticketMedioCentavos: n > 0 ? Math.round(total / n) : 0,
      vendas: n,
      ultimaVendaEm: (resp.v?.ultima as unknown as string) ?? null,
    };
    return { ...resp.r, animais: animaisDto, vendas } as ResponsavelComAnimaisDto;
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

  // ───────── Protocolos vacinais (doc 16 PR9) ─────────

  async listVacinas(tenantId: string, animalId: string): Promise<VacinaDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: vacinas.id,
          animalId: vacinas.animalId,
          nome: vacinas.nome,
          laboratorio: vacinas.laboratorio,
          lote: vacinas.lote,
          aplicadaEm: vacinas.aplicadaEm,
          proximaEm: vacinas.proximaEm,
          aplicadaPorNome: users.name,
          observacao: vacinas.observacao,
        })
        .from(vacinas)
        .leftJoin(users, eq(users.id, vacinas.aplicadaPor))
        .where(eq(vacinas.animalId, animalId))
        .orderBy(desc(vacinas.aplicadaEm));
      return rows.map((r) => ({
        ...r,
        aplicadaEm: r.aplicadaEm as unknown as string,
        proximaEm: (r.proximaEm as unknown as string | null) ?? null,
      }));
    });
  }

  async criarVacina(
    tenantId: string,
    animalId: string,
    userId: string,
    dto: CreateVacinaDto,
  ): Promise<VacinaDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const animal = await tx.query.animais.findFirst({ where: eq(animais.id, animalId) });
      if (!animal) throw new NotFoundException('Paciente não encontrado');
      const [row] = await tx
        .insert(vacinas)
        .values({
          tenantId,
          animalId,
          nome: dto.nome,
          laboratorio: dto.laboratorio ?? null,
          lote: dto.lote ?? null,
          aplicadaEm: dto.aplicadaEm,
          proximaEm: dto.proximaEm ?? null,
          aplicadaPor: userId,
          observacao: dto.observacao ?? null,
        })
        .returning();
      // Também vira evento na linha do tempo do paciente.
      await tx.insert(prontuarioEventos).values({
        tenantId,
        animalId,
        tipo: 'vacina',
        descricao: `Vacina: ${dto.nome}${dto.lote ? ` (lote ${dto.lote})` : ''}`,
      });
      const [autor] = userId
        ? await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1)
        : [];
      return {
        id: row.id,
        animalId: row.animalId,
        nome: row.nome,
        laboratorio: row.laboratorio,
        lote: row.lote,
        aplicadaEm: row.aplicadaEm as unknown as string,
        proximaEm: (row.proximaEm as unknown as string | null) ?? null,
        aplicadaPorNome: autor?.name ?? null,
        observacao: row.observacao,
      };
    });
  }

  private async toAnimalDto(r: AnimalRow): Promise<AnimalDto> {
    return {
      id: r.id,
      responsavelId: r.responsavelId,
      codigo: r.codigo,
      nome: r.nome,
      especie: r.especie,
      raca: r.raca,
      pelagem: r.pelagem,
      sexo: r.sexo,
      castrado: r.castrado,
      nascimento: r.nascimento,
      microchip: r.microchip,
      marcacoes: r.marcacoes ?? [],
      pedigree: r.pedigree,
      pedigreeNumero: r.pedigreeNumero,
      status: r.status,
      fotoUrl: await this.storage.signDownload(r.fotoKey),
    };
  }
}
