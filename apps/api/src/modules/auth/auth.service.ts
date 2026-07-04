import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../../database/database.service';
import { memberships, mfaRecoveryCodes, refreshTokens, tenants, users } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { EnvConfig } from '../../config/env';
import type {
  LoginDto,
  LoginResultDto,
  MfaEnableResponseDto,
  MfaSetupResponseDto,
  MfaStatusDto,
  RegisterDto,
  TokensDto,
} from './auth.dto';

interface MfaTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  scope: 'mfa';
}

// Token curto que autoriza APENAS o setup forçado de MFA (não é sessão). Emitido
// no login quando o papel exige MFA e o usuário ainda não configurou (doc 02 §2.2).
interface MfaSetupTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  scope: 'mfa_setup';
}

// Papéis com MFA OBRIGATÓRIO (doc 02 §2.2 / doc 07 §3): sem 2º fator não há sessão.
const ROLES_MFA_OBRIGATORIO = new Set(['admin', 'gestor', 'financeiro']);

// Payload do refresh JWT: carrega só o jti (= id da linha em refresh_tokens) e a
// family. Todo o estado (revogação, expiração) mora no banco — o refresh é
// stateful para permitir rotação e detecção de reuso (docs/spec/02 §2.2).
interface RefreshPayload {
  sub: string;
  jti: string;
  family: string;
  scope: 'refresh';
}

const RECOVERY_CODE_COUNT = 10;

@Injectable()
export class AuthService {
  private readonly googleClient?: OAuth2Client;

  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {
    if (env.GOOGLE_CLIENT_ID) {
      this.googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    }
    // Tolera ±1 passo (30s) de defasagem de relógio entre o servidor e o app
    // autenticador — sem isso, qualquer skew rejeita códigos TOTP válidos
    // (recomendado pelo otplib). Vale para todo authenticator.check().
    authenticator.options = { window: 1 };
  }

  /**
   * Bootstrap de um novo tenant: cria a clínica, o usuário admin e o vínculo.
   */
  async register(dto: RegisterDto, ip?: string): Promise<TokensDto> {
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

    const tokens = await this.issueTokens(user.id, tenant.id, membership.role);
    await this.audit.registrar(tenant.id, {
      userId: user.id,
      acao: 'auth.register',
      entidade: 'tenant',
      entidadeId: tenant.id,
      resumo: `Cadastro da clínica "${dto.tenantName}"`,
      detalhe: { email: dto.email },
      ip: ip ?? null,
    });
    return tokens;
  }

  async login(dto: LoginDto, ip?: string): Promise<LoginResultDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.email, dto.email) });
    if (!user?.passwordHash || user.status !== 'active') {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.resolveLogin(user.id, user.mfaEnabled, dto.tenantId, 'senha', ip);
  }

  /**
   * Login com Google (OIDC): valida o id_token NO SERVIDOR (docs/spec/02 §2.1) e
   * autentica um usuário existente (vinculado por google_sub ou pelo e-mail
   * verificado). Cadastro de novo tenant via Google fica para iteração futura.
   */
  async googleLogin(idToken: string, tenantId?: string, ip?: string): Promise<LoginResultDto> {
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
    return this.resolveLogin(user.id, user.mfaEnabled, tenantId, 'google', ip);
  }

  /**
   * Conclui o login quando o usuário tem MFA: valida o mfaToken + código.
   * O código pode ser um TOTP do autenticador OU um recovery code de uso único.
   */
  async mfaVerify(mfaToken: string, code: string, ip?: string): Promise<TokensDto> {
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
    if (!user?.mfaSecret) throw new UnauthorizedException('Código inválido');

    const totpOk = authenticator.check(code, user.mfaSecret);
    const recoveryOk = totpOk ? false : await this.consumeRecoveryCode(user.id, code);
    if (!totpOk && !recoveryOk) {
      throw new UnauthorizedException('Código inválido');
    }
    const tokens = await this.issueTokens(payload.sub, payload.tenantId, payload.role);
    await this.audit.registrar(payload.tenantId, {
      userId: payload.sub,
      acao: 'auth.login',
      entidade: 'sessao',
      entidadeId: payload.sub,
      resumo: `Login efetuado (MFA via ${recoveryOk ? 'recovery code' : 'TOTP'})`,
      detalhe: { via: 'mfa', metodo: recoveryOk ? 'recovery' : 'totp' },
      ip: ip ?? null,
    });
    return tokens;
  }

  // ───────── MFA obrigatório por papel: setup forçado ─────────

  /** Verifica o token de setup forçado (escopo 'mfa_setup') e devolve o payload. */
  private async verifyMfaSetupToken(setupToken: string): Promise<MfaSetupTokenPayload> {
    let payload: MfaSetupTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaSetupTokenPayload>(setupToken, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Sessão de configuração expirada — faça login novamente');
    }
    if (payload.scope !== 'mfa_setup') throw new UnauthorizedException('Token inválido');
    return payload;
  }

  /** Passo 1 do setup forçado: gera o segredo TOTP (autorizado pelo setupToken). */
  async mfaForcedSetup(setupToken: string): Promise<MfaSetupResponseDto> {
    const payload = await this.verifyMfaSetupToken(setupToken);
    return this.mfaSetup(payload.sub);
  }

  /**
   * Passo 2 do setup forçado: valida o código, liga o MFA, emite recovery codes E
   * a sessão (o login só se completa aqui). Autorizado pelo setupToken.
   */
  async mfaForcedEnable(
    setupToken: string,
    code: string,
    ip?: string,
  ): Promise<{ accessToken: string; refreshToken: string; recoveryCodes: string[] }> {
    const payload = await this.verifyMfaSetupToken(setupToken);
    const enable = await this.mfaEnable(payload.sub, code); // valida + liga + recovery codes
    const tokens = await this.issueTokens(payload.sub, payload.tenantId, payload.role);
    await this.audit.registrar(payload.tenantId, {
      userId: payload.sub,
      acao: 'auth.login',
      entidade: 'sessao',
      entidadeId: payload.sub,
      resumo: 'Login efetuado (MFA configurado — obrigatório por papel)',
      detalhe: { via: 'mfa_setup_forcado' },
      ip: ip ?? null,
    });
    return { ...tokens, recoveryCodes: enable.recoveryCodes };
  }

  // ───────── Sessão: refresh e logout ─────────

  /**
   * Rotação de refresh token (docs/spec/02 §2.2): valida o refresh JWT, confere
   * a linha em refresh_tokens e — se válida e não revogada — emite um novo par
   * na MESMA family, revogando o jti apresentado. Apresentar um jti já revogado
   * é REUSO (token roubado/replay) → revoga a family inteira e recusa.
   */
  async refresh(refreshToken: string): Promise<TokensDto> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada — faça login novamente');
    }
    if (payload.scope !== 'refresh') throw new UnauthorizedException('Token inválido');

    const row = await this.database.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.id, payload.jti),
    });
    // jti desconhecido ou family divergente = token forjado/adulterado.
    if (!row || row.family !== payload.family || row.userId !== payload.sub) {
      throw new UnauthorizedException('Token inválido');
    }
    if (row.revokedAt) {
      // Reuso de um refresh já rotacionado: mata a family inteira.
      await this.revokeFamily(row.family);
      throw new UnauthorizedException('Sessão revogada — faça login novamente');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada — faça login novamente');
    }

    return this.issueInFamily(row.userId, row.tenantId, row.role, row.family, row.id);
  }

  /** Logout: revoga a family do refresh apresentado (idempotente). */
  async logout(refreshToken: string, ip?: string): Promise<{ ok: boolean }> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.env.JWT_REFRESH_SECRET,
      });
      if (payload.scope === 'refresh') {
        // Uma linha da family dá o tenant/usuário para a auditoria (o refresh JWT
        // não carrega tenantId). Best-effort — não bloqueia o logout.
        const row = await this.database.db.query.refreshTokens.findFirst({
          where: eq(refreshTokens.family, payload.family),
        });
        await this.revokeFamily(payload.family);
        if (row) {
          await this.audit.registrar(row.tenantId, {
            userId: row.userId,
            acao: 'auth.logout',
            entidade: 'sessao',
            entidadeId: row.userId,
            resumo: 'Logout (sessão encerrada)',
            ip: ip ?? null,
          });
        }
      }
    } catch {
      // Token inválido/expirado: logout é best-effort, não vaza estado.
    }
    return { ok: true };
  }

  // ───────── Gestão do MFA (usuário autenticado) ─────────

  async mfaStatus(userId: string): Promise<MfaStatusDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    const remaining = user?.mfaEnabled ? await this.countRecoveryCodes(userId) : 0;
    return { enabled: user?.mfaEnabled ?? false, recoveryCodesRemaining: remaining };
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

  /**
   * Confirma o setup: valida o primeiro código, liga o MFA e emite os recovery
   * codes iniciais (exibidos UMA vez).
   */
  async mfaEnable(userId: string, code: string): Promise<MfaEnableResponseDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.mfaSecret) throw new BadRequestException('Rode o setup do MFA primeiro');
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException('Código inválido');
    }
    await this.database.db
      .update(users)
      .set({ mfaEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
    const recoveryCodes = await this.generateRecoveryCodes(userId);
    return { ok: true, recoveryCodes };
  }

  /** Desliga o MFA (exige um código TOTP válido — não basta estar logado). */
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
    await this.database.db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
    return { ok: true };
  }

  /** Regera os recovery codes (exige TOTP válido). Invalida os antigos. */
  async regenerateRecoveryCodes(userId: string, code: string): Promise<MfaEnableResponseDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new BadRequestException('MFA não está ativo');
    if (!authenticator.check(code, user.mfaSecret)) {
      throw new UnauthorizedException('Código inválido');
    }
    const recoveryCodes = await this.generateRecoveryCodes(userId);
    return { ok: true, recoveryCodes };
  }

  // ───────── internos ─────────

  /** Resolve membership/tenant e decide entre tokens de sessão ou desafio MFA. */
  private async resolveLogin(
    userId: string,
    mfaEnabled: boolean,
    tenantId: string | undefined,
    via: string,
    ip?: string,
  ): Promise<LoginResultDto> {
    // Leitura dos próprios vínculos antes de haver contexto de tenant: fixa
    // app.current_user para a policy memberships_self_read (migração 0018) liberar
    // as linhas deste usuário sob RLS (a app conecta como vetapp_app, sem BYPASSRLS).
    const memberList = await this.database.withUser(userId, (tx) =>
      tx.query.memberships.findMany({ where: eq(memberships.userId, userId) }),
    );
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

    // MFA obrigatório por papel: sem 2º fator configurado, o login não emite sessão
    // — devolve um token curto que só autoriza o setup forçado (doc 02 §2.2).
    if (ROLES_MFA_OBRIGATORIO.has(member.role)) {
      const mfaSetupToken = await this.jwt.signAsync(
        { sub: userId, tenantId: member.tenantId, role: member.role, scope: 'mfa_setup' } satisfies MfaSetupTokenPayload,
        { secret: this.env.JWT_ACCESS_SECRET, expiresIn: 900 },
      );
      return { mfaSetupRequired: true, mfaSetupToken };
    }

    const tokens = await this.issueTokens(userId, member.tenantId, member.role);
    await this.audit.registrar(member.tenantId, {
      userId,
      acao: 'auth.login',
      entidade: 'sessao',
      entidadeId: userId,
      resumo: `Login efetuado (${via})`,
      detalhe: { via },
      ip: ip ?? null,
    });
    return tokens;
  }

  /** Abre uma nova family de sessão (login/registro). */
  private issueTokens(userId: string, tenantId: string, role: string): Promise<TokensDto> {
    return this.issueInFamily(userId, tenantId, role, randomUUID());
  }

  /**
   * Emite um par access/refresh dentro de uma family. Grava a linha do refresh
   * (stateful) e, se `replacesId` vier, revoga o jti anterior apontando para o
   * novo (rotação). O access token é stateless: {sub, tenantId, role}.
   */
  private async issueInFamily(
    userId: string,
    tenantId: string,
    role: string,
    family: string,
    replacesId?: string,
  ): Promise<TokensDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, tenantId, role },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.JWT_ACCESS_TTL },
    );

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.env.JWT_REFRESH_TTL * 1000);
    await this.database.db.insert(refreshTokens).values({
      id: jti,
      userId,
      tenantId,
      role,
      family,
      expiresAt,
    });

    if (replacesId) {
      await this.database.db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedById: jti })
        .where(eq(refreshTokens.id, replacesId));
    }

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti, family, scope: 'refresh' } satisfies RefreshPayload,
      { secret: this.env.JWT_REFRESH_SECRET, expiresIn: this.env.JWT_REFRESH_TTL },
    );
    return { accessToken, refreshToken };
  }

  /** Revoga todos os refresh tokens ativos de uma family. */
  private async revokeFamily(family: string): Promise<void> {
    await this.database.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.family, family), isNull(refreshTokens.revokedAt)));
  }

  // ───────── Recovery codes do MFA ─────────

  /** (Re)gera os recovery codes: guarda só o hash argon2, devolve o texto plano. */
  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    await this.database.db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
    const codes: string[] = [];
    const rows: { userId: string; codeHash: string }[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      const code = `${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`;
      codes.push(code);
      rows.push({ userId, codeHash: await argon2.hash(code, { type: argon2.argon2id }) });
    }
    await this.database.db.insert(mfaRecoveryCodes).values(rows);
    return codes;
  }

  /**
   * Verifica e CONSOME um recovery code (uso único). Normaliza (trim/lowercase)
   * e compara com o hash de cada código ainda não usado. Retorna true se casou.
   */
  private async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return false;
    const rows = await this.database.db.query.mfaRecoveryCodes.findMany({
      where: and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)),
    });
    for (const row of rows) {
      if (await argon2.verify(row.codeHash, normalized)) {
        await this.database.db
          .update(mfaRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(eq(mfaRecoveryCodes.id, row.id));
        return true;
      }
    }
    return false;
  }

  private async countRecoveryCodes(userId: string): Promise<number> {
    const rows = await this.database.db.query.mfaRecoveryCodes.findMany({
      where: and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)),
    });
    return rows.length;
  }
}
