import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../../database/database.service';
import { memberships, tenants, users } from '../../database/schema';
import type { EnvConfig } from '../../config/env';
import type {
  LoginDto,
  LoginResultDto,
  MfaSetupResponseDto,
  RegisterDto,
  TokensDto,
} from './auth.dto';

interface MfaTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  scope: 'mfa';
}

@Injectable()
export class AuthService {
  private readonly googleClient?: OAuth2Client;

  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {
    if (env.GOOGLE_CLIENT_ID) {
      this.googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    }
  }

  /**
   * Bootstrap de um novo tenant: cria a clínica, o usuário admin e o vínculo.
   */
  async register(dto: RegisterDto): Promise<TokensDto> {
    const existing = await this.database.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const [tenant] = await this.database.db.insert(tenants).values({ name: dto.tenantName }).returning();
    const [user] = await this.database.db
      .insert(users)
      .values({ email: dto.email, name: dto.name, passwordHash })
      .returning();

    const [membership] = await this.database.withTenant(tenant.id, (tx) =>
      tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, role: 'admin' }).returning(),
    );

    return this.issueTokens(user.id, tenant.id, membership.role);
  }

  async login(dto: LoginDto): Promise<LoginResultDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.email, dto.email) });
    if (!user?.passwordHash || user.status !== 'active') {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.resolveLogin(user.id, user.mfaEnabled, dto.tenantId);
  }

  /**
   * Login com Google (OIDC): valida o id_token NO SERVIDOR (docs/spec/02 §2.1) e
   * autentica um usuário existente (vinculado por google_sub ou pelo e-mail
   * verificado). Cadastro de novo tenant via Google fica para iteração futura.
   */
  async googleLogin(idToken: string, tenantId?: string): Promise<LoginResultDto> {
    if (!this.googleClient || !this.env.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableException('Login com Google não configurado');
    }
    let sub: string;
    let email: string | undefined;
    let emailVerified = false;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('payload inválido');
      sub = payload.sub;
      email = payload.email;
      emailVerified = payload.email_verified === true;
    } catch {
      throw new UnauthorizedException('Token do Google inválido');
    }

    let user = await this.database.db.query.users.findFirst({ where: eq(users.googleSub, sub) });
    if (!user && email && emailVerified) {
      // Vincula a conta Google a um usuário existente com o mesmo e-mail verificado.
      const byEmail = await this.database.db.query.users.findFirst({ where: eq(users.email, email) });
      if (byEmail) {
        const [linked] = await this.database.db
          .update(users)
          .set({ googleSub: sub, updatedAt: new Date() })
          .where(eq(users.id, byEmail.id))
          .returning();
        user = linked;
      }
    }
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Nenhuma conta encontrada para este Google. Cadastre a clínica primeiro.');
    }
    return this.resolveLogin(user.id, user.mfaEnabled, tenantId);
  }

  /** Conclui o login quando o usuário tem MFA: valida o mfaToken + código TOTP. */
  async mfaVerify(mfaToken: string, code: string): Promise<TokensDto> {
    let payload: MfaTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaTokenPayload>(mfaToken, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Sessão de MFA expirada — faça login novamente');
    }
    if (payload.scope !== 'mfa') throw new UnauthorizedException('Token inválido');

    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user?.mfaSecret || !authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException('Código inválido');
    }
    return this.issueTokens(payload.sub, payload.tenantId, payload.role);
  }

  // ───────── Gestão do MFA (usuário autenticado) ─────────

  async mfaStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    return { enabled: user?.mfaEnabled ?? false };
  }

  /** Gera e guarda o segredo TOTP (pendente até confirmar com mfaEnable). */
  async mfaSetup(userId: string): Promise<MfaSetupResponseDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new UnauthorizedException();
    if (user.mfaEnabled) throw new BadRequestException('MFA já está ativo');

    const secret = authenticator.generateSecret();
    await this.database.db
      .update(users)
      .set({ mfaSecret: secret, updatedAt: new Date() })
      .where(eq(users.id, userId));

    const otpauthUrl = authenticator.keyuri(user.email, 'VETAPP', secret);
    return { secret, otpauthUrl };
  }

  /** Confirma o setup: valida o primeiro código e liga o MFA. */
  async mfaEnable(userId: string, code: string): Promise<{ ok: boolean }> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.mfaSecret) throw new BadRequestException('Rode o setup do MFA primeiro');
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException('Código inválido');
    }
    await this.database.db
      .update(users)
      .set({ mfaEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return { ok: true };
  }

  /** Desliga o MFA (exige um código válido — não basta estar logado). */
  async mfaDisable(userId: string, code: string): Promise<{ ok: boolean }> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new BadRequestException('MFA não está ativo');
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException('Código inválido');
    }
    await this.database.db
      .update(users)
      .set({ mfaEnabled: false, mfaSecret: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return { ok: true };
  }

  // ───────── internos ─────────

  /** Resolve membership/tenant e decide entre tokens de sessão ou desafio MFA. */
  private async resolveLogin(userId: string, mfaEnabled: boolean, tenantId?: string): Promise<LoginResultDto> {
    const memberList = await this.database.db.query.memberships.findMany({
      where: eq(memberships.userId, userId),
    });
    if (memberList.length === 0) {
      throw new UnauthorizedException('Usuário sem acesso a nenhum tenant');
    }
    const member = tenantId ? memberList.find((m) => m.tenantId === tenantId) : memberList[0];
    if (!member) {
      throw new UnauthorizedException('Sem acesso ao tenant informado');
    }

    if (mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: userId, tenantId: member.tenantId, role: member.role, scope: 'mfa' } satisfies MfaTokenPayload,
        { secret: this.env.JWT_ACCESS_SECRET, expiresIn: 300 },
      );
      return { mfaRequired: true, mfaToken };
    }

    return this.issueTokens(userId, member.tenantId, member.role);
  }

  private async issueTokens(userId: string, tenantId: string, role: string): Promise<TokensDto> {
    const payload = { sub: userId, tenantId, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.env.JWT_REFRESH_SECRET,
      expiresIn: this.env.JWT_REFRESH_TTL,
    });
    return { accessToken, refreshToken };
  }
}
