# 08 — Roadmap por fases

Faseamento orientado pela diretriz "queremos fazer a **gestão**" — começar pelo
núcleo clínico e gerencial, deixando PDV/caixa e integrações pesadas para depois.

## Fase 0 — Fundações (habilitadores)
**Objetivo**: base técnica e de segurança antes de qualquer feature.
- Monólito modular (NestJS) + Postgres (Drizzle + RLS) + Redis em VPS Hostinger
  via Docker Compose + **Cloudflare R2** (object storage externo); reverse proxy
  (Caddy/Traefik) como único ingress, com Cloudflare na frente (CDN/WAF).
- **Auth completa**: e-mail/senha, **login Google**, **MFA (TOTP/WebAuthn)**,
  sessões server-side, RBAC + tenant scoping (docs 02, 03, 07).
- Provisionamento de tenant + seed padrão; trilha de auditoria.
- CI com SAST/SCA/secret scanning; backups automatizados.

## Fase 1 — Gestão clínica (MVP)
**Objetivo**: o produto utilizável para gerir a clínica, com o prontuário no
centro. **Sem PDV/caixa**.
- **Cadastro de clientes/animais** + ficha cliente 360 (origem capturada aqui).
- **Prontuário eletrônico** (tela central): timeline, ações rápidas, lançamento
  de atendimento/venda/orçamento; faturamento automático (configurável).
- **Cadastro único** (catálogo: produtos/serviços/exames/vacinas/medicamentos/
  cirurgias) + **Tabela de preços**.
- **Agenda** por login (médico vê a sua), tipos de atendimento, escala.
- **Internação**: boxes, internação, **mapa de execução**, parâmetros clínicos,
  modelos de prescrição, dashboard com próximo procedimento, **alta gera
  cobrança**; visão TV/tablet por box (pode entrar no fim da fase).
- **Dashboards consolidados**: Vendas (único, absorvendo redundâncias) e
  Produtividade.
- **Comissionamento**: fechamento consolidado + "minhas comissões".
- **Modelos**: receita, documento, orçamento/pacotes (itens por código).
- **Migração de dados** (planilha/import) para onboarding de tenants.
- **Home por persona** (versão inicial).

**Cortes da fase 1**: PDV, Consulta vendas (absorvida), tela de Origem dos
clientes, históricos antigos por padrão.

## Fase 2 — Financeiro + Integrações
**Objetivo**: fechar o ciclo financeiro e ativar comunicação/sincronização.
- **Módulo Financeiro**: faturas (consolidando lançamentos do clínico/internação),
  recebimentos, **saldo dos clientes**, formas de recebimento (movidos de Vendas).
- **WhatsApp**: lembretes de vacina/aniversário (manual + automático), comunicação.
- **Google Agenda**: sincronização.
- **Petlove/Vet Smart**: bases (espécies/raças/pelagens) e bulário/patologias,
  com **fallback por IA**.
- Regras de venda/desconto migradas para Configuração.
- Resolver pendências ⚪ DEFINIR (movimentos de caixa, pacotes vendidos, modelo de
  demonstrativo) com a equipe clínica.

## Fase 3 — IA + Apps nativos
**Objetivo**: diferenciais e mobilidade nativa.
- **IA**: agendamento automático (agenda + WhatsApp), enriquecimento contínuo de
  bases, assistência no atendimento.
- **Apps nativos iOS/Android** (React Native/Expo ou nativo — **[A DEFINIR]**),
  consumindo a mesma API.
- TV/tablet por box refinado; modo offline ampliado.

## Fases futuras (fora do mapeamento atual)
Estoque e serviços, Fiscal, Site, Portal do cliente, Beta — a mapear nas próximas
reuniões. A arquitetura já reserva espaço para eles.

## Sequência sugerida (dependências)
```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3
(auth/    (prontuário, (financeiro, (IA, apps
 tenant)   agenda,      whatsapp,    nativos)
           catálogo,    google,
           internação)  petlove)
```
Marcos de validação com o dono/Ana Terra ao fim de cada fase.
