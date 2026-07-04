import { pgTable, uuid, text, timestamp, integer, date, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { itensCatalogo } from './catalogo';

// Estoque fase 1: movimentações como fonte da verdade (auditável); o saldo é a
// SOMA das quantidades — sem coluna de saldo materializada (doc 13 §2).
// Convenção de sinal em `quantidade`:
//   entrada → positivo | saida → negativo | ajuste → delta com sinal (inventário).
// Baixa automática (venda / medicação na internação) e depósitos/lotes → fase 2.
export const estoqueMovimentos = pgTable(
  'estoque_movimentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull().references(() => itensCatalogo.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(), // entrada | saida | ajuste
    quantidade: integer('quantidade').notNull(), // com sinal (ver convenção acima)
    // Custo unitário na entrada (compra) — centavos. Null nas demais.
    custoCentavos: integer('custo_centavos'),
    // Lote e validade (informados na entrada) → alerta de vencimento (doc 13 §2, fase 2).
    lote: text('lote'),
    validade: date('validade', { mode: 'string' }),
    motivo: text('motivo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('estoque_movimentos_tenant_idx').on(t.tenantId),
    itemIdx: index('estoque_movimentos_item_idx').on(t.tenantId, t.itemId),
    validadeIdx: index('estoque_movimentos_validade_idx').on(t.tenantId, t.validade),
  }),
);

export type EstoqueMovimento = typeof estoqueMovimentos.$inferSelect;
