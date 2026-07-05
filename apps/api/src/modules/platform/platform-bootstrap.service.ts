import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { DatabaseService } from '../../database/database.service';
import { platformAdmins } from '../../database/schema';
import type { EnvConfig } from '../../config/env';

// Bootstrap do 1º super-admin da plataforma (doc 15 §2). Se PLATFORM_BOOTSTRAP_EMAIL
// e PLATFORM_BOOTSTRAP_PASSWORD estiverem na ENV, cria/garante esse admin no boot —
// idempotente. O SEGREDO vive só na ENV (Coolify), NUNCA no repo. Sem as ENVs, não
// faz nada (a app sobe normalmente). Alterar a senha na ENV propaga no próximo boot.
@Injectable()
export class PlatformBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PlatformBootstrapService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.env.PLATFORM_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const password = this.env.PLATFORM_BOOTSTRAP_PASSWORD;
    if (!email || !password) return;

    try {
      const existing = await this.database.db.query.platformAdmins.findFirst({
        where: eq(platformAdmins.email, email),
      });
      if (!existing) {
        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        await this.database.db.insert(platformAdmins).values({ email, nome: 'Admin da Plataforma', passwordHash });
        this.logger.log(`Super-admin da plataforma criado: ${email}`);
        return;
      }
      // Já existe: garante ativo e sincroniza a senha se a ENV mudou.
      const senhaConfere = await argon2.verify(existing.passwordHash, password).catch(() => false);
      if (!senhaConfere || existing.status !== 'active') {
        const passwordHash = senhaConfere ? existing.passwordHash : await argon2.hash(password, { type: argon2.argon2id });
        await this.database.db
          .update(platformAdmins)
          .set({ passwordHash, status: 'active', updatedAt: new Date() })
          .where(eq(platformAdmins.id, existing.id));
        this.logger.log(`Super-admin da plataforma atualizado: ${email}`);
      }
    } catch (err) {
      // Best-effort: nunca derruba o boot por causa do bootstrap.
      this.logger.error(`Falha no bootstrap do super-admin: ${(err as Error).message}`);
    }
  }
}
