import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { planos } from '../../database/schema';

// Planos padrão semeados no boot (idempotente por slug). O super-admin edita depois.
const PLANOS_PADRAO = [
  { nome: 'Essencial', slug: 'essencial', precoCentavos: 14900, ciclo: 'mensal' },
  { nome: 'Profissional', slug: 'profissional', precoCentavos: 29900, ciclo: 'mensal' },
  { nome: 'Clínica+', slug: 'clinica-plus', precoCentavos: 49900, ciclo: 'mensal' },
];

@Injectable()
export class PlanosService implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  // Semeia os planos padrão (só cria os que faltam — não sobrescreve edições).
  async onModuleInit(): Promise<void> {
    try {
      for (const p of PLANOS_PADRAO) {
        const existe = await this.database.db.query.planos.findFirst({ where: eq(planos.slug, p.slug) });
        if (!existe) await this.database.db.insert(planos).values(p);
      }
    } catch {
      // Best-effort: tabela pode não existir ainda em algum fluxo — não derruba o boot.
    }
  }

  list() {
    return this.database.db.query.planos.findMany();
  }

  async criar(dto: { nome: string; slug: string; precoCentavos: number; ciclo: string }) {
    const existe = await this.database.db.query.planos.findFirst({ where: eq(planos.slug, dto.slug) });
    if (existe) throw new ConflictException(`Slug "${dto.slug}" já existe`);
    const [row] = await this.database.db.insert(planos).values(dto).returning();
    return row;
  }

  async atualizar(id: string, dto: Partial<{ nome: string; precoCentavos: number; ciclo: string; ativo: string }>) {
    const [row] = await this.database.db
      .update(planos)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(planos.id, id))
      .returning();
    if (!row) throw new NotFoundException('Plano não encontrado');
    return row;
  }
}
