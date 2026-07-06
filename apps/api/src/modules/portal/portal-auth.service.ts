import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { DatabaseService } from '../../database/database.service';
import { responsaveis, tenants, tutorCredentials } from '../../database/schema';
import type { EnvConfig } from '../../config/env';
import type {
  PortalAcessoDto,
  PortalConviteResponseDto,
  PortalInvitePreviewDto,
  PortalMeDto,
  PortalTokensDto,
} from './portal.dto';

// Convite válido por 7 dias.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface TutorRefreshPayload {
  sub: string;
  tenantId: string;
  responsavelId: string;
  scope: 'tutor-refresh';
}

@Injectable()
export class PortalAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {}

  private sha256(v: string): string {
    return createHash('sha256').update(v).digest('hex');
  }

  // ───────── Admin (clínica) ─────────

  /** Status do acesso ao portal para um responsável (visão da clínica). */
  async acessoStatus(tenantId: string, responsavelId: string): Promise<PortalAcessoDto> {
    await this.assertResponsavel(tenantId, responsavelId);
    const cred = await this.database.db.query.tutorCredentials.findFirst({
      where: eq(tutorCredentials.responsavelId, responsavelId),
    });
    if (!cred || cred.tenantId !== tenantId) {
      return { status: 'sem-acesso', email: null, inviteExpiresAt: null, lastLoginAt: null };
    }
    return {
      status: cred.status,
      email: cred.email,
      inviteExpiresAt: (cred.inviteExpiresAt as Date | null)?.toISOString() ?? null,
      lastLoginAt: (cred.lastLoginAt as Date | null)?.toISOString() ?? null,
    };
  }

  /**
   * Gera (ou renova) o convite de portal para um responsável. Não expõe/redefine
   * senha — só emite um token de convite que o tutor troca por uma senha.
   */
  async criarConvite(tenantId: string, responsavelId: string): Promise<PortalConviteResponseDto> {
    const resp = await this.assertResponsavel(tenantId, responsavelId);
    const token = randomBytes(32).toString('hex');
    const inviteTokenHash = this.sha256(token);
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const email = resp.email ?? '';

    const existing = await this.database.db.query.tutorCredentials.findFirst({
      where: eq(tutorCredentials.responsavelId, responsavelId),
    });
    if (existing) {
      await this.database.db
        .update(tutorCredentials)
        .set({ inviteTokenHash, inviteExpiresAt, email, status: 'invited', updatedAt: new Date() })
        .where(eq(tutorCredentials.id, existing.id));
    } else {
      await this.database.db.insert(tutorCredentials).values({
        tenantId,
        responsavelId,
        email,
        inviteTokenHash,
        inviteExpiresAt,
        status: 'invited',
      });
    }
    return { token, tenantId, expiresAt: inviteExpiresAt.toISOString() };
  }

  /** Revoga o acesso ao portal (mantém a linha, status 'disabled'). */
  async revogarAcesso(tenantId: string, responsavelId: string): Promise<{ ok: boolean }> {
    await this.assertResponsavel(tenantId, responsavelId);
    await this.database.db
      .update(tutorCredentials)
      .set({ status: 'disabled', inviteTokenHash: null, inviteExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(tutorCredentials.responsavelId, responsavelId), eq(tutorCredentials.tenantId, tenantId)));
    return { ok: true };
  }

  // ───────── Tutor ─────────

  /** Mostra a quem pertence o convite (para a tela de aceite), sem autenticar. */
  async invitePreview(token: string): Promise<PortalInvitePreviewDto> {
    const cred = await this.findValidInvite(token);
    const view = await this.database.withTenant(cred.tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, cred.responsavelId) });
      const tenant = await tx.query.tenants.findFirst({ where: eq(tenants.id, cred.tenantId) });
      return { resp, tenant };
    });
    return {
      responsavelNome: view.resp?.nome ?? 'Tutor',
      clinicaNome: view.tenant?.name ?? 'Clínica',
      email: cred.email || null,
    };
  }

  /** Aceita o convite: define a senha, ativa o acesso e já autentica. */
  async aceitarConvite(token: string, password: string): Promise<PortalTokensDto> {
    const cred = await this.findValidInvite(token);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.database.db
      .update(tutorCredentials)
      .set({
        passwordHash,
        status: 'active',
        inviteTokenHash: null,
        inviteExpiresAt: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tutorCredentials.id, cred.id));
    return this.issueTokens(cred.id, cred.tenantId, cred.responsavelId);
  }

  async login(tenantId: string, email: string, password: string): Promise<PortalTokensDto> {
    const cred = await this.database.db.query.tutorCredentials.findFirst({
      where: and(eq(tutorCredentials.tenantId, tenantId), eq(tutorCredentials.email, email)),
    });
    if (!cred?.passwordHash || cred.status !== 'active') {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await argon2.verify(cred.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    await this.database.db
      .update(tutorCredentials)
      .set({ lastLoginAt: new Date() })
      .where(eq(tutorCredentials.id, cred.id));
    return this.issueTokens(cred.id, cred.tenantId, cred.responsavelId);
  }

  async refresh(refreshToken: string): Promise<PortalTokensDto> {
    let payload: TutorRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<TutorRefreshPayload>(refreshToken, {
        secret: this.env.JWT_REFRESH_SECRET,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada — faça login novamente');
    }
    if (payload.scope !== 'tutor-refresh') throw new UnauthorizedException('Token inválido');

    const cred = await this.database.db.query.tutorCredentials.findFirst({
      where: eq(tutorCredentials.id, payload.sub),
    });
    if (!cred || cred.status !== 'active') {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.issueTokens(cred.id, cred.tenantId, cred.responsavelId);
  }

  async me(tenantId: string, responsavelId: string): Promise<PortalMeDto> {
    const view = await this.database.withTenant(tenantId, async (tx) => {
      const resp = await tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) });
      const tenant = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
      return { resp, tenant };
    });
    if (!view.resp) throw new NotFoundException('Tutor não encontrado');
    return {
      responsavelId,
      nome: view.resp.nome,
      email: view.resp.email,
      clinicaNome: view.tenant?.name ?? 'Clínica',
    };
  }

  // ───────── internos ─────────

  private async assertResponsavel(tenantId: string, responsavelId: string) {
    const resp = await this.database.withTenant(tenantId, (tx) =>
      tx.query.responsaveis.findFirst({ where: eq(responsaveis.id, responsavelId) }),
    );
    if (!resp) throw new NotFoundException('Responsável não encontrado');
    return resp;
  }

  private async findValidInvite(token: string) {
    if (!token) throw new BadRequestException('Convite inválido');
    const cred = await this.database.db.query.tutorCredentials.findFirst({
      where: eq(tutorCredentials.inviteTokenHash, this.sha256(token)),
    });
    if (!cred || cred.status === 'disabled') throw new BadRequestException('Convite inválido');
    const exp = cred.inviteExpiresAt as Date | null;
    if (!exp || exp.getTime() <= Date.now()) throw new BadRequestException('Convite expirado');
    return cred;
  }

  private async issueTokens(
    credentialId: string,
    tenantId: string,
    responsavelId: string,
  ): Promise<PortalTokensDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: credentialId, tenantId, responsavelId, scope: 'tutor' },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.JWT_ACCESS_TTL },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: credentialId, tenantId, responsavelId, scope: 'tutor-refresh' } satisfies TutorRefreshPayload,
      { secret: this.env.JWT_REFRESH_SECRET, expiresIn: this.env.JWT_REFRESH_TTL },
    );
    return { accessToken, refreshToken, tenantId };
  }
}
