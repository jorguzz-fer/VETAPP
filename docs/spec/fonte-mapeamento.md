# Fonte — Mapeamento de Telas e Funcionalidades (SimplesVet)

> Documento-base que originou esta SPEC. Preservado para rastreabilidade.
> **Sistema mapeado:** SimplesVet (app.simples.vet) — instância "Clínica
> Veterinária Cuidar". **Data do mapeamento:** 25/06/2026.
> **Fontes:** navegação ao vivo no sistema logado + transcrição da reunião com o
> dono (reuniaoVetapp.txt).
> **Escopo:** do Painel de Controle até Internação (ponto em que a reunião foi
> interrompida). Fora deste mapeamento: Estoque e serviços, Financeiro, Beta,
> Configuração, Fiscal, Site e Portal.

## Legenda de decisão
- 🟢 MANTER — útil, segue no produto (pode refinar).
- 🟡 MELHORAR — conceito válido, mas UX/forma precisa mudar.
- 🔴 CORTAR — redundante ou sem valor para a fase atual.
- 🔵 NOVO — funcionalidade que não existe e o dono quer criar.
- ⚪ DEFINIR — depende de validação adicional (ex.: equipe clínica / Ana Terra).

## Observações gerais (valem para todo o produto)
1. **Duas gerações de tela convivem** — legado `.php` (sidebar fixa) e novas
   `/v2`/`/v3` (topo com menu + avatar). Unificar tudo no padrão novo; `/v3`
   indica a direção visual.
2. **Navegação abre telas/modais demais** — "vai abrindo outras telas… fica um
   negócio maluco". Princípio: navegar em contexto, não empilhar janelas.
3. **Botões que não fazem nada** — ícones inertes (telefone em listas, etc.).
   "Pecado de UX". Todo clicável precisa ter ação clara.
4. **Excesso de relatórios redundantes** — mesmo dado em "Minhas vendas",
   "Consulta vendas", "Inteligência > Vendas". Consolidar.
5. **Cadastros espalhados** — produtos, exames, vacinas, medicamentos, preços,
   cirurgias em telas separadas. Unificar num só lugar + tabela de preços.
6. **Arquitetura datada** — "feito em meados dos anos 2000". Reescrita conceitual,
   não reskin.

## Integrações desejadas (transversais)
- 🔵 **Petlove / Vetlove / Vet Smart** — bases de raças, espécies e bulário
  inteligente. Contexto: a Petlove concentra o mercado (SimplesVet + Vet Smart são
  dela); há espaço para alternativa independente.
- 🔵 **Google Agenda** — sincronizar a agenda para agendamento automático por IA.
- 🔵 **IA de atendimento** — conectada à agenda e ao atendimento (marcação,
  lembretes, enriquecimento de bases).
- 🔵 **WhatsApp** — lembretes (vacina vencida, aniversário) e comunicação.

---

## Inventário de telas e decisões

### 1. Painel de Controle — `/principal/dashboard.php` — 🟡 MELHORAR
Dashboard gerencial (abas Principal/Financeiro, gráficos, KPIs, listas).
Repensar como **home por persona**.

### 2. Atendimento Clínico
- **2.1 Lista de clientes/pacientes** — `/principal/cliente/cliente.php` ·
  `/v3/cliente/clientes` — 🟢 MANTER. Consolidar legado+v3; busca por telefone e
  nome do animal first-class.
- **2.2 Ficha do cliente (360)** — 🟢 MANTER. Origem capturada aqui; WhatsApp
  nativo.
- **2.3 Prontuário do animal** — 🟢 MANTER. **Coração do produto** ("a vida do
  bichinho"); principal diferencial frente à Petlove. Tela mais importante do
  redesign; cada ação clínica pode gerar faturamento; reduzir botões.

### 3. Agenda
- **3.1 Agenda diária** — `/agenda/agenda.php` — 🟡 MELHORAR + 🔵 agenda por login
  + 🔵 Google Agenda/IA.
- **3.2 Escala** — `/escala/escala.php` — 🟡 MANTER com ressalva.
- **3.3 Config. da Agenda** — `/config/agenda/agenda.php` — 🟡 MELHORAR
  (navegabilidade trava).

### 4. Vendas (tema: redundância → dashboard único)
- **4.1 PDV** — `/principal/pontodevenda/venda.php` — 🔴 CORTAR fase 1.
- **4.2 Minhas vendas** — `/v2/inteligencia/produtividade/minhas-vendas` — 🟡
  MELHORAR (base do dashboard único).
- **4.3 Consulta vendas** — `/principal/venda/venda.php` — 🔴 CORTAR/absorver.
- **4.4 Movimentos de caixa** — `/consulta/caixamovimento/caixa.php` — ⚪ DEFINIR.
- **4.5 Pacotes vendidos** — `/v3/comercial/pacotes-vendidos` — ⚪ DEFINIR.
- **4.6 Recebimentos** — `/consulta/recebimento/recebimento.php` — ⚪ DEFINIR
  (→ Financeiro).
- **4.7 Lista de preços** — `/v3/comercial/lista-precos` — 🟢 MANTER (renomear
  "Tabela de preços"; único lugar de preços).
- **4.8 Ranking de clientes** — `/v3/cliente/ranking-clientes` — 🟡 absorver no
  dashboard.
- **4.9 Saldo dos clientes** — `/v3/cliente/saldo-clientes` — 🟡 MOVER →
  Financeiro.
- **4.10 Formas de recebimento** — `/v3/financeiro/formas-recebimento` — 🟡 MOVER
  → Financeiro/Config.
- **4.11 Modelo de orçamento (pacotes)** — `/config/modeloorcamento/...` — 🟡
  MANTER (orçamento em Vendas, acoplado à ficha; itens por código; limpar lixo).
- **4.12 Modelo de demonstrativo** — `/config/modelodemonstrativo/...` — ⚪
  DEFINIR.
- **4.13 Configuração (regras de venda)** — `/venda/configuracao/...` — 🟢 MANTER
  (→ Configuração).

### 5. Comissionamento
- **5.1 Comissões em aberto (fechamento)** — `/v2/comercial/comissao/fechamento` —
  🟢 MANTER.
- **5.2 Extratos** — `/v2/comercial/comissao/extratos` — 🟡 MELHORAR (não mostrar
  histórico antigo por padrão).
- **5.3 Minhas comissões** — `/v2/comercial/comissao/minhascomissoes` — 🟢 MANTER.

### 6. Inteligência
- **6.1 Produtividade** — `/v2/inteligencia/produtividade` — 🟢 MANTER (a mais
  elogiada; agrupar por colaborador e setor).
- **6.2 Vendas (analytics)** — `/v2/inteligencia/vendas` — 🟡 unificar com o
  dashboard de vendas.

### 7. Consultas
- **7.1 Vacinação** — `/consulta/vacina/vacina.php` — 🟡 MELHORAR + 🔵 lembrete
  WhatsApp.
- **7.2 Aniversários** — `/consulta/aniversario/aniversario.php` — 🟡 MELHORAR +
  🔵 mensagem/brinde automático.
- **7.3 Log** — `/v3/ambiente/logs` — 🟢 MANTER (auditoria).

### 8. Cadastros (tema: consolidar; bases via integração/IA)
- **8.1 Espécies** — `/v3/veterinaria/especies` — 🟡 base externa.
- **8.2 Raças** — `/v3/veterinaria/racas` — 🟡 base externa; autopreenche no
  cadastro do animal.
- **8.3 Pelagens** — `/v3/veterinaria/pelagens` — 🟡 base externa.
- **8.4 Patologias** — `/v3/veterinaria/patologias` — 🟡 enriquecer (bulário/IA).
- **8.5 Tipos de atendimento** — `/cadastro/tipoatendimento/...` — 🟢 MANTER.
- **8.6 Vacinas** — `/cadastro/vacina/...` — 🟡 CONSOLIDAR.
- **8.7 Exames** — `/cadastro/exame/...` — 🟡 CONSOLIDAR (lab + imagem).
- **8.8 Atributos de exames** — `/cadastro/exameatributo/...` — 🟡 detalhe do
  exame.
- **8.9 Referências de exames** — `/cadastro/examereferencia/...` — 🟡 detalhe do
  exame.
- **8.10 Modelo de receita** — `/config/modeloreceita/...` — 🟢 MANTER (receita
  controlada).
- **8.11 Origem dos clientes** — `/v3/veterinaria/origem-dos-clientes` — 🔴 CORTAR
  tela (dado no cadastro do cliente).
- **8.12 Modelo de documento** — `/config/modelodocumento/...` — 🟢 MANTER.

### 9. Internação (alto potencial: painel consolidado, TV/tablet, faturamento auto)
- **9.1 Animais internados (dashboard)** — `/internamento/.../dashboard.php` — 🟡
  próximo procedimento no card + 🔵 TV/tablet por box.
- **9.2 Mapa de Execução** — `/internamento/execucao/...` — 🟢 MANTER + 🔵 dentro
  da internação e em TV/tablet + 🔵 executar = baixar + faturar.
- **9.3 Histórico de Internações** — `/internamento/.../internamento.php` — 🟢
  MANTER.
- **9.4 Ficha de internação (detalhe)** — 🟡 simplificar + 🔵 admissão explícita +
  🔵 alta gera cobrança.
- **9.5 Parâmetros clínicos** — `/v3/internacao/parametros-clinicos` — 🟢 MANTER.
- **9.6 Modelos de prescrição** — `/internamento/prescricaomodelo/...` — 🟢 MANTER.
- **9.7 Boxes** — `/v3/internacao/boxes` — 🟢 ATIVAR (cadastro vazio hoje).

---

## Temas transversais (resumo executivo do dono)
**Princípios de UX/UI**: navegação em contexto; toda ação tem efeito; consolidar
não multiplicar; cadastro único (com código); simplicidade para o veterinário;
visão por perfil/login.

**Migração de dados**: 🔵 padrão de migração (base própria ou planilha) ao trocar
de software.

**Faturamento integrado (princípio forte)**: cada ação clínica (atendimento,
procedimento, medicação na internação, alta) pode gerar lançamento financeiro
automático, consolidando a fatura do cliente.

**Reposicionamento sugerido**: mover Saldo dos clientes, Recebimentos e Formas de
recebimento → Financeiro; Configuração de vendas → Configuração; Orçamento fica em
Vendas (acoplado ao cliente); Origem do cliente vira dado no cadastro + relatório.

**Cortar na fase 1**: PDV, Consulta vendas (absorver), tela de Origem dos clientes,
telas decorativas sem função, históricos antigos por padrão.

**Pendências ⚪ DEFINIR**: Movimentos de caixa, Pacotes vendidos, Modelo de
demonstrativo, "relatório de procedimento cirúrgico" — validar com equipe clínica
/ Ana Terra.

> **Próximos módulos a mapear** (quando a reunião retomar): Estoque e serviços,
> Financeiro, Beta, Configuração, Fiscal, Site, Portal.
