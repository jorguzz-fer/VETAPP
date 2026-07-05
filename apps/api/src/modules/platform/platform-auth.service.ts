import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { DatabaseService } from '../../database/database.service';
import { platformAdmins, platformMfaRecoveryCodes, platformRefreshTokens } from '../../database/schema';
import { PlatformAuditService } from './platform-audit.service';
import type { EnvConfig } from '../../config/env';
import type {
  PlatformLoginResultDto,
  PlatformMeDto,
  PlatformMfaForcedEnableResponseDto,
  PlatformMfaSetupResponseDto,
  PlatformTokensDto,
} from './platform.dto';

interface MfaChallengePayload {
  sub: string;
  scope: 'platform-mfa';
}
interface MfaSetupPayload {
  sub: string;
  scope: 'platform-mfa-setup';
}
interface RefreshPayload {
  sub: string;
  jti: string;
  family: string;
  scope: 'platform-refresh';
}

const RECOVERY_CODE_COUNT = 10;

// Auth do super-admin da plataforma (doc 15). MFA OBRIGATÓRIO; refresh stateful com
// rotação + detecção de reuso + revogação. Tabelas globais (sem tenant). Escopo de
// token 'platform' — isolado da gestão e do tutor.
@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly audit: PlatformAuditService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {
    authenticator.options = { window: 1 }; // tolera ±30s de skew (mesma razão da gestão)
  }

  async login(email: string, password: string): Promise<PlatformLoginResultDto> {
    const admin = await this.database.db.query.platformAdmins.findFirst({
      where: eq(platformAdmins.email, email.trim().toLowerCase()),
    });
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('Credenciais inválidas');
    if (!(await argon2.verify(admin.passwordHash, password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (admin.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: admin.id, scope: 'platform-mfa' } satisfies MfaChallengePayload,
        { secret: this.env.JWT_ACCESS_SECRET, expiresIn: 300 },
      );
      return { mfaRequired: true, mfaToken };
    }
    // MFA é obrigatório: sem 2º fator, o login só devolve o token de setup forçado.
    const mfaSetupToken = await this.jwt.signAsync(
      { sub: admin.id, scope: 'platform-mfa-setup' } satisfies MfaSetupPayload,
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: 900 },
    );
    return { mfaSetupRequired: true, mfaSetupToken };
  }

  async mfaVerify(mfaToken: string, code: string, ip?: string): Promise<PlatformTokensDto> {
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwt.verifyAsync<MfaChallengePayload>(mfaToken, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Sessão de MFA expirada — faça login novamente');
    }
    if (payload.scope !== 'platform-mfa') throw new UnauthorizedException('Token inválido');

    const admin = await this.database.db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, payload.sub) });
    if (!admin?.mfaSecret) throw new UnauthorizedException('Código inválido');
    const totpOk = authenticator.check(code, admin.mfaSecret);
    const recoveryOk = totpOk ? false : await this.consumeRecoveryCode(admin.id, code);
    if (!totpOk && !recoveryOk) throw new UnauthorizedException('Código inválido');

    const tokens = await this.issueTokens(admin.id);
    await this.audit.registrar({
      adminId: admin.id,
      acao: 'platform.login',
      entidade: 'sessao',
      entidadeId: admin.id,
      resumo: `Login do super-admin (${recoveryOk ? 'recovery code' : 'TOTP'})`,
      ip: ip ?? null,
    });
    return tokens;
  }

  // ── Setup forçado de MFA ──
  async mfaForcedSetup(setupToken: string): Promise<PlatformMfaSetupResponseDto> {
    const admin = await this.adminFromSetupToken(setupToken);
    if (admin.mfaEnabled) throw new BadRequestException('MFA já está ativo');
    const secret = authenticator.generateSecret();
    await this.database.db
      .update(platformAdmins)
      .set({ mfaSecret: secret, updatedAt: new Date() })
      .where(eq(platformAdmins.id, admin.id));
    return { secret, otpauthUrl: authenticator.keyuri(admin.email, 'VETAPP Plataforma', secret) };
  }

  async mfaForcedEnable(setupToken: string, code: string, ip?: string): Promise<PlatformMfaForcedEnableResponseDto> {
    const admin = await this.adminFromSetupToken(setupToken);
    if (!admin.mfaSecret) throw new BadRequestException('Rode o setup do MFA primeiro');
    if (!authenticator.check(code, admin.mfaSecret)) throw new UnauthorizedException('Código inválido');
    await this.database.db
      .update(platformAdmins)
      .set({ mfaEnabled: true, updatedAt: new Date() })
      .where(eq(platformAdmins.id, admin.id));
    const recoveryCodes = await this.generateRecoveryCodes(admin.id);
    const tokens = await this.issueTokens(admin.id);
    await this.audit.registrar({
      adminId: admin.id,
      acao: 'platform.login',
      entidade: 'sessao',
      entidadeId: admin.id,
      resumo: 'Login do super-admin (MFA configurado — obrigatório)',
      ip: ip ?? null,
    });
    return { ...tokens, recoveryCodes };
  }

  // ── Sessão: refresh e logout (stateful) ──
  async refresh(refreshToken: string): Promise<PlatformTokensDto> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: this.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Sessão expirada — faça login novamente');
    }
    if (payload.scope !== 'platform-refresh') throw new UnauthorizedException('Token inválido');

    const row = await this.database.db.query.platformRefreshTokens.findFirst({
      where: eq(platformRefreshTokens.id, payload.jti),
    });
    if (!row || row.family !== payload.family || row.adminId !== payload.sub) {
      throw new UnauthorizedException('Token inválido');
    }
    if (row.revokedAt) {
      await this.revokeFamily(row.family);
      throw new UnauthorizedException('Sessão revogada — faça login novamente');
    }
    if (row.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Sessão expirada — faça login novamente');

    const admin = await this.database.db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, row.adminId) });
    if (!admin || admin.status !== 'active') {
      await this.revokeFamily(row.family);
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.issueInFamily(row.adminId, row.family, row.id);
  }

  async logout(refreshToken: string, ip?: string): Promise<{ ok: boolean }> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: this.env.JWT_REFRESH_SECRET });
      if (payload.scope === 'platform-refresh') {
        await this.revokeFamily(payload.family);
        await this.audit.registrar({
          adminId: payload.sub,
          acao: 'platform.logout',
          entidade: 'sessao',
          entidadeId: payload.sub,
          resumo: 'Logout do super-admin',
          ip: ip ?? null,
        });
      }
    } catch {
      // best-effort
    }
    return { ok: true };
  }

  async me(adminId: string): Promise<PlatformMeDto> {
    const admin = await this.database.db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, adminId) });
    if (!admin) throw new UnauthorizedException();
    return { adminId: admin.id, email: admin.email, nome: admin.nome };
  }

  // ───────── internos ─────────

  private async adminFromSetupToken(setupToken: string) {
    let payload: MfaSetupPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaSetupPayload>(setupToken, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Sessão de configuração expirada — faça login novamente');
    }
    if (payload.scope !== 'platform-mfa-setup') throw new UnauthorizedException('Token inválido');
    const admin = await this.database.db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, payload.sub) });
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('Conta inválida');
    return admin;
  }

  private issueTokens(adminId: string): Promise<PlatformTokensDto> {
    return this.issueInFamily(adminId, randomUUID());
  }

  private async issueInFamily(adminId: string, family: string, replacesId?: string): Promise<PlatformTokensDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: adminId, scope: 'platform' },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.JWT_ACCESS_TTL },
    );
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.env.JWT_REFRESH_TTL * 1000);
    await this.database.db.insert(platformRefreshTokens).values({ id: jti, adminId, family, expiresAt });
    if (replacesId) {
      await this.database.db
        .update(platformRefreshTokens)
        .set({ revokedAt: new Date(), replacedById: jti })
        .where(eq(platformRefreshTokens.id, replacesId));
    }
    const refreshToken = await this.jwt.signAsync(
      { sub: adminId, jti, family, scope: 'platform-refresh' } satisfies RefreshPayload,
      { secret: this.env.JWT_REFRESH_SECRET, expiresIn: this.env.JWT_REFRESH_TTL },
    );
    return { accessToken, refreshToken };
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.database.db
      .update(platformRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(platformRefreshTokens.family, family), isNull(platformRefreshTokens.revokedAt)));
  }

  private async generateRecoveryCodes(adminId: string): Promise<string[]> {
    await this.database.db.delete(platformMfaRecoveryCodes).where(eq(platformMfaRecoveryCodes.adminId, adminId));
    const codes: string[] = [];
    const rows: { adminId: string; codeHash: string }[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      const code = `${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`;
      codes.push(code);
      rows.push({ adminId, codeHash: await argon2.hash(code, { type: argon2.argon2id }) });
    }
    await this.database.db.insert(platformMfaRecoveryCodes).values(rows);
    return codes;
  }

  private async consumeRecoveryCode(adminId: string, code: string): Promise<boolean> {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return false;
    const rows = await this.database.db.query.platformMfaRecoveryCodes.findMany({
      where: and(eq(platformMfaRecoveryCodes.adminId, adminId), isNull(platformMfaRecoveryCodes.usedAt)),
    });
    for (const row of rows) {
      if (await argon2.verify(row.codeHash, normalized)) {
        await this.database.db
          .update(platformMfaRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(eq(platformMfaRecoveryCodes.id, row.id));
        return true;
      }
    }
    return false;
  }
}
