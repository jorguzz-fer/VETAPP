# 00 — Visão geral e princípios

## 1. Objetivo do produto

VETAPP é uma plataforma de gestão para clínicas veterinárias. O ponto de partida é
o sistema SimplesVet (mapeado tela a tela), mas o projeto **não é um reskin**: é
uma **reescrita conceitual** que limpa funcionalidades redundantes, moderniza a UX
e coloca o **prontuário eletrônico** ("a vida do bichinho") no centro, com o
**faturamento acoplado ao ato clínico**.

> "Esse software deve ter sido feito em meados dos anos 2000." — o redesign assume
> arquitetura, segurança e UX contemporâneas.

### O que diferencia o VETAPP

1. **Prontuário eletrônico como produto** — histórico completo da vida do animal,
   com lançamento de atendimento/venda/orçamento no mesmo fluxo.
2. **Faturamento automático** — cada ação clínica (atendimento, procedimento,
   medicação na internação, alta) pode gerar lançamento financeiro, consolidando a
   fatura do cliente.
3. **Internação inovadora** — painel consolidado, telas de TV/tablet por box e
   baixa+faturamento a cada execução.
4. **Independência estratégica** — alternativa à concentração do mercado pela
   Petlove, integrando-se a bases externas sem depender delas.

## 2. Diretrizes inegociáveis (entrada do stakeholder)

| Diretriz | Implicação na SPEC |
|----------|--------------------|
| Desktop **e** Mobile | Web responsiva mobile-first; PWA instalável; layout adaptativo. |
| Caminho para apps **iOS/Android** | Camada de API estável e versionada; lógica de negócio 100% no servidor para reuso por qualquer cliente nativo. |
| **Multitenant** | Isolamento de dados por tenant em todas as camadas (ver doc 03). |
| **MFA + Google connectors** | TOTP/WebAuthn + login Google + Google Agenda (ver doc 02). |
| **Segurança de altíssimo nível** | Autenticação/autorização sempre server-side; nenhuma rota de negócio exposta sem authz; front não é fronteira de confiança. |

## 3. Personas e "home por persona"

A home **não é única** — depende do perfil de quem loga (princípio "visão por
login"):

- **Gestor(a)/dono(a)** → visão gerencial consolidada (KPIs, vendas, produtividade).
- **Recepção** → agenda do dia e fila de atendimento; marcação rápida.
- **Médico(a) veterinário(a)** → a própria agenda + pendências clínicas do dia
  (exames a lançar, prescrições, internações sob sua responsabilidade).
- **Setor de internação** → painel consolidado da internação (mapa de execução).
- **Financeiro** (fase posterior) → recebimentos, saldos, faturas.

## 4. Princípios de UX/UI do redesign

1. **Navegação em contexto** — parar de abrir telas/modais empilhados; navegar
   dentro do contexto atual.
2. **Toda ação tem efeito** — nenhum botão inerte (o ícone de telefone que não
   liga, ícones decorativos). Todo clicável tem ação clara.
3. **Consolidar, não multiplicar** — um dashboard por domínio (vendas,
   produtividade) em vez de N relatórios que mostram o mesmo dado.
4. **Cadastro único** — produtos, serviços, exames, vacinas, medicamentos,
   cirurgias **e** tabela de preços em um só lugar; itens referenciados por
   **código**.
5. **Simplicidade para o veterinário** — menos campos e botões; o profissional
   quer atender, não caçar cadastro.
6. **Visão por perfil/login** — cada papel vê o que lhe interessa.

## 5. Escopo

### No escopo deste mapeamento (base da SPEC)
Painel de Controle, Atendimento Clínico (prontuário), Agenda, Vendas,
Comissionamento, Inteligência, Consultas, Cadastros e Internação.

### Fora deste mapeamento (a detalhar em rodadas futuras)
Estoque e serviços, Financeiro (módulo completo), Beta, Configuração, Fiscal,
Site e Portal. A SPEC já **reserva lugar arquitetural** para eles (ex.: mover
Saldo/Recebimentos/Formas de recebimento para Financeiro).

### Faseamento (resumo — detalhe no doc 08)
- **Fase 1 — Gestão clínica**: prontuário, agenda, cadastros consolidados,
  dashboards de vendas/produtividade, internação. **Sem PDV/caixa**.
- **Fase 2 — Financeiro + Integrações**: módulo financeiro, WhatsApp, Google
  Agenda, Petlove/Vet Smart.
- **Fase 3 — IA + Apps nativos**: agendamento/atendimento por IA, apps iOS/Android.

## 6. Glossário rápido

- **Tenant** = clínica (cliente da plataforma).
- **Responsável** = tutor/dono do animal (o "cliente" no sentido comercial).
- **Prontuário** = histórico clínico completo do animal.
- **Box** = baia de internação.
- **Mapa de execução** = cronograma horário de procedimentos/medicações na
  internação.
