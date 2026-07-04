# 03 — Multitenancy

> Diretriz: a plataforma é **multitenant** — uma instalação serve várias clínicas
> com isolamento rígido de dados.

## 1. Estratégia recomendada: **shared DB, shared schema + RLS**

- **Um banco PostgreSQL**, tabelas compartilhadas, cada linha carimbada com
  `tenant_id` (FK para `tenants`).
- **Row-Level Security (RLS)** do Postgres garante, no nível do banco, que cada
  conexão só enxergue linhas do seu tenant — defesa que **independe** de o código
  da aplicação lembrar de filtrar.
- Vantagens: operação simples (1 banco), migrations únicas, custo eficiente em
  VPS, e bom isolamento com RLS. É o melhor encaixe para VPS Hostinger.

### Alternativas consideradas
- **Schema por tenant**: melhor isolamento percebido, mas migrations e operação
  ficam pesadas com muitos tenants. **[A DEFINIR]** se algum cliente exigir
  isolamento físico.
- **Banco por tenant**: isolamento máximo, custo/operação altos; reservar para
  clientes enterprise específicos no futuro.

## 2. Como funciona com Drizzle + RLS

O segredo é **toda conexão de request rodar dentro de uma transação que fixa o
tenant**:

1. O BFF/guard resolve o `tenant_id` da sessão (server-side, nunca do body do
   cliente).
2. Ao obter a conexão para aquele request, executa:
   `SET LOCAL app.current_tenant = '<tenant_id>'` dentro da transação.
3. As políticas RLS das tabelas usam
   `USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)`.
   - **Lição estrutural:** use `NULLIF(..., '')` e o `missing_ok = true`. Sem isso,
     um GUC ausente devolve **string vazia** `''`, e `''::uuid` lança erro
     (`22P02`) em vez de retornar zero linhas. Com o NULLIF, "tenant não fixado"
     vira **fail-closed** (0 linhas), não uma exceção.
4. O Drizzle monta as queries normalmente; mesmo que um filtro de `tenant_id` seja
   esquecido no código, o **RLS barra** o vazamento.

```
// pseudo-fluxo por request (Drizzle)
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.current_tenant = ${tenantId}`);
  // ...todas as queries do request usam tx; RLS aplica o escopo
});
```

- O usuário de banco da aplicação **não** tem `BYPASSRLS`.
- Tarefas administrativas (migrations, jobs cross-tenant) usam um papel
  separado e auditado.
- Schema Drizzle: `tenant_id uuid not null` em todas as tabelas de domínio +
  índices compostos iniciando por `tenant_id` (performance e isolamento).

## 3. Tenant context em todas as camadas

| Camada | Como o tenant aparece |
|--------|------------------------|
| Auth/sessão | `tenant_id` na sessão server-side; usuário pode pertencer a 1+ tenants |
| API | Resolvido por guard/interceptor; nunca aceito do cliente |
| Banco | Coluna `tenant_id` + RLS + índices compostos |
| Cache (Redis) | Chaves prefixadas por `tenant_id` |
| Object storage | Prefixo de path por `tenant_id`; URLs assinadas |
| Logs/métricas | `tenant_id` como label/campo estruturado |
| Filas/eventos | `tenant_id` no payload do evento |

## 4. Usuários e múltiplos tenants

- Um usuário (ex.: veterinário volante, ou o dono com mais de uma clínica) pode
  pertencer a **múltiplos tenants**, com papéis distintos em cada um.
- Após login, se houver mais de um tenant, o usuário **seleciona o tenant ativo**;
  o servidor emite a sessão já escopada.
- Trocar de tenant exige nova resolução de permissões (e, conforme política,
  reautenticação).

### 4.1 Ler os vínculos no login sem BYPASSRLS (`app.current_user`)

O login é um paradoxo de RLS: precisa **descobrir a que tenants o usuário
pertence** (`memberships`) **antes** de existir um `app.current_tenant` para
fixar. Como a app conecta como `vetapp_app` (`NOBYPASSRLS`), uma leitura de
`memberships` sem tenant fixado cai na policy fail-closed e volta **zero linhas**
— o usuário recebe "sem acesso a nenhum tenant" mesmo tendo vínculo (bug latente
que só aparece com o role restrito de produção; some quando a conexão é
superusuário em dev).

Solução **fail-closed, sem bypass**: uma segunda policy PERMISSIVE **só de
SELECT** em `memberships` que libera a linha quando `app.current_user` casa com o
`user_id`:

```sql
CREATE POLICY "memberships_self_read" ON "memberships"
  FOR SELECT
  USING ("user_id" = NULLIF(current_setting('app.current_user', true), '')::uuid);
```

O fluxo de auth usa `DatabaseService.withUser(userId, fn)` (fixa
`app.current_user` via `SET LOCAL`) apenas para essa leitura. Garantias:
- **Não vaza entre tenants**: fora do login, `app.current_user` nunca é setado →
  `NULLIF(...,'')` vira NULL → a policy é inerte; as queries normais (que fixam
  `app.current_tenant`) continuam sob `memberships_tenant_isolation`.
- **Escrita permanece tenant-scoped**: a policy é `FOR SELECT`, então `INSERT`
  em `memberships` (register) continua exigindo `withTenant`.
- **Escopo mínimo**: `app.current_user` só resolve identidade (memberships);
  nunca substitui o `app.current_tenant` dos dados operacionais.

Prova na CI: `test/tenant-isolation.spec.ts` cobre self-read multi-tenant,
não-vazamento entre usuários, fail-closed sem GUC e isolamento por tenant
preservado.

## 5. Ciclo de vida do tenant
- **Provisionamento**: criar tenant → seed de dados padrão (tipos de atendimento,
  parâmetros clínicos, papéis) → criar primeiro admin (com MFA obrigatório).
- **Configuração por tenant**: horário de funcionamento, usuários com agenda,
  regras de venda/desconto, formas de recebimento, modelos (receita, documento,
  orçamento), integrações (Google/WhatsApp/Petlove).
- **Suspensão/encerramento**: bloqueio de acesso preservando dados pelo prazo
  legal; exportação de dados do tenant (portabilidade LGPD); exclusão definitiva
  sob processo auditado.
- **Personalização**: marca/logo por tenant; dados de bases globais (raças,
  espécies, bulário) podem ser **compartilhados** entre tenants (catálogo global
  read-only) e estendidos localmente.

## 6. Dados globais vs. dados do tenant

| Tipo | Escopo | Exemplos |
|------|--------|----------|
| Catálogo global (read-only) | Compartilhado | Espécies, raças, pelagens, bulário/patologias vindos da Petlove/Vet Smart/IA |
| Catálogo do tenant | Por tenant | Produtos/serviços, exames, vacinas, preços, modelos, tipos de atendimento |
| Operacional | Por tenant | Clientes, animais, prontuários, agenda, vendas, internações |
| Identidade | Global + vínculo | Usuários (podem servir vários tenants via `membership`) |

Bases globais reduzem cadastro manual (diretriz dos Cadastros) e são enriquecidas
por integração/IA, sem que um tenant veja dados operacionais de outro.
