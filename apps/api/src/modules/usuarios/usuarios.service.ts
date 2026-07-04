import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { memberships, users } from '../../database/schema';
import { SessionsService } from '../sessions/sessions.service';
import type { AtualizarUsuarioDto, CriarUsuarioDto, CriarUsuarioResultDto, UsuarioDto } from './usuarios.dto';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: SessionsService,
  ) {}

  /** Lista a equipe do tenant (memberships sob RLS + users global). */
  async list(tenantId: string): Promise<UsuarioDto[]> {
    const members = await this.database.withTenant(tenantId, (tx) =>
      tx.query.memberships.findMany({ where: eq(memberships.tenantId, tenantId) }),
    );
    if (members.length === 0) return [];
    const ids = members.map((m) => m.userId);
    const us = await this.database.db.query.users.findMany({ where: inArray(users.id, ids) });
    const byId = new Map(us.map((u) => [u.id, u]));
    return members
      .map((m) => {
        const u = byId.get(m.userId);
        return u
          ? { userId: u.id, nome: u.name, email: u.email, role: m.role, status: u.status, mfaEnabled: u.mfaEnabled }
          : null;
      })
      .filter((x): x is UsuarioDto => x !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  /** Cria (ou vincula um existente) um usuário ao tenant, com papel. */
  async criar(tenantId: string, dto: CriarUsuarioDto): Promise<CriarUsuarioResultDto> {
    const email = dto.email.trim().toLowerCase();
    const existente = await this.database.db.query.users.findFirst({ where: eq(users.email, email) });

    if (existente) {
      const jaMembro = await this.database.withTenant(tenantId, (tx) =>
        tx.query.memberships.findFirst({
          where: and(eq(memberships.tenantId, tenantId), eq(memberships.userId, existente.id)),
        }),
      );
      if (jaMembro) throw new ConflictException('Este usuário já faz parte da equipe');
      await this.database.withTenant(tenantId, (tx) =>
        tx.insert(memberships).values({ tenantId, userId: existente.id, role: dto.role }),
      );
      return {
        userId: existente.id,
        nome: existente.name,
        email: existente.email,
        role: dto.role,
        status: existente.status,
        mfaEnabled: existente.mfaEnabled,
        senhaTemporaria: null,
      };
    }

    const senhaTemporaria = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(senhaTemporaria, { type: argon2.argon2id });
    const [user] = await this.database.db
      .insert(users)
      .values({ email, name: dto.nome.trim(), passwordHash })
      .returning();
    await this.database.withTenant(tenantId, (tx) =>
      tx.insert(memberships).values({ tenantId, userId: user.id, role: dto.role }),
    );
    return {
      userId: user.id,
      nome: user.name,
      email: user.email,
      role: dto.role,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      senhaTemporaria,
    };
  }

  async atualizar(
    tenantId: string,
    actorUserId: string,
    userId: string,
    dto: AtualizarUsuarioDto,
  ): Promise<UsuarioDto> {
    const membro = await this.membroDoTenant(tenantId, userId);

    if (dto.role !== undefined && dto.role !== membro.role) {
      // Rebaixar um admin: garantir que não é o último, nem a si mesmo.
      if (membro.role === 'admin' && dto.role !== 'admin') {
        this.assertNaoEhProprio(actorUserId, userId, 'Você não pode rebaixar a si mesmo');
        await this.assertNaoEhUltimoAdmin(tenantId, userId);
      }
      await this.database.withTenant(tenantId, (tx) =>
        tx
          .update(memberships)
          .set({ role: dto.role })
          .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId))),
      );
    }

    if (dto.status !== undefined) {
      if (dto.status === 'disabled') {
        this.assertNaoEhProprio(actorUserId, userId, 'Você não pode desativar a si mesmo');
        if (membro.role === 'admin') await this.assertNaoEhUltimoAdmin(tenantId, userId);
      }
      await this.database.db.update(users).set({ status: dto.status, updatedAt: new Date() }).where(eq(users.id, userId));
      // Desativar a conta encerra as sessões ativas (doc 02 §2.3).
      if (dto.status === 'disabled') await this.sessions.revogarUsuarioGestao(userId);
    }

    return (await this.list(tenantId)).find((u) => u.userId === userId)!;
  }

  /** Gera uma nova senha temporária (mostrada uma vez) e encerra as sessões ativas. */
  async resetSenha(tenantId: string, userId: string): Promise<{ senhaTemporaria: string }> {
    await this.membroDoTenant(tenantId, userId); // garante que é da equipe deste tenant
    const senhaTemporaria = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(senhaTemporaria, { type: argon2.argon2id });
    await this.database.db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    // Troca de senha revoga as sessões vigentes (doc 02 §2.3): o usuário reloga.
    await this.sessions.revogarUsuarioGestao(userId);
    return { senhaTemporaria };
  }

  /** Remove o acesso do usuário a ESTE tenant (não apaga a conta global). */
  async remover(tenantId: string, actorUserId: string, userId: string): Promise<{ ok: boolean }> {
    const membro = await this.membroDoTenant(tenantId, userId);
    this.assertNaoEhProprio(actorUserId, userId, 'Você não pode remover a si mesmo');
    if (membro.role === 'admin') await this.assertNaoEhUltimoAdmin(tenantId, userId);
    await this.database.withTenant(tenantId, (tx) =>
      tx.delete(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId))),
    );
    return { ok: true };
  }

  // ───────── helpers ─────────

  private async membroDoTenant(tenantId: string, userId: string) {
    const membro = await this.database.withTenant(tenantId, (tx) =>
      tx.query.memberships.findFirst({
        where: and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)),
      }),
    );
    if (!membro) throw new NotFoundException('Usuário não encontrado na equipe');
    return membro;
  }

  private assertNaoEhProprio(actorUserId: string, userId: string, msg: string): void {
    if (actorUserId === userId) throw new BadRequestException(msg);
  }

  private async assertNaoEhUltimoAdmin(tenantId: string, userId: string): Promise<void> {
    const admins = await this.database.withTenant(tenantId, (tx) =>
      tx.query.memberships.findMany({ where: and(eq(memberships.tenantId, tenantId), eq(memberships.role, 'admin')) }),
    );
    const outrosAdmins = admins.filter((a) => a.userId !== userId);
    if (outrosAdmins.length === 0) {
      throw new ForbiddenException('A clínica precisa de pelo menos um admin');
    }
  }
}
