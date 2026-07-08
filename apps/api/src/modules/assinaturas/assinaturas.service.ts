import { Injectable, NotFoundException } from '@nestjs/common';
import { count, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { assinaturas, memberships, planos, tenants } from '../../database/schema';

// Dias de tolerância após o vencimento antes de bloquear (grace period → bloqueio,
// doc 15 §4.3).
const GRACE_DAYS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface AcessoAssinatura {
  permitido: boolean;
  status: string; // efetivo (pode diferir do gravado, por vencimento)
  aviso: string | null;
}

@Injectable()
export class AssinaturasService {
  constructor(private readonly database: DatabaseService) {}

  private hojeStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private diasEntre(aStr: string, bStr: string): number {
    return Math.round((new Date(bStr).getTime() - new Date(aStr).getTime()) / DIA_MS);
  }

  /**
   * Decide se os usuários de um tenant podem logar (doc 15 §4.3). Regra:
   * - suspensa/cancelada → bloqueia sempre.
   * - sem assinatura ou sem vencimento → permite (tenants legados não são derrubados).
   * - dentro da validade → permite.
   * - vencido dentro do grace (GRACE_DAYS) → permite + aviso.
   * - vencido além do grace → bloqueia.
   */
  async avaliarAcesso(tenantId: string): Promise<AcessoAssinatura> {
    const a = await this.database.db.query.assinaturas.findFirst({ where: eq(assinaturas.tenantId, tenantId) });
    if (!a) return { permitido: true, status: 'sem-assinatura', aviso: null };
    if (a.status === 'suspensa' || a.status === 'cancelada') {
      return { permitido: false, status: a.status, aviso: 'Assinatura da clínica suspensa — fale com o suporte.' };
    }
    const venc = a.status === 'trial' ? a.trialAte ?? a.vigenteAte : a.vigenteAte;
    if (!venc) return { permitido: true, status: a.status, aviso: null };

    const hoje = this.hojeStr();
    const atraso = this.diasEntre(venc, hoje);
    if (atraso <= 0) return { permitido: true, status: a.status, aviso: null };
    if (atraso <= GRACE_DAYS) {
      return {
        permitido: true,
        status: 'inadimplente',
        aviso: `Pagamento em atraso — regularize em até ${GRACE_DAYS - atraso} dia(s) para não bloquear o acesso.`,
      };
    }
    return { permitido: false, status: 'suspensa', aviso: 'Assinatura vencida — acesso bloqueado. Fale com o suporte.' };
  }

  /** Cria uma assinatura em trial para um tenant novo (self-signup / provisionamento). */
  async garantirTrial(tenantId: string, dias = 14): Promise<void> {
    const existe = await this.database.db.query.assinaturas.findFirst({ where: eq(assinaturas.tenantId, tenantId) });
    if (existe) return;
    const trialAte = new Date(Date.now() + dias * DIA_MS).toISOString().slice(0, 10);
    await this.database.db.insert(assinaturas).values({ tenantId, status: 'trial', trialAte });
  }

  // ───────── super-admin ─────────

  async getByTenant(tenantId: string) {
    return this.database.db.query.assinaturas.findFirst({ where: eq(assinaturas.tenantId, tenantId) });
  }

  /** Atualiza a assinatura de um tenant (definir plano, status, vencimento). */
  async atualizar(
    tenantId: string,
    dto: { planoId?: string | null; status?: string; vigenteAte?: string; observacao?: string },
  ) {
    let a = await this.database.db.query.assinaturas.findFirst({ where: eq(assinaturas.tenantId, tenantId) });
    if (!a) {
      [a] = await this.database.db.insert(assinaturas).values({ tenantId }).returning();
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.planoId !== undefined) {
      patch.planoId = dto.planoId;
      if (dto.planoId) {
        const plano = await this.database.db.query.planos.findFirst({ where: eq(planos.id, dto.planoId) });
        if (!plano) throw new NotFoundException('Plano não encontrado');
        patch.precoCentavos = plano.precoCentavos;
        patch.ciclo = plano.ciclo;
      }
    }
    if (dto.status !== undefined) {
      patch.status = dto.status;
      if (dto.status === 'cancelada') patch.canceladaEm = new Date();
    }
    if (dto.vigenteAte !== undefined) patch.vigenteAte = dto.vigenteAte;
    if (dto.observacao !== undefined) patch.observacao = dto.observacao;

    const [row] = await this.database.db
      .update(assinaturas)
      .set(patch)
      .where(eq(assinaturas.tenantId, tenantId))
      .returning();
    return row;
  }

  /** Marca pago: status 'ativa' e estende o vencimento por 1 ciclo a partir de hoje. */
  async marcarPago(tenantId: string) {
    const a = await this.getByTenant(tenantId);
    if (!a) throw new NotFoundException('Assinatura não encontrada');
    const meses = a.ciclo === 'anual' ? 12 : 1;
    const base = new Date();
    base.setMonth(base.getMonth() + meses);
    const vigenteAte = base.toISOString().slice(0, 10);
    const [row] = await this.database.db
      .update(assinaturas)
      .set({ status: 'ativa', vigenteAte, updatedAt: new Date() })
      .where(eq(assinaturas.tenantId, tenantId))
      .returning();
    return row;
  }

  /** KPIs consolidados cruzando tenants (o único lugar que agrega — doc 15 §4.4). */
  async kpis() {
    const rows = await this.database.db
      .select({ status: assinaturas.status, total: count(), mrr: sql<number>`coalesce(sum(${assinaturas.precoCentavos}), 0)::int` })
      .from(assinaturas)
      .groupBy(assinaturas.status);
    const [{ totalClinicas }] = await this.database.db.select({ totalClinicas: count() }).from(tenants);
    const porStatus: Record<string, number> = {};
    let mrrCentavos = 0;
    for (const r of rows) {
      porStatus[r.status] = Number(r.total);
      if (r.status === 'ativa' || r.status === 'trial') mrrCentavos += Number(r.mrr);
    }
    return { totalClinicas: Number(totalClinicas), porStatus, mrrCentavos };
  }

  /** Lista clínicas (tenants) com a assinatura + plano + contagem de usuários. */
  async listarClinicas() {
    const ts = await this.database.db.select({ id: tenants.id, name: tenants.name }).from(tenants);
    if (ts.length === 0) return [];
    const ids = ts.map((t) => t.id);
    const asgs = await this.database.db.query.assinaturas.findMany({ where: inArray(assinaturas.tenantId, ids) });
    const plns = await this.database.db.query.planos.findMany();
    const planoById = new Map(plns.map((p) => [p.id, p]));
    const asgByTenant = new Map(asgs.map((a) => [a.tenantId, a]));
    const membs = await this.database.db
      .select({ tenantId: memberships.tenantId, total: count() })
      .from(memberships)
      .where(inArray(memberships.tenantId, ids))
      .groupBy(memberships.tenantId);
    const usuariosByTenant = new Map(membs.map((m) => [m.tenantId, Number(m.total)]));

    return ts.map((t) => {
      const a = asgByTenant.get(t.id);
      const plano = a?.planoId ? planoById.get(a.planoId) : null;
      return {
        tenantId: t.id,
        nome: t.name,
        usuarios: usuariosByTenant.get(t.id) ?? 0,
        status: a?.status ?? 'sem-assinatura',
        planoNome: plano?.nome ?? null,
        precoCentavos: a?.precoCentavos ?? 0,
        vigenteAte: a?.vigenteAte ?? a?.trialAte ?? null,
      };
    });
  }
}
