import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { refreshTokens, tutorRefreshTokens } from '../../database/schema';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1x/dia

// Gestão de sessões (doc 02 §2.3): revogação em massa (troca/reset de senha,
// desativação) e limpeza periódica de refresh tokens expirados — gestão e tutor.
@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    // Limpeza no boot e depois a cada 24h (sem dependência de scheduler).
    void this.cleanupExpired();
    this.timer = setInterval(() => void this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref(); // não segura o process
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Revoga TODAS as sessões ativas de um usuário da gestão (troca de senha/desativação). */
  async revogarUsuarioGestao(userId: string): Promise<void> {
    await this.database.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Apaga refresh tokens já EXPIRADOS (gestão e tutor). Não remove os apenas
   * revogados-mas-ainda-válidos: eles são necessários p/ a detecção de reuso até
   * expirarem. Best-effort — nunca derruba o boot.
   */
  async cleanupExpired(): Promise<{ gestao: number; tutor: number }> {
    try {
      const now = new Date();
      const g = await this.database.db
        .delete(refreshTokens)
        .where(lt(refreshTokens.expiresAt, now))
        .returning({ id: refreshTokens.id });
      const t = await this.database.db
        .delete(tutorRefreshTokens)
        .where(lt(tutorRefreshTokens.expiresAt, now))
        .returning({ id: tutorRefreshTokens.id });
      if (g.length || t.length) {
        this.logger.log(`Tokens expirados removidos: gestão=${g.length}, tutor=${t.length}`);
      }
      return { gestao: g.length, tutor: t.length };
    } catch (err) {
      this.logger.error(`Falha na limpeza de tokens: ${(err as Error).message}`);
      return { gestao: 0, tutor: 0 };
    }
  }
}
