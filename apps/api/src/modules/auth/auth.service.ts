import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { DatabaseService } from '../../database/database.service';
import { memberships, tenants, users } from '../../database/schema';
import type { EnvConfig } from '../../config/env';
import type { LoginDto, RegisterDto, TokensDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {}

  /**
   * Bootstrap de um novo tenant: cria a clínica, o usuário admin e o vínculo.
   * Em produção, MFA é obrigatório para admin (ver docs/spec/02) — fora do escopo
   * deste scaffold.
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

    // Insert de membership passa pelo contexto de tenant (RLS WITH CHECK).
    const [membership] = await this.database.withTenant(tenant.id, (tx) =>
      tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, role: 'admin' }).returning(),
    );

    return this.issueTokens(user.id, tenant.id, membership.role);
  }

  async login(dto: LoginDto): Promise<TokensDto> {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.email, dto.email) });
    if (!user?.passwordHash || user.status !== 'active') {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Resolve o membership/tenant (seleção de tenant ativo quando há mais de um).
    const memberList = await this.database.db.query.memberships.findMany({
      where: eq(memberships.userId, user.id),
    });
    if (memberList.length === 0) {
      throw new UnauthorizedException('Usuário sem acesso a nenhum tenant');
    }
    const member = dto.tenantId
      ? memberList.find((m) => m.tenantId === dto.tenantId)
      : memberList[0];
    if (!member) {
      throw new UnauthorizedException('Sem acesso ao tenant informado');
    }

    return this.issueTokens(user.id, member.tenantId, member.role);
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
