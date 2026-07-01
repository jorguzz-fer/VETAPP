import { pgTable, uuid, text, timestamp, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Cadastro ÚNICO de produtos/serviços + tabela de preços (docs/spec/05 §8/§4.7).
// Item referenciado por CÓDIGO (decisão do dono — doc 05 §4.11). Preço em centavos.
// Vigência/histórico de preços fica para iteração futura (doc 04 modela `preco` à parte).
export const itensCatalogo = pgTable(
  'itens_catalogo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    codigo: text('codigo').notNull(),
    nome: text('nome').notNull(),
    tipo: text('tipo').notNull(), // produto | servico | exame | vacina | medicamento | cirurgia
    precoCentavos: integer('preco_centavos').notNull().default(0),
    ativo: boolean('ativo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('itens_catalogo_tenant_idx').on(t.tenantId),
    codigoUniq: uniqueIndex('itens_catalogo_codigo_uniq').on(t.tenantId, t.codigo),
    nomeIdx: index('itens_catalogo_nome_idx').on(t.tenantId, t.nome),
  }),
);

export type ItemCatalogo = typeof itensCatalogo.$inferSelect;
