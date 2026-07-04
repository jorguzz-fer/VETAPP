import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { agendamentoSolicitacoes, animais, responsaveis, siteConfig } from '../../database/schema';
import { StorageService } from '../storage/storage.service';
import type {
  ConverterResultDto,
  CreateSolicitacaoDto,
  PublicSiteDto,
  SiteConfigDto,
  SignUploadResponseDto,
  SolicitacaoDto,
  UpdateSiteConfigDto,
} from './site.dto';

// Site público (doc 13 §4). site_config é global (leitura pública por slug);
// solicitações são tenant-scoped (RLS). A única escrita pública é a solicitação
// de agendamento — a clínica confirma; nada grava direto na agenda operacional.
@Injectable()
export class SiteService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  // ───────── Público ─────────

  async getPublic(slug: string): Promise<PublicSiteDto> {
    const cfg = await this.database.db.query.siteConfig.findFirst({ where: eq(siteConfig.slug, slug) });
    if (!cfg || !cfg.publicado) throw new NotFoundException('Site não encontrado');
    return {
      slug: cfg.slug,
      nomeExibicao: cfg.nomeExibicao,
      sobre: cfg.sobre,
      servicos: this.splitServicos(cfg.servicos),
      endereco: cfg.endereco,
      telefone: cfg.telefone,
      whatsapp: cfg.whatsapp,
      email: cfg.email,
      horario: cfg.horario,
      corPrimaria: cfg.corPrimaria,
      logoUrl: await this.storage.signDownload(cfg.logoKey),
    };
  }

  /** Cria uma solicitação a partir do site público. Retorna false se for spam (honeypot). */
  async criarSolicitacao(slug: string, dto: CreateSolicitacaoDto): Promise<boolean> {
    // Honeypot: campo oculto preenchido = bot. Responde ok sem gravar.
    if (dto.website && dto.website.trim() !== '') return false;

    const cfg = await this.database.db.query.siteConfig.findFirst({ where: eq(siteConfig.slug, slug) });
    if (!cfg || !cfg.publicado) throw new NotFoundException('Site não encontrado');

    await this.database.withTenant(cfg.tenantId, (tx) =>
      tx.insert(agendamentoSolicitacoes).values({
        tenantId: cfg.tenantId,
        nome: dto.nome,
        telefone: dto.telefone,
        email: dto.email ?? null,
        petNome: dto.petNome ?? null,
        servicoDesejado: dto.servicoDesejado ?? null,
        preferencia: dto.preferencia ?? null,
        mensagem: dto.mensagem ?? null,
        origem: dto.origem ?? null,
      }),
    );
    return true;
  }

  // ───────── Admin (CMS) ─────────

  /** Config do site do tenant (cria uma default na primeira leitura). */
  async getConfig(tenantId: string): Promise<SiteConfigDto> {
    let cfg = await this.database.db.query.siteConfig.findFirst({ where: eq(siteConfig.tenantId, tenantId) });
    if (!cfg) {
      const slug = `clinica-${tenantId.slice(0, 8)}`;
      [cfg] = await this.database.db.insert(siteConfig).values({ tenantId, slug }).returning();
    }
    return this.toConfigDto(cfg);
  }

  async updateConfig(tenantId: string, dto: UpdateSiteConfigDto): Promise<SiteConfigDto> {
    await this.getConfig(tenantId); // garante existência
    if (dto.slug) {
      const taken = await this.database.db.query.siteConfig.findFirst({
        where: and(eq(siteConfig.slug, dto.slug), ne(siteConfig.tenantId, tenantId)),
      });
      if (taken) throw new ConflictException('Este endereço (slug) já está em uso');
    }
    const [row] = await this.database.db
      .update(siteConfig)
      .set({
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
        ...(dto.nomeExibicao !== undefined ? { nomeExibicao: dto.nomeExibicao } : {}),
        ...(dto.sobre !== undefined ? { sobre: dto.sobre } : {}),
        ...(dto.servicos !== undefined ? { servicos: dto.servicos } : {}),
        ...(dto.endereco !== undefined ? { endereco: dto.endereco } : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
        ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.horario !== undefined ? { horario: dto.horario } : {}),
        ...(dto.corPrimaria !== undefined ? { corPrimaria: dto.corPrimaria } : {}),
        updatedAt: new Date(),
      })
      // Filtro por tenant_id (tabela global, sem RLS) — edita só o próprio site.
      .where(eq(siteConfig.tenantId, tenantId))
      .returning();
    return this.toConfigDto(row);
  }

  async signLogoUpload(tenantId: string, contentType: string): Promise<SignUploadResponseDto> {
    const key = this.storage.buildKey(tenantId, 'site', 'logo');
    const uploadUrl = await this.storage.signUpload(key, contentType);
    return { key, uploadUrl };
  }

  async confirmLogo(tenantId: string, key: string): Promise<SiteConfigDto> {
    const prefix = `${tenantId}/site/`;
    if (!key.startsWith(prefix)) throw new BadRequestException('Chave inválida para este tenant');
    await this.getConfig(tenantId);
    const [row] = await this.database.db
      .update(siteConfig)
      .set({ logoKey: key, updatedAt: new Date() })
      .where(eq(siteConfig.tenantId, tenantId))
      .returning();
    return this.toConfigDto(row);
  }

  // ───────── Admin (triagem de solicitações) ─────────

  async listSolicitacoes(tenantId: string, status?: string): Promise<SolicitacaoDto[]> {
    return this.database.withTenant(tenantId, async (tx) => {
      const conds = [eq(agendamentoSolicitacoes.tenantId, tenantId)];
      if (status) conds.push(eq(agendamentoSolicitacoes.status, status));
      const rows = await tx
        .select()
        .from(agendamentoSolicitacoes)
        .where(and(...conds))
        .orderBy(desc(agendamentoSolicitacoes.createdAt))
        .limit(300);
      return rows.map((r) => this.toSolicitacaoDto(r));
    });
  }

  confirmar(tenantId: string, id: string, observacao?: string): Promise<SolicitacaoDto> {
    return this.triagem(tenantId, id, 'confirmada', observacao);
  }

  recusar(tenantId: string, id: string, observacao?: string): Promise<SolicitacaoDto> {
    return this.triagem(tenantId, id, 'recusada', observacao);
  }

  /**
   * Converte uma solicitação em CLIENTE de verdade (doc 13 §4.2): cria o responsável
   * (nome/telefone/email/origem) e, se houver `petNome`, um animal; liga a solicitação
   * ao cadastro e marca como confirmada. Idempotente por solicitação (não reconverte).
   */
  async converter(tenantId: string, id: string): Promise<ConverterResultDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const sol = await tx.query.agendamentoSolicitacoes.findFirst({
        where: eq(agendamentoSolicitacoes.id, id),
      });
      if (!sol) throw new NotFoundException('Solicitação não encontrada');
      if (sol.responsavelId) throw new ConflictException('Solicitação já convertida em cliente');

      const [resp] = await tx
        .insert(responsaveis)
        .values({
          tenantId,
          nome: sol.nome,
          telefone: sol.telefone,
          email: sol.email,
          origem: sol.origem ?? 'site',
        })
        .returning();

      if (sol.petNome && sol.petNome.trim()) {
        await tx.insert(animais).values({
          tenantId,
          responsavelId: resp.id,
          nome: sol.petNome.trim(),
        });
      }

      const [row] = await tx
        .update(agendamentoSolicitacoes)
        .set({ status: 'confirmada', responsavelId: resp.id })
        .where(eq(agendamentoSolicitacoes.id, id))
        .returning();

      return { responsavelId: resp.id, solicitacao: this.toSolicitacaoDto(row) };
    });
  }

  private async triagem(
    tenantId: string,
    id: string,
    status: 'confirmada' | 'recusada',
    observacao?: string,
  ): Promise<SolicitacaoDto> {
    return this.database.withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .update(agendamentoSolicitacoes)
        .set({ status, observacaoInterna: observacao ?? null })
        .where(eq(agendamentoSolicitacoes.id, id))
        .returning();
      if (!row) throw new NotFoundException('Solicitação não encontrada');
      return this.toSolicitacaoDto(row);
    });
  }

  // ───────── mapeadores ─────────

  private splitServicos(s: string | null): string[] {
    if (!s) return [];
    return s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  private async toConfigDto(r: typeof siteConfig.$inferSelect): Promise<SiteConfigDto> {
    return {
      id: r.id,
      slug: r.slug,
      publicado: r.publicado,
      nomeExibicao: r.nomeExibicao,
      sobre: r.sobre,
      servicos: r.servicos,
      endereco: r.endereco,
      telefone: r.telefone,
      whatsapp: r.whatsapp,
      email: r.email,
      horario: r.horario,
      corPrimaria: r.corPrimaria,
      logoUrl: await this.storage.signDownload(r.logoKey),
    };
  }

  private toSolicitacaoDto(r: typeof agendamentoSolicitacoes.$inferSelect): SolicitacaoDto {
    return {
      id: r.id,
      nome: r.nome,
      telefone: r.telefone,
      email: r.email,
      petNome: r.petNome,
      servicoDesejado: r.servicoDesejado,
      preferencia: r.preferencia,
      mensagem: r.mensagem,
      origem: r.origem,
      status: r.status,
      observacaoInterna: r.observacaoInterna,
      responsavelId: r.responsavelId,
      criadaEm: (r.createdAt as Date).toISOString(),
    };
  }
}
