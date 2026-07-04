# 13 — Módulos complementares (Financeiro, Estoque, Fiscal, Site, Portal)

> **Status: RASCUNHO a validar.** Estes módulos **não foram mapeados na reunião**
> (o documento-fonte os excluiu — ver `fonte-mapeamento.md`). Este doc é uma
> **primeira proposta** ancorada nas decisões já tomadas e em práticas do setor,
> para destravar o roadmap. Cada item marcado **⚠️ validar** depende da próxima
> reunião com o dono / Ana Terra / equipe clínica.
>
> Estende o doc 05 (que cobre Painel → Internação). Princípios valem aqui também:
> navegar em contexto, consolidar, cadastro único, visão por login.

---

## 1. Financeiro

Recebe o que o mapeamento mandou mover de **Vendas → Financeiro** e consolida o
**faturamento automático** vindo do clínico/internação (doc 04 §3).

### 1.1 Escopo proposto
- **Faturas / Contas a receber**: fatura por responsável consolidando lançamentos
  (atendimento, procedimento, medicação na internação, alta). Status
  (aberta/paga/parcial/vencida).
- **Recebimentos** (movido de Vendas 4.6): baixa de faturas, por forma de
  recebimento; recebimento parcial; estorno.
- **Saldo dos clientes** (movido de Vendas 4.9): devedor/credor por responsável —
  "isso tem que estar no Financeiro" (decisão do dono).
- **Formas de recebimento** (movido de Vendas 4.10): cadastro de apoio
  (dinheiro/Pix/cartão/transferência), com taxas.
- **Contas a pagar**: fornecedores, despesas, **comissões a pagar** (integra
  Comissionamento, doc 05 §5).
- **Fluxo de caixa**: entradas × saídas por período; abertura/fechamento de caixa
  ⚠️ validar (ligado ao PDV cortado na fase 1 — doc 05 §4.1/4.4).
- **Conciliação**: bancária e de adquirentes (cartão/Pix) ⚠️ validar.
- **Dashboard financeiro** consolidado (um lugar, sem relatórios redundantes).

### 1.2 Integrações
- **Gateway de pagamento**: **Pix** (cobrança/QR), cartão e boleto ⚠️ validar
  provedor (ex.: Mercado Pago, Stripe, Asaas, PagSeguro).
- Liga ao **Fiscal** (emissão de nota no recebimento) e ao **Portal** (2ª via,
  pagamento online).

### 1.3 Decisões herdadas
- Orçamento **permanece em Vendas** (acoplado à ficha do cliente), **não** no
  Financeiro (decisão do dono — doc 05 §4.11).
- Regras de venda/desconto → área de **Configuração** (doc 05 §4.13).

### 1.4 Fase 2 — implementado ✅
Sobre o Financeiro fase 1 (faturas + baixa integral):
- **Recebimento parcial** (`recebimentos`, migração 0013): cada baixa lança um
  recebimento; o status da fatura é **derivado** da soma (`aberta → parcial →
  paga`). `POST /api/faturas/:id/recebimentos` + `GET` do histórico; `pagar`
  virou "quita o saldo restante".
- **Formas de recebimento** (movido de Vendas 4.10): cadastro de apoio
  (dinheiro/Pix/cartão/transferência) com **taxa em basis points**; CRUD em
  `/api/formas-recebimento`, geridas em `/cadastros`.
- **Saldo do cliente** (movido de Vendas 4.9): devedor por responsável —
  `GET /api/financeiro/saldos` (lista) e `/saldos/:responsavelId` (na ficha).
- Fase 3: estorno, conciliação, gateway de pagamento (Pix/cartão), contas a
  pagar (comissões — integra doc 05 §5), fluxo de caixa.

---

## 2. Estoque e serviços

Opera sobre o **catálogo único** (doc 05 §8 / doc 04): produtos, medicamentos,
vacinas, materiais.

### 2.1 Escopo proposto
- **Saldo por item** (vínculo com a Tabela de preços/catálogo); múltiplos
  **depósitos/locais** ⚠️ validar (farmácia, internação, loja).
- **Movimentações**: entrada (compra), saída (venda/uso), transferência, ajuste de
  inventário.
- **Baixa automática**: ao **vender** e ao **executar medicação na internação**
  (doc 05 §9.2) — fecha o ciclo clínico→estoque→financeiro.
- **Lotes e validade**: rastreio por lote, alerta de vencimento (crítico para
  medicamentos/vacinas).
- **Ponto de reposição** e alerta de estoque mínimo; sugestão de compra.
- **Fornecedores** e **pedidos de compra** ⚠️ validar profundidade.
- **Inventário/contagem** com ajuste e histórico.
- **Curva ABC / itens parados** (consolida com o dashboard de vendas — "% do
  catálogo que gira", doc 05 §4).

### 2.2 Regras herdadas
- Toggle "permite vender sem estoque" e "controle sobre descontos" já existem nas
  regras de venda (doc 05 §4.13) → respeitar aqui.
- Serviços (não estocáveis) convivem no mesmo catálogo, sem saldo físico.

### 2.3 Fase 1 — implementado ✅
Fatia mínima entregue (`apps/api/src/modules/estoque` + `/estoque` no web):
- **Movimentações** manuais `entrada | saida | ajuste` como **fonte da verdade**
  (tabela `estoque_movimentos`, com RLS por tenant fail-closed — doc 03).
- **Saldo por item** derivado da SOMA das quantidades (sinal por tipo); **serviços
  ficam de fora** (sem saldo físico — §2.2). Sem depósitos ainda.
- **Ponto de reposição**: coluna `estoque_minimo` no catálogo + alerta "abaixo do
  mínimo" e filtro na tela.
- **Histórico** por item; bloqueio de **saldo negativo** (o toggle "permite vender
  sem estoque" da §2.2 entra na fase 2).
- API: `GET /api/estoque`, `GET /api/estoque/:itemId/movimentos`,
  `POST /api/estoque/movimentos`, `PATCH /api/estoque/:itemId/minimo`.

**Fase 2**: baixa automática (venda / medicação na internação — fecha o ciclo
clínico→estoque→financeiro), lotes/validade, múltiplos depósitos, fornecedores/
pedidos de compra, curva ABC. A baixa automática depende de o evento do prontuário
passar a referenciar o **item de catálogo** (hoje o evento tem só `valorCentavos`).

---

## 3. Fiscal

Emissão de documentos fiscais a partir das vendas/recebimentos. **Alta
sensibilidade regulatória — validar com contador.**

### 3.1 Escopo proposto
- **NFS-e** (serviços veterinários) — integração com a **prefeitura** do município
  ⚠️ validar (padrões variam por cidade).
- **NF-e / NFC-e** (venda de produtos/medicamentos) — integração **SEFAZ** ⚠️
  validar se a clínica vende produto com nota.
- **Certificado digital** (A1) por tenant, guardado em cofre (doc 02) ⚠️.
- **Regras tributárias**: regime (Simples/Presumido), CFOP, NCM, ISS/ICMS,
  alíquotas por item — provavelmente via **provedor fiscal** (ex.: Focus NFe,
  NFe.io, PlugNotas) em vez de falar direto com SEFAZ ⚠️ validar.
- **Contingência**, cancelamento, carta de correção, inutilização.
- Vínculo: emitir nota no **recebimento** (Financeiro) e disponibilizar no
  **Portal**.

### 3.2 Princípio
- **Multitenant fiscal**: cada tenant tem seu CNPJ, certificado, regime e séries.
- Manter **modelo de demonstrativo** de venda impresso (doc 05 §4.12) como
  configuração de impressão, separado do fiscal.

---

## 4. Site (presença pública da clínica)

Site público por tenant, com **agendamento online** ligado à Agenda (doc 05 §3).

### 4.1 Escopo proposto
- **Site institucional** por tenant (white-label leve: logo, cores, conteúdo) ⚠️
  validar quão configurável.
- **Agendamento online**: cliente escolhe serviço/profissional/horário; cai na
  Agenda e respeita tipos de atendimento/duração (doc 05 §8.5) e a integração
  **Google Agenda + IA** (doc 06).
- **Vitrine de serviços** e informações (endereço, horário, contato).
- **Captação**: formulário "Como nos conheceu?" alimenta a **origem do cliente**
  no cadastro (doc 05 §8.11) — sem tela dedicada.
- **SEO** básico e desempenho (Core Web Vitals).
- **Segurança**: o site é público, mas qualquer ação (agendar) passa pela API
  autenticada/rate-limited; nada de acesso direto a dados de clínica (doc 02/11).

---

## 5. Portal do cliente (tutor)

Área logada do **tutor/responsável** — extensão natural do "cliente 360" (doc 05
§2.2) para o próprio dono do pet.

### 5.1 Escopo proposto
- **Login do tutor** (próprio, separado dos usuários internos; OIDC/MFA conforme
  doc 02) ⚠️ validar esforço.
- **Meus pets**: ficha, **vacinas** (e lembretes — doc 05 §7.1), **histórico**
  resumido do prontuário (o que for adequado expor ao tutor) ⚠️ validar o quê.
- **Agendamentos**: marcar/ver/cancelar; lembretes (WhatsApp — doc 06).
- **Financeiro do tutor**: faturas, 2ª via, **pagamento online** (Pix/cartão) e
  nota fiscal (Fiscal).
- **Documentos**: contratos, receitas, atestados (modelos do doc 05 §8.10/8.12).
- **Comunicação**: canal com a clínica; campanhas/aniversário (respeitando
  opt-out — doc 05 §2.2).
- Caminho para **app do tutor** (React Native) reusando a API (doc 01/11).

### 5.2 Princípio de segurança
- O tutor só vê **os próprios pets/dados**, escopado por responsável **e** tenant
  (RLS + authz por objeto — doc 02/03). Tutor **nunca** é usuário da gestão.

### 5.3 Implementado (fase 3 — MVP)

Área logada do tutor sob `/portal/*` no web, com **auth totalmente separada** da
gestão. Decisões desta 1ª versão (validadas com o cliente):

- **Onboarding por convite da clínica**: a clínica gera um link na ficha do
  cliente (`POST /clientes/:id/portal/convite`); o tutor abre o link e **cria a
  própria senha** (`POST /portal/convite/aceitar`). Sem auto-cadastro anônimo —
  nenhuma porta aberta (diretriz de segurança). Convite válido por 7 dias, token
  de alta entropia guardado só como sha256; revogável (`.../portal/revogar`).
- **Credencial separada** (`tutor_credentials`, tabela **global sem RLS** como
  `users` — o login roda antes do contexto de tenant). O access token carrega
  `scope:'tutor'` + `tenantId` + `responsavelId`; o `JwtAuthGuard` da gestão
  **recusa** qualquer token com `scope`, e o `TutorGuard` só aceita `scope:'tutor'`
  — isolamento total entre as duas superfícies. Todo acesso a dados passa por
  `withTenant(tenantId)` **e** filtro por `responsavelId` (RLS + authz por objeto).
- **Meus pets**: ficha + **vacinas** + **histórico resumido** do prontuário
  (atendimento/vacina/exame/receita/internação/peso). Notas livres (`observacao`)
  ficam de FORA por privacidade.
- **Agendamentos**: **somente visualização** (próximos + anteriores). Marcação
  online fica para iteração futura.
- **Financeiro**: faturas do tutor com saldo e 2ª via (itens). **Pagamento online**
  (Pix/cartão) e **nota fiscal** ficam para quando o módulo Fiscal + provedor de
  pagamento existirem.

**Pendente (follow-up)**: refresh token do tutor com rotação/revogação stateful
(hoje é stateless, como a gestão era antes da fase 2); MFA do tutor; agendamento
online; pagamento online + nota; app nativo do tutor (React Native).

---

## 6. Posicionamento no roadmap (proposta)

| Módulo | Fase sugerida | Depende de |
|--------|---------------|-----------|
| **Financeiro** | **Fase 2** | Faturamento automático (fase 1), formas de recebimento |
| **Estoque** | **Fase 2** | Catálogo único (fase 1), baixa na venda/medicação |
| **Fiscal** | **Fase 2–3** ⚠️ | Financeiro + provedor fiscal + contador |
| **Site** | **Fase 3** | Agenda + Google/IA (fase 2) |
| **Portal do tutor** | **Fase 3** | Financeiro, Fiscal, prontuário, auth do tutor |

Atualiza o doc 08 quando validado. Beta e Configuração (também fora do mapeamento)
seguem como **⚪ a mapear**.

---

## 7. Próximos passos de validação
1. Reunião para mapear telas reais desses módulos (como foi feito até Internação).
2. Confirmar: provedor de **pagamento**, provedor **fiscal**, profundidade de
   **estoque** (multi-depósito? compras?), e o que expor no **Portal** ao tutor.
3. Converter cada seção validada em spec detalhada (telas + decisões), nos moldes
   do doc 05.
