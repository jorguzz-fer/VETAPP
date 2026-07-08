# 17 — CRM / Mensageria

> **Origem:** frente futura levantada no doc 16 (CRM1) e pelo stakeholder — "ter uma
> espécie de CRM, captando e conectando a ferramenta com todos os canais de entrada".
> Este doc define o módulo de **mensageria** (registro/envio de mensagens por canal) e
> a base de **CRM** (histórico por cliente, campanhas, lembretes).
>
> **Diretriz de sempre (doc 02):** auth server-side, nenhuma rota exposta à toa.
> Tenant-scoped com **RLS fail-closed** em toda tabela de domínio. Dinheiro em centavos.

Legenda: ✅ feito · 🟡 em andamento · 🔜 fase futura / decisão externa.

## Princípio de arquitetura — provider-agnostic (igual ao Fiscal, doc 13 §3.3)

O envio real por canais externos (**WhatsApp Business API**, **SMS**, **e-mail**)
custa dinheiro, exige contas/aprovação (Meta, gateway SMS, domínio/SES) e **credenciais**
— portanto é **decisão do stakeholder**, fora do escopo autônomo. O módulo nasce
**provider-agnostic**:

- **`MensagemProvider`** (interface) + **factory** por canal/config.
- Driver **`log`/`manual`** (default, sem dependência externa): **registra** a mensagem
  no histórico com status `registrada`; o envio efetivo é manual (ex.: botão WhatsApp
  já existente na ficha). Entrega o **rastreio/histórico** imediatamente.
- Drivers externos (`whatsapp-cloud`, `sms-*`, `email-ses`) **recusam explícito** até
  serem plugados com credenciais no cofre (nunca no banco/repo).

Assim o histórico, os templates e os lembretes funcionam hoje; quando o provedor for
escolhido, só se pluga o driver — o resto não muda.

## 1. Modelo de dados

### `mensagens` (RLS) — o log/CRM
- `id`, `tenant_id`
- `responsavel_id` (cliente destinatário; nullable p/ futuros leads)
- `canal` — `whatsapp | email | sms | manual`
- `direcao` — `saida` (entrada = 🔜)
- `assunto` (nullable; e-mail), `corpo`
- `status` — `registrada | enviada | entregue | visualizada | clicada | falha`
- `template_id` (nullable), `referencia_tipo`/`referencia_id` (ex.: `vacina`, `agendamento`)
- `disparado_por` (user), `erro` (nullable), `enviada_em` (nullable), `created_at`

### `mensagem_templates` (RLS) — modelos reutilizáveis
- `id`, `tenant_id`, `nome`, `canal`, `assunto` (nullable), `corpo` (com placeholders
  `{{cliente}}`, `{{pet}}`, `{{vacina}}`, `{{data}}`), `ativo`, timestamps.

## 2. API (`/api/mensagens`, sob RBAC)
- `GET /api/clientes/:id/mensagens` — histórico do cliente (qualquer staff).
- `POST /api/clientes/:id/mensagens` — registrar/enviar (recepção/gestão) — passa pelo
  provider (driver `log` → status `registrada`).
- `GET /api/mensagens` — histórico geral (filtros: canal, status, período) — gestão/CRM.
- Templates: `GET/POST/PATCH /api/mensagens/templates` (admin/gestor).

## 3. Front
- **Histórico de mensagens** na ficha do cliente (doc 16 F3) + menu **⋮** (registrar
  mensagem, escolher template/canal).
- Página **/mensagens** (CRM): histórico geral + filtros (gestão).
- Templates em **/cadastros**.

## 4. Lembretes & automações
- **Lembrete de vacina** (doc 16 PR9): `GET /api/mensagens/vacinas-vencendo?dias=30`
  (usa `vacinas.proxima_em` + índice `vacinas_proxima_idx`) → lista + ação "registrar
  lembrete" (cria `mensagem` com `referencia_tipo='vacina'`).
- **Notificação de chegada** (doc 16 A4): ao confirmar chegada na agenda, registra uma
  mensagem/nota ao profissional. Envio ativo (push) = 🔜.
- **Disparo automático** (agendado) dos lembretes = 🔜 (depende do provider + scheduler).

## 5. Roadmap
1. ✅/🟡 **Slice 1** — núcleo `mensagens` + driver `log` + histórico na ficha + menu ⋮.
2. 🔜 **Slice 2** — templates (CRUD + placeholders).
3. 🔜 **Slice 3** — lembretes de vacina (vencimentos → registrar) + chegada.
4. 🔜 **Slice 4** — página CRM `/mensagens` (histórico geral + filtros) + relatórios.
5. 🔜 **Externo (decisão do stakeholder)** — provider real (WhatsApp Business/SMS/e-mail),
   credenciais no cofre, webhooks de status (entregue/visualizado/clicado), disparo
   automático agendado, campanhas segmentadas.
