# 06 — Integrações

Todas as integrações seguem a regra de segurança: **credenciais e tokens vivem
apenas no servidor** (cofre/KMS), por tenant, com escopo mínimo; o cliente nunca
os vê (ver doc 02). Integrações rodam em **workers** desacoplados, acionados por
eventos de domínio ou agendamento.

## 1. Petlove / Vetlove / Vet Smart — bases e bulário
- **Objetivo**: puxar **espécies, raças, pelagens** e **bulário/patologias**
  inteligentes em vez de cadastro manual.
- **Modelo**: catálogo **global** read-only (ver doc 03 §6), sincronizado
  periodicamente; cada tenant pode estender localmente.
- **Uso clínico**: no cadastro do animal, escolher espécie/raça **autopreenche**;
  patologias enriquecem as tags do prontuário e a prescrição.
- **Contexto estratégico**: a Petlove concentra o mercado (SimplesVet + Vet Smart
  são dela). O VETAPP integra-se de forma **independente** — se a API não estiver
  disponível, a base pode ser **populada por IA** (fallback) e mantida própria.
- **[A DEFINIR]**: disponibilidade/contrato de API pública da Petlove/Vet Smart;
  caso não haja, priorizar enriquecimento por IA + base própria.

## 2. Google
### 2.1 Login com Google (OIDC) — "Google connectors"
- Login social validado **no servidor** (ver doc 02 §2.1).

### 2.2 Google Agenda
- **Sincronização bidirecional** da agenda da clínica (por profissional/tenant).
- Habilita **agendamento automático por IA** (ver §4).
- OAuth com escopo mínimo (apenas calendar do tenant autorizado); token no cofre;
  webhooks de mudança verificados por assinatura.
- `agendamento.google_event_id` liga o evento local ao Google (ver doc 04).

## 3. WhatsApp — lembretes e comunicação
- **Casos de uso**: lembrete de **vacina vencida**, **aniversário** (mensagem/
  brinde), comunicação geral com o responsável, comunicados de internação.
- **Modo**: manual (botão de ação na lista) **e** automático (gatilho por evento/
  agendamento). Respeitar **opt-out** do responsável (`opt_out_msg`).
- **API**: WhatsApp Business (Cloud API) **[A DEFINIR provedor]** — número e
  templates por tenant; envio via worker; status de entrega persistido em
  `mensagem`.
- **Substitui** o atual "WhatsApp Web" por integração nativa (diretriz 2.2).

## 4. IA — enriquecimento, agendamento e atendimento
- **Enriquecimento de bases**: popular/limpar patologias e bulário quando a
  integração externa não cobrir (ver §1).
- **Agendamento automático**: a partir da agenda sincronizada (Google) + regras de
  tipo de atendimento, sugerir/criar agendamentos (ex.: via WhatsApp).
- **Atendimento**: lembretes inteligentes, marcação automática, sugestões no
  prontuário. Fica para **fase 3**.
- **Segurança/privacidade**: dados clínicos/pessoais enviados a modelos de IA
  exigem política de tratamento (anonimização quando possível, contrato de
  processamento, opção de IA self-hosted). **[A DEFINIR]** o provedor de modelo;
  preferir modelos Claude para qualidade, com avaliação de residência de dados.

## 5. Migração de dados (entrada de novos tenants)
- 🔵 **Padrão de migração** ao trocar de software: importar base própria do
  cliente ou **planilha-modelo** para preencher (citado para prescrições e bases
  em geral).
- Importadores idempotentes, com validação e relatório de erros, escopados por
  tenant; itens referenciados por **código**.

## 6. Faturamento integrado (interno, mas transversal)
Não é integração externa, mas é o "conector" entre clínico e financeiro: eventos
`atendimento.realizado`, `medicacao.executada`, `internacao.alta` geram
lançamentos automáticos (ver doc 04 §3). Mantido aqui como lembrete de que o
princípio atravessa todos os módulos.

## 7. Resumo de prioridade por fase
| Integração | Fase |
|------------|------|
| Login Google (OIDC) | 1 (parte de auth) |
| Migração de dados (planilha/import) | 1 (onboarding de tenants) |
| WhatsApp (lembretes vacina/aniversário) | 2 |
| Google Agenda (sync) | 2 |
| Petlove/Vet Smart (bases/bulário) | 2 (com fallback IA) |
| IA (agendamento/atendimento) | 3 |
