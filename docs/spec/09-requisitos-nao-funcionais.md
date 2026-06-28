# 09 — Requisitos não-funcionais

## 1. Desempenho e UX
- Telas densas (prontuário, agenda, internação) devem abrir com **percepção
  instantânea**: alvo p95 < 300 ms para leituras servidas por cache, < 1 s para
  consultas compostas.
- **Navegação em contexto** (sem empilhar telas) — requisito de UX que vira
  requisito de arquitetura do front (estado preservado, transições in-place).
- **Realtime** na internação (mapa de execução, TV/tablet) com latência < 2 s na
  propagação de uma execução/baixa.
- **Mobile-first/responsivo**; PWA com leitura offline básica (prontuário, fila).

## 2. Disponibilidade e resiliência
- Alvo inicial de disponibilidade **99,5%** (VPS única) → evoluir para 99,9% ao
  separar Postgres e replicar a API.
- Degradação graciosa: se uma integração (Google/WhatsApp/Petlove/IA) cair, o
  núcleo clínico continua funcionando (workers reprocessam depois).
- Filas com retry/back-off e dead-letter para eventos de faturamento/lembrete.

## 3. Backup e Disaster Recovery (DR)
- **Postgres**: dump diário + WAL/PITR quando possível; retenção definida por
  política.
- **Cloudflare R2 (anexos)**: durável/replicado pela Cloudflare; habilitar
  **versionamento de objetos** e regras de **lifecycle** (retenção); opcionalmente
  replicar para um segundo bucket/conta como cópia independente.
- Backups do Postgres **cifrados** e enviados para storage externo (fora da VPS);
  anexos já residem fora da VPS (R2).
- **RPO** alvo ≤ 24 h (melhorar com PITR); **RTO** alvo ≤ 4 h.
- Teste de restauração periódico (backup não testado não é backup).

## 4. Segurança (resumo — detalhe no doc 02)
- Única superfície pública (proxy 443); banco/Redis/workers privados, sem porta
  exposta. Object storage no **R2** (externo), acessado só pelo servidor; cliente
  recebe apenas URLs assinadas.
- Auth/authz server-side, MFA, RBAC + tenant scoping, RLS no banco.
- Segredos em cofre; TLS em trânsito; criptografia em repouso; auditoria imutável.

## 5. Privacidade e conformidade (LGPD)
- Dados de responsáveis e dados clínicos tratados como sensíveis: minimização,
  finalidade, retenção e descarte definidos.
- Direitos do titular: acesso, correção, portabilidade (exportação por tenant),
  exclusão sob processo auditado.
- Registro de consentimento para comunicações (WhatsApp/campanhas) e respeito ao
  **opt-out**.
- **Residência de dados**: preferência por hospedagem em **região no Brasil**
  (confirmar oferta Hostinger). **[A DEFINIR]**
- DPA com terceiros (WhatsApp, provedor de IA, Google).

## 6. Observabilidade
- **Logs estruturados** com `tenant_id`/`user_id`/`request_id` (sem dados
  sensíveis em claro).
- **Métricas** (Prometheus/Grafana) e alertas; healthchecks por serviço.
- **Tracing** distribuído nos fluxos críticos (prontuário→faturamento,
  internação→execução).
- Painéis de observabilidade acessíveis **só** por rede interna/VPN.

## 7. Qualidade e manutenção
- **TypeScript end-to-end**; lint/format padronizados; schema Drizzle versionado.
- Testes: unitários no domínio, integração na API, e2e nos fluxos-chave; **testes
  de isolamento multitenant** (tenant A nunca lê tenant B) na CI.
- Contratos via **OpenAPI**; clientes gerados (web/mobile) para evitar drift.
- Migrations idempotentes e reversíveis (`drizzle-kit`).

## 8. Acessibilidade e i18n
- Acessibilidade (contraste, navegação por teclado, leitores de tela) como meta
  de design system.
- Internacionalização preparada (pt-BR primeiro), formatos de data/moeda
  localizados.

## 9. Escalabilidade
- Multitenant compartilhado escala por linhas, não por instâncias (1 deploy serve
  N clínicas).
- Caminho de escala: cache (Redis) → réplicas de leitura no Postgres → separar
  workers/realtime → múltiplas VPS atrás do proxy. Sem reescrever (monólito
  modular permite extração de serviços por domínio quando necessário).
