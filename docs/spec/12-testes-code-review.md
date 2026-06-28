# 12 — Processo de Testes e Code Review

> Define **como garantimos qualidade** no VETAPP: estratégia de testes, gates de
> CI e o processo de revisão de código. Complementa o blueprint genérico
> (`docs/blueprint/engineering-blueprint.md` §12–13) com as especificidades do
> produto (multitenancy/RLS, clínico, faturamento, API para terceiros).

## 1. Objetivos
- Impedir **regressões** em fluxos críticos (prontuário, agenda, internação,
  faturamento) e em **segurança/isolamento de tenant**.
- Dar **confiança para entregar rápido** (CI verde = mergeável).
- Tornar a revisão **objetiva** (checklist), não dependente de opinião.

## 2. Estratégia de testes (pirâmide)

```
        ╱ e2e ╲            poucos — fluxos de negócio ponta a ponta
      ╱─────────╲
    ╱ integração ╲         médios — API + banco (com RLS real)
  ╱───────────────╲
 ╱   unitários      ╲      muitos — regras de domínio puras
```

| Nível | Escopo | Ferramenta (recomendada) |
|-------|--------|--------------------------|
| **Unitário** | Regras de domínio/serviços, sem I/O | **Vitest** (ou Jest) |
| **Integração** | API + Postgres real (com RLS), filas, repositórios | Vitest + **Testcontainers** (Postgres efêmero) + Supertest |
| **Contrato** | Respostas batem com o **OpenAPI**; cliente gerado compila | Validação de schema contra OpenAPI 3.1 |
| **e2e** | Jornadas reais no front + API | **Playwright** |
| **Carga/perf** (alvos do doc 09) | Endpoints densos (prontuário, agenda) | k6 (pontual, não em todo PR) |

## 3. Testes obrigatórios e específicos do VETAPP

Estes **não são opcionais** — refletem riscos do domínio:

1. **Isolamento de tenant (multitenancy)** — para entidades sensíveis, um teste que
   prova que **tenant A nunca lê/escreve dados do tenant B**, exercitando o **RLS
   real** no Postgres (não mockado). Roda na suíte de integração. Ver doc 03.
2. **Autorização (RBAC + escopos)** — cada rota protegida tem teste de "papel sem
   permissão recebe 403"; tokens de API respeitam escopos (doc 07, doc 11).
3. **Faturamento acoplado ao clínico** — eventos `atendimento.realizado`,
   `medicacao.executada`, `internacao.alta` geram os lançamentos esperados
   (doc 04 §3); sem duplicidade (idempotência).
4. **Fluxos clínicos críticos (e2e)** — abrir prontuário → lançar atendimento →
   gerar venda; admitir internação → executar medicação (baixa + cor) → alta com
   cobrança.
5. **Webhooks de saída** — assinatura HMAC válida, retry/back-off e dead-letter
   (doc 11 §6).
6. **Migrations** — sobem e descem (reversíveis) numa base limpa; seed padrão de
   tenant funciona.

## 4. Dados de teste
- **Fixtures/factories** por domínio; **seed por tenant** reutilizando o seed de
  provisionamento real (doc 03 §5) para evitar divergência.
- Banco de teste **efêmero** (Testcontainers) por execução — isolado e
  reprodutível; nada de base compartilhada mutável.
- Dados sintéticos; **nunca** dados reais de clínica/paciente em teste.

## 5. Metas de cobertura (pragmáticas)
- **Domínio/regras de negócio**: alvo **≥ 85%** de linhas/branches.
- **Camada de API**: caminhos felizes + erros principais + authz.
- **Global**: meta de referência **~70%**, sem perseguir 100% vaidoso.
- O que importa: **caminhos críticos cobertos**, não o número absoluto.
- Cobertura medida na CI; **queda** de cobertura sinaliza no PR (não bloqueia
  automaticamente, mas exige justificativa).

## 6. Gates de CI (bloqueiam o merge)

A pipeline roda em todo PR e **bloqueia** se falhar:

1. **Lint** (ESLint) + **format check** (Prettier).
2. **Type-check** (`tsc --noEmit`) em todo o monorepo.
3. **Testes** unitários + integração (com Postgres/RLS) verdes.
4. **Build** de `api`, `web` (e `mobile` quando existir).
5. **Segurança**: **SAST**, **SCA** (deps), **secret scanning**, scan de imagem
   Docker (CVE) — ver doc 02 §7.
6. **OpenAPI**: spec válida e cliente gerado compila (sem drift).
7. **Workflows/IaC válidos**: lint dos arquivos de CI/CD (`.github/workflows/*.yml`)
   e demais YAML (compose, k8s) — validar **sintaxe** antes do merge. Ver §6.1.
8. e2e (Playwright) em PRs que tocam fluxos de UI/críticos (ou no merge para
   `main`, conforme custo).

### 6.1 Validar o próprio workflow (lição estrutural)
Um **erro de sintaxe no YAML do workflow** causa *startup failure*: a run termina
em `failure` **sem criar nenhum job** — não aparece como falha de teste/build e
**passa despercebido** quando não há *required checks*. Já aconteveu neste projeto
(`run: echo "TODO: ..."` — o `: ` num escalar sem aspas quebrava o parser).
Defesas:
- **Validar o YAML** localmente/na CI (ex.: `python -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"` ou `actionlint`).
- **Required status checks** (abaixo) — sem isso, um workflow que nunca roda deixa
  PRs verdes por omissão.
- Ao mexer em workflow, confirmar que a run **criou jobs** (não só "passou").

### 6.2 Proteção de branch (`main`)
Configurar no GitHub (Settings → Branches), tornando objetivos os gates acima:
- **Required status checks** = os jobs da CI (`api`, `web`; `security` quando sair
  de placeholder), com *Require branches to be up to date*.
- **Require a pull request before merging** + **≥ 1 aprovação** (2 quando tocar
  auth/dados/RLS/fiscal/faturamento).
- **Require conversation resolution**; bloquear *force-push* e deleção da `main`.
- Sem required checks, "CI verde" é só convenção — um *startup failure* ou
  workflow ausente passa batido.

**Checks obrigatórios deste repositório** (nomes exatos a marcar como required, em
Settings → Branches/Rulesets, após rodarem ao menos uma vez):
- `API (lint · types · test · build)`
- `Web (typecheck · build)`
- `Security (SAST · SCA · secrets)` *(opcional enquanto for placeholder)*

## 7. Processo de Code Review

### 7.1 Regras
- **PRs pequenos e focados** (idealmente < ~400 linhas de diff); um assunto por PR.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`…).
- **Template de PR** com: o quê/porquê, como testar, riscos, e itens do checklist.
- **Pelo menos 1 aprovação**; **2 aprovações + revisão de segurança** quando o PR
  toca **autenticação/autorização, dados pessoais/clínicos, RLS/multitenancy,
  fiscal ou faturamento**.
- Autor **não** faz self-merge dos PRs sensíveis acima.
- Feedback de review respondido ou aplicado antes do merge; threads resolvidos.

### 7.2 Checklist do revisor
- [ ] **Corretude**: resolve o problema; casos de borda tratados.
- [ ] **Segurança**: authz no servidor; sem segredo no código; input validado;
      query escopada por tenant (RLS não foi contornado).
- [ ] **Multitenancy**: nada cross-tenant; `tenant_id` presente onde devido.
- [ ] **Testes**: cobre o caminho novo; testes de tenant/authz quando aplicável.
- [ ] **API**: mudou contrato? OpenAPI atualizado + versionamento/depreciação.
- [ ] **Dados**: migration reversível e revisada; índices/constraints adequados.
- [ ] **Observabilidade**: logs/erros do que foi entregue, sem dado sensível.
- [ ] **UX**: segue princípios (navegação em contexto, sem botão inerte) e design
      system (tokens/componentes base), quando for front.
- [ ] **Simplicidade**: sem complexidade desnecessária; legível.

### 7.3 Definition of Done
Uma tarefa só está "pronta" quando: código + testes + docs/ADR (se decisão
relevante) + **CI verde** + review aprovado + observabilidade do que foi entregue
+ sem TODO crítico em aberto.

## 8. Ferramentas de apoio
- **Revisão assistida**: usar a skill `/code-review` no diff antes de pedir review
  humano (pega bugs e oportunidades de simplificação).
- **Pre-commit hooks** (lint/format/type rápido) para feedback local antes do push.
- **Security review** (`/security-review`) nos PRs sensíveis da §7.1.

## 9. Ambientes e gates de promoção
- `PR` → roda CI completa.
- `main` (merge) → deploy automático em **staging**; e2e + smoke.
- **Produção** → promoção a partir de staging aprovada, com **rollback** fácil
  (ver doc 01/09). Migrations aplicadas pela pipeline, nunca à mão.

## 10. Pendências **[A DEFINIR]**
- Rodar e2e em todo PR vs. só no merge para `main` (custo × cobertura).
- Provedor de CI (GitHub Actions é o default) e de error tracking (ex.: Sentry).
- Política exata de cobertura mínima que **bloqueia** (hoje só sinaliza).
