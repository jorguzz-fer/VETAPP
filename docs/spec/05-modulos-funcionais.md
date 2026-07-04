# 05 — Módulos funcionais

Mapeamento tela a tela do sistema legado → **decisão de redesign**. Legenda:
🟢 MANTER · 🟡 MELHORAR · 🔴 CORTAR (fase 1) · 🔵 NOVO · ⚪ DEFINIR.

Princípios aplicados em todos: navegar em contexto, toda ação tem efeito,
consolidar, cadastro único, simplicidade clínica, visão por login.

---

## 1. Painel de Controle (Home)
- **Legado**: `/principal/dashboard.php` — KPIs, gráficos, listas.
- **Decisão**: 🟡 **Home por persona** (ver doc 00 §3 e doc 07). Não há uma home
  única: gestão vê gerencial; recepção vê agenda/fila; médico vê sua agenda +
  pendências do dia. Painel configurável por papel. Definir o layout final
  **depois** que os módulos estiverem fechados.

## 2. Atendimento Clínico (núcleo)
### 2.1 Lista de clientes/pacientes — 🟢 MANTER
- Porta de entrada. Consolidar legado (`.php`) + `/v3` numa só tela.
- Busca por **responsável, animal e telefone** como first-class. Coluna de animais
  com estado (vivo/ativo × falecido/inativo).

### 2.2 Ficha do cliente (cliente 360) — 🟢 MANTER
- Visão consolidada do responsável: contatos, documentos, NPS, origem ("Como nos
  conheceu?" capturada **aqui**, sem tela própria), compras, animais vivos/mortos.
- **WhatsApp nativo/integrado** (não "WhatsApp Web").
- Botão **Orçamento** acoplado à ficha (ver módulo Vendas).

### 2.3 Prontuário do animal — 🟢 MANTER · **tela mais importante do redesign**
- Prontuário eletrônico = histórico de toda a vida do animal + ponto de
  lançamento de atendimento/venda/orçamento.
- Cabeçalho (responsável + animal + tags de patologia + foto); painel de
  Venda/Orçamentos; timeline Histórico/Protocolos/Linha do tempo/Agenda/Vendas.
- Ações rápidas: Atendimento, Peso, Patologia, Documento, Exame, Fotos, Vacina,
  Receita, Observações, Vídeo, Internação.
- **Redesign**: reduzir botões, priorizar fluxo; **cada ação clínica pode gerar
  faturamento automático** (configurável).

## 3. Agenda
| Tela | Legado | Decisão |
|------|--------|---------|
| 3.1 Agenda diária | `/agenda/agenda.php` | 🟡 MELHORAR + 🔵 **agenda por login** (médico vê só a sua) + 🔵 **Google Agenda + agendamento por IA** |
| 3.2 Escala | `/escala/escala.php` | 🟡 MANTER com ressalva (útil quando cresce) |
| 3.3 Config. da Agenda | `/config/agenda/agenda.php` | 🟡 MELHORAR — corrigir navegabilidade (fluxo "trava"); criar usuário já cria agenda |

## 4. Vendas
> Tema: **muita redundância**. Objetivo: **um dashboard único de vendas**.

| Tela | Legado | Decisão |
|------|--------|---------|
| 4.1 PDV | `/principal/pontodevenda/venda.php` | 🔴 **CORTAR na fase 1** (gestão, não balcão). Reavaliar p/ clínicas com loja |
| 4.2 Minhas vendas | `/v2/.../minhas-vendas` | 🟡 **MELHORAR → base do dashboard único** (absorve as redundantes) |
| 4.3 Consulta vendas | `/principal/venda/venda.php` | 🔴 CORTAR/absorver em Minhas vendas |
| 4.4 Movimentos de caixa | `/consulta/caixamovimento/...` | ⚪ DEFINIR (ligado a PDV/caixa) |
| 4.5 Pacotes vendidos | `/v3/comercial/pacotes-vendidos` | ⚪ DEFINIR — manter conceito de pacote; avaliar tela |
| 4.6 Recebimentos | `/consulta/recebimento/...` | ⚪ DEFINIR → tende ao **Financeiro** |
| 4.7 Lista de preços | `/v3/comercial/lista-precos` | 🟢 MANTER → **renomear "Tabela de preços"**, único lugar de preços junto ao cadastro |
| 4.8 Ranking de clientes | `/v3/cliente/ranking-clientes` | 🟡 absorver como bloco do dashboard |
| 4.9 Saldo dos clientes | `/v3/cliente/saldo-clientes` | 🟡 **MOVER → Financeiro** |
| 4.10 Formas de recebimento | `/v3/financeiro/formas-recebimento` | 🟡 **MOVER → Financeiro/Configuração** |
| 4.11 Modelo de orçamento (pacotes) | `/config/modeloorcamento/...` | 🟡 MANTER — orçamento **fica em Vendas**, acoplado à ficha; itens **por código**; limpar lixo |
| 4.12 Modelo de demonstrativo | `/config/modelodemonstrativo/...` | ⚪ DEFINIR — config de impressão |
| 4.13 Configuração (regras de venda) | `/venda/configuracao/...` | 🟢 MANTER → mover p/ área de **Configuração** |

## 5. Comissionamento
> Cada item/serviço tem regra de comissão por colaborador.

| Tela | Legado | Decisão |
|------|--------|---------|
| 5.1 Comissões em aberto (fechamento) | `/v2/comercial/comissao/fechamento` | 🟢 MANTER — consolidado a pagar + visão individual |
| 5.2 Extratos | `/v2/comercial/comissao/extratos` | 🟡 MELHORAR — **não mostrar histórico antigo por padrão** |
| 5.3 Minhas comissões | `/v2/comercial/comissao/minhascomissoes` | 🟢 MANTER — "cada um vê o seu" por login |

## 6. Inteligência
| Tela | Legado | Decisão |
|------|--------|---------|
| 6.1 Produtividade | `/v2/inteligencia/produtividade` | 🟢 MANTER (a mais elogiada). Agrupar por colaborador **e por setor**; não misturar entidades estranhas |
| 6.2 Vendas (analytics) | `/v2/inteligencia/vendas` | 🟡 **Unificar com o dashboard de vendas (4.2)** |

## 7. Consultas
| Tela | Legado | Decisão |
|------|--------|---------|
| 7.1 Vacinação | `/consulta/vacina/vacina.php` | 🟡 MELHORAR (ícone telefone inerte) + 🔵 **lembrete WhatsApp** (manual/automático) — "modo lembrete" |
| 7.2 Aniversários | `/consulta/aniversario/...` | 🟡 MELHORAR + 🔵 **mensagem/brinde automático** |
| 7.3 Log | `/v3/ambiente/logs` | 🟢 MANTER → elevado a **trilha de auditoria** (ver doc 02 §6) |

> Nota: "Consultas" como menu de consulta ≠ consulta médica. Atendimento clínico
> vive na Agenda/Prontuário.

## 8. Cadastros
> Tema: **consolidar** num único "produtos/serviços cadastrados" + tabela de
> preços. Bases padrão vêm de integração/IA (ver doc 06).

| Tela | Legado | Decisão |
|------|--------|---------|
| 8.1 Espécies | `/v3/veterinaria/especies` | 🟡 puxar da base externa (Petlove) |
| 8.2 Raças | `/v3/veterinaria/racas` | 🟡 idem; no cadastro do animal, raça/espécie autopreenche |
| 8.3 Pelagens | `/v3/veterinaria/pelagens` | 🟡 idem |
| 8.4 Patologias | `/v3/veterinaria/patologias` | 🟡 **enriquecer fortemente** via bulário (Vet Smart)/IA; reestruturar |
| 8.5 Tipos de atendimento | `/cadastro/tipoatendimento/...` | 🟢 MANTER (regras: duração, fluxo de agenda) |
| 8.6 Vacinas | `/cadastro/vacina/...` | 🟡 **CONSOLIDAR** no catálogo único |
| 8.7 Exames | `/cadastro/exame/...` | 🟡 CONSOLIDAR (lab + imagem juntos) |
| 8.8 Atributos de exames | `/cadastro/exameatributo/...` | 🟡 consolidar como detalhe do exame |
| 8.9 Referências de exames | `/cadastro/examereferencia/...` | 🟡 consolidar como detalhe do exame |
| 8.10 Modelo de receita | `/config/modeloreceita/...` | 🟢 MANTER (suporta receita controlada); editor mais flexível |
| 8.11 Origem dos clientes | `/v3/veterinaria/origem-dos-clientes` | 🔴 **CORTAR tela**; dado vai no cadastro do cliente + relatório |
| 8.12 Modelo de documento | `/config/modelodocumento/...` | 🟢 MANTER (contratos, check-in/out) |

## 9. Internação
> Alto potencial de inovação. Pilares: **painel consolidado**, **TV/tablet por
> box**, **faturamento automático a cada execução**.

| Tela | Legado | Decisão |
|------|--------|---------|
| 9.1 Animais internados (dashboard) | `/internamento/.../dashboard.php` | 🟡 mostrar **próximo procedimento** no card + 🔵 **visão TV** (consolidada) e **tablet por box** (estilo painel McDonald's: em produção/pronto) |
| 9.2 Mapa de Execução | `/internamento/execucao/...` | 🟢 MANTER (conceito forte) + 🔵 exibir **dentro** da internação e em TV/tablet + 🔵 **executar = baixar (muda cor) e faturar automático** |
| 9.3 Histórico de Internações | `/internamento/.../internamento.php` | 🟢 MANTER |
| 9.4 Ficha de internação (detalhe) | (a partir dos cards) | 🟡 **simplificar** (excesso de botões) + 🔵 **admissão explícita** + 🔵 **alta gera cobrança automática** consolidando a fatura |
| 9.5 Parâmetros clínicos | `/v3/internacao/parametros-clinicos` | 🟢 MANTER (opções prontas, só selecionar) |
| 9.6 Modelos de prescrição | `/internamento/prescricaomodelo/...` | 🟢 MANTER (acelera prescrição) |
| 9.7 Boxes | `/v3/internacao/boxes` | 🟢 **ATIVAR** — cadastrar boxes físicos (base do tablet por box) |

### 9.8 Fase 1 — implementado ✅
Fatia mínima entregue (`apps/api/src/modules/internacao` + `/internacao` no web):
- **Admissão explícita** (9.4): animal + motivo + box (texto livre; cadastro de
  boxes 9.7 fica p/ fase 2). Vira evento na linha do tempo do animal.
- **Mapa de execução** (9.2): prescrever item do catálogo (preço herdado) ou
  lançamento livre; **executar = baixa de estoque automática** (itens estocáveis;
  a execução clínica nunca é bloqueada por falta de saldo — sinaliza no retorno)
  **+ faturamento automático** na fatura aberta do responsável (helper
  compartilhado `FaturamentoService`, usado também pelo prontuário).
- **Alta** (9.4): encerra e registra na linha do tempo. Painel lista internados
  com pendências (9.1). TV/tablet por box, parâmetros clínicos (9.5) e modelos
  de prescrição (9.6) → fase 2.
- API: `GET/POST /api/internacoes`, `GET /api/internacoes/:id`,
  `POST .../execucoes`, `POST .../execucoes/:execId/executar`, `POST .../alta`.

---

## Reposicionamento de telas (resumo)
- **Mover para Financeiro**: Saldo dos clientes, Recebimentos, Formas de
  recebimento.
- **Mover para Configuração**: Regras de venda (4.13).
- **Manter em Vendas**: Orçamento, acoplado à ficha do cliente.
- **Origem do cliente**: no cadastro do cliente + relatório (sem tela própria).

## Cortes da fase 1
PDV (4.1), Consulta vendas (4.3, absorvida), tela dedicada de Origem dos clientes
(8.11), telas decorativas sem função, históricos antigos exibidos por padrão
(extratos/comissões).

## Pendências ⚪ DEFINIR (validar com equipe clínica / Ana Terra)
Movimentos de caixa (4.4), Pacotes vendidos (4.5), Recebimentos (4.6 → Financeiro),
Modelo de demonstrativo (4.12), "relatório de procedimento cirúrgico" (ícone não
identificado em Cadastros).
