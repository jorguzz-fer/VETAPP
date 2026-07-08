# 16 — Ajustes de Produto/UX (Advisor Dr. Kleber)

> **Origem:** reunião de revisão com o **Dr. Kleber** (advisor clínico do projeto),
> percorrendo as telas do VETAPP tela a tela e comparando com o concorrente
> **simples.vet**. Este doc consolida **todos os ajustes pedidos**, agrupados por
> módulo, e serve de checklist de implementação. A maioria é refinamento de UX de
> telas que já existem; três frentes são estruturais (agenda por profissional,
> split do prontuário e histórico de mensagens/CRM).
>
> **Diretriz de sempre (doc 02):** auth server-side, nenhuma rota exposta à toa.
> Estes ajustes são de **apresentação e organização** — não relaxam RLS, escopo de
> token nem RBAC. Dinheiro segue em centavos (doc 04).

Legenda de status: ✅ feito · 🔜 fase futura (CRM/mensageria).

> **Status geral: doc 16 implementado.** Todas as frentes de UX e as estruturais
> (dashboard/KPIs, clientes & pacientes, cadastro de paciente, ficha do cliente,
> dashboard de internação, agenda por profissional/departamento com slider, "a
> cobrar"/comanda, prontuário com cards + timeline por blocos + evolução por médico
> + protocolos vacinais) foram entregues em `main` (PRs #101–#115). O que resta é
> **fase de CRM/mensageria** — marcado 🔜 abaixo.

---

## 0. Temas transversais (valem em várias telas)

- ✅ **T1 — Tipografia legível.** Nomes/labels estão pequenos ("veterinária mais
  velha"). Aumentar ~50% e destacar (borda/peso) nos cards e listas. **Não** usar
  caixa-alta forçada.
- ✅ **T2 — Cards no lugar de "listona".** Onde hoje é lista corrida (prontuário,
  clientes), preferir cards — um item por vez, mais confortável de ler.
- ✅ **T3 — Slider, nunca nova janela.** Detalhes (agendamento, ficha) abrem em
  painel lateral **com botão de fechar**; jamais abrir nova aba/janela.
- ✅ **T4 — Tutor + Paciente sempre juntos.** Evitar confusão de homônimos. Nome do
  **tutor** em destaque + **paciente** logo abaixo, ambos com **código**.
- ✅ **T5 — Botão WhatsApp** para falar direto com o tutor (ficha e prontuário).
- ✅ **T6 — Ícones + cor por tipo.** Ícone específico de internação; cor por
  categoria; reusados de forma consistente em todo o sistema.

---

## 1. Dashboard administrativo (`/dashboard`)

- ✅ **D1** — Destacar/aumentar os títulos dos cards de KPI (T1).
- ✅ **D2** — Trocar **"Receita do mês" → "Receita líquida do mês"** (base: receitas
  líquidas, não brutas).
- ✅ **D3** — **Remover "Estoque abaixo do mínimo"** do dashboard (o indicador vive no
  módulo de estoque).
- ✅ **D4** — Adicionar **"Ticket médio"**.
- ✅ **D5** — Adicionar **"Faturas a receber"** (a receber).
- ✅ **D6** — Renomear **"Execuções pendentes" → "Execuções clínicas pendentes"**
  (ações de paciente internado, ex.: aplicar vacina de X em X horas; clique leva ao
  mapa de execução).
- ✅/OK — "Próximos de hoje" (agenda do dia) e "Clientes" (tutores com pet) mantidos.

**Cards finais (gestão):** Receita líquida do mês · Ticket médio · Faturas a receber ·
Orçamentos abertos · Execuções clínicas pendentes · Próximos de hoje · Clientes.

---

## 2. Dashboard de Internação dedicado (`/internacao`)

- ✅ **I1** — Um **dashboard próprio de internação**, separado do administrativo, mais
  completo.
- ✅ **I2** — Cards por paciente: **nome**, **tempo internado**, **previsão de alta** e,
  embaixo, **ações clínicas pendentes** (próxima + lista).
- ✅ **I3** — Manter a **timeline** de execução (modelo aprovado).
- ✅ **I4** — **Foto** do paciente no card/avatar.

---

## 3. Agenda (`/agenda`)

- ✅ **A1 — CRUD de agendas** com visualização por **profissional** e por
  **departamento** (ex.: Dra. Gabriela, especialista volante, hotel). Filtro por
  profissional e por departamento entregues; a **visão consolidada agrupada** (várias
  agendas lado a lado, estilo colunas) é 🔜.
- ✅ **A2** — **Cor diferenciada** por evento + diferenciar os ícones de navegação/
  filtro (mês/dia/semana).
- ✅ **A3** — Clique no agendamento abre **slider** (T3) com: tutor, paciente, contato,
  **profissional**, motivo/procedimento, situação financeira (devendo/convênio), links
  para a ficha e ações: **confirmar**, **editar**, **cancelar**, imprimir, tornar
  recorrente. **Remover "log"**.
- ✅ **A4** — **"Informar chegada do cliente"** marca o agendamento como *confirmado*
  (baixa/desativa no fluxo) no slider. A **notificação** ativa ao profissional é 🔜
  (depende de mensageria).

---

## 4. Clientes & Pacientes (`/clientes`) — era "Clientes e Animais"

- ✅ **C1** — **Renomear** o módulo/menu para **"Clientes e Pacientes"**.
- ✅ **C2** — Aumentar a tabela (fontes maiores, mais *friendly* — T1).
- ✅ **C3** — **Manter o código** do cliente na listagem (diferencia homônimos).
- ✅ **C4** — Mostrar na linha o **nome do tutor + os pets/pacientes** (se >1, um ao
  lado do outro).

---

## 5. Ficha do cliente / tutor

- ✅ **F1** — Reorganizar no padrão do concorrente (mais organizado): **total vendido**,
  **ticket médio**, **última venda**, **contatos**, **dados de cadastro**, **animais
  cadastrados**. (A **nota de satisfação** do cliente não existe no nosso modelo — 🔜.)
- ✅ **F2** — Botão **WhatsApp** direto (T5).
- 🔜 **F3** — Menu **"⋮"**: convite para o portal (já existe em card próprio) + mensagem/
  SMS, **histórico de mensagens**, histórico de alteração e lembrete de vacina —
  dependem do módulo de **mensageria/CRM**.

---

## 6. Cadastro de paciente

- ✅ **P1** — Usar o termo **"paciente"** (não "animal").
- ✅ **P2** — Campos: vivo/óbito, nome, **sexo**, **esterilização/castração** (usado em
  campanhas), **nascimento**, **espécie**, **raça**, **pelagem**, **microchip**,
  **marcações/tags** (ex.: "renal"), **Pedigree** (sim/não + nº), **foto** (vira avatar).

---

## 7. Prontuário (`/prontuario`) — a parte mais delicada

- ✅ **PR1** — Deixar bem mais *friendly* (hoje poluído).
- ✅ **PR2** — **Dividir em dois:** Prontuário de **Internação** e de **Atendimento
  porta**.
- ✅ **PR3** — Conceito: prontuário = **histórico completo** do paciente (não só do dia);
  todo paciente tem prontuário.
- ✅ **PR4** — Listagem em **cards** (T2): internados em cards no topo; **altas / fora de
  atendimento** em lista embaixo; **filtro em cima**. Manter simples.
- ✅ **PR5** — **Consolidar as duas timelines** redundantes ("linha do tempo" +
  "histórico") em **uma só**, separada por **blocos de data**; clicar no dia expande o
  que foi feito (tamanho legível).
- ✅ **PR6** — Ícones melhores + **cor por tipo** (internação com cor própria — T6).
- ✅ **PR7** — Mostrar **médico(s) que atenderam** (chip com o nome) e **evolução por
  médico** (clicar mostra o que cada um escreveu).
- ✅ **PR8** — Dados do **tutor + paciente** juntos (T4) + botão **WhatsApp** (T5).
- ✅ **PR9** — Aba **"Protocolos vacinais"** (reformular o "Protocolo" confuso): última
  vacinação, aplicação, quem aplicou, laboratório, lote, **data da próxima** → base para
  **lembrete automático** de vacina vencendo (a automação em si é frente futura).

---

## 8. "A cobrar" / comanda (na ficha do paciente) — era "Vendas"

- ✅ **B1** — Renomear **"Vendas" → "A cobrar"** dentro da ficha/prontuário.
- ✅ **B2** — Funciona como **comanda**: tudo lançado no paciente (exames, internação,
  produtos) acumula, com **status "em aberto / faturado-fechado"** bem nítido.
- ✅ **B3** — Botão **"Efetuar cobrança"** que abre o documento de cobrança.

---

## 9. Remoções

- ✅ **R1** — "Atendimento clínico" redundante. **N/A no VETAPP**: essa tela era do
  **concorrente** (simples.vet), que o Dr. Kleber apontou como "mais do mesmo" e pediu
  para **não replicar**. O VETAPP nunca teve essa tela (confirmado: nenhuma rota/menu
  "atendimento clínico") — logo, nada a remover. Item satisfeito por omissão.

---

## 10. Frente futura (CRM / histórico de mensagens)

- 🔜 **CRM1** — **Histórico de mensagens** por cliente: rastrear envios por canal
  (landing page, e-mail, SMS, WhatsApp) com status **enviado / visualizado / clicado** e
  **quem** disparou — base para campanhas e relatórios. É a semente do CRM que o
  stakeholder quer (captar/conectar todos os canais de entrada). Escopo maior, entra
  depois dos refinamentos acima.

---

## Ordem de implementação sugerida

1. **Transversais de UX** (T1–T6) aplicados às telas que já existem.
2. **Dashboard + KPIs** (D1–D6).
3. **Dashboard de Internação** (I1–I4).
4. **Clientes & Pacientes** (C1–C4) + **Cadastro de paciente** (P1–P2).
5. **Ficha do cliente** (F1–F3, menos o CRM).
6. **Prontuário** (PR1–PR9) — o mais pesado.
7. **Agenda CRUD** (A1–A4).
8. **A cobrar / comanda** (B1–B3).
9. **Remoções** (R1).
10. **CRM / histórico de mensagens** (CRM1) — frente futura.
