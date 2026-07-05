import { ConflictException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { DatabaseService } from '../../database/database.service';
import { memberships, tenants, users } from '../../database/schema';
import { AssinaturasService } from '../assinaturas/assinaturas.service';
import type { ProvisionarClinicaResultDto } from './platform-admin.dto';

// Provisionamento de clínica pelo super-admin (doc 15 §4.2): cria o tenant, o 1º
// admin (senha temporária) e a assinatura em trial. Substitui/complementa o
// self-signup "solto".
@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly assinaturas: AssinaturasService,
  ) {}

  async provisionar(nome: string, adminEmail: string, adminNome: string): Promise<ProvisionarClinicaResultDto> {
    const email = adminEmail.trim().toLowerCase();
    const existente = await this.database.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existente) throw new ConflictException('Já existe um usuário com este e-mail');

    const [tenant] = await this.database.db.insert(tenants).values({ name: nome.trim() }).returning();

    const senhaTemporaria = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(senhaTemporaria, { type: argon2.argon2id });
    const [user] = await this.database.db
      .insert(users)
      .values({ email, name: adminNome.trim(), passwordHash })
      .returning();

    await this.database.withTenant(tenant.id, (tx) =>
      tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, role: 'admin' }),
    );
    await this.assinaturas.garantirTrial(tenant.id);

    return { tenantId: tenant.id, adminUserId: user.id, senhaTemporaria };
  }
}
