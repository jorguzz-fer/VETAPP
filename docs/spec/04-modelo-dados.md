# 04 — Modelo de dados (visão de domínio)

> Visão conceitual, não DDL final. Implementação em **Drizzle** (schema em TS,
> migrations com `drizzle-kit`). Toda tabela de domínio carrega `tenant_id`
> (ver doc 03). Tipos sugeridos: `uuid` para PKs, `timestamptz`, `numeric` para
> dinheiro.

## 1. Domínios (bounded contexts)

1. **Identidade & Acesso** — usuários, tenants, papéis, sessões, MFA.
2. **Cadastro de Clientes & Animais** — responsáveis, animais, prontuário.
3. **Catálogo & Preços** — produtos/serviços/exames/vacinas/medicamentos/cirurgias
   + tabela de preços (cadastro único).
4. **Agenda & Escala** — agendamentos, horários, escala de colaboradores.
5. **Clínico** — atendimentos, prescrições, exames, vacinas, documentos.
6. **Internação** — internações, boxes, mapa de execução, parâmetros clínicos.
7. **Comercial** — vendas, orçamentos, pacotes, comissões.
8. **Financeiro** (fase 2) — faturas, recebimentos, saldos, formas de recebimento.
9. **Comunicação** — lembretes (WhatsApp), campanhas, NPS.
10. **Auditoria** — log imutável de ações.

## 2. Entidades principais

### Identidade & Acesso
- **tenant**(id, nome, documento, status, config, criado_em)
- **user**(id, nome, email, senha_hash, mfa_enabled, google_sub, status)
- **membership**(id, user_id, tenant_id, papel, escopos) — usuário × tenant × papel
- **role / permission** — RBAC (ver doc 07)
- **session / refresh_token** — server-side, revogáveis

### Clientes & Animais
- **responsavel** (cliente/tutor)(id, tenant_id, nome, codigo, tipo[autônomo/PJ],
  documentos[RG/CPF], aniversario, origem["Como nos conheceu?"], nps,
  opt_out_msg, criado_em, atualizado_em)
- **contato**(id, responsavel_id, tipo[telefone/email/endereço], valor, whatsapp?)
- **animal**(id, tenant_id, responsavel_id, nome, codigo, especie_id, raca_id,
  pelagem_id, sexo, castrado, nascimento, status[vivo/falecido], foto_ref)
- **animal_tag_patologia**(animal_id, patologia_id) — tags ex.: "renal"
- **animal_peso**(id, animal_id, valor, medido_em) — histórico de peso

### Prontuário (clínico)
- **atendimento**(id, tenant_id, animal_id, profissional_id, tipo_atendimento_id,
  data, status, observacoes) — pode gerar venda
- **evento_prontuario**(id, animal_id, tipo[documento/vacina/peso/exame/receita/
  observacao/foto/video/internacao], ref_id, data) — alimenta a **timeline**
- **exame_realizado**(id, atendimento_id, exame_id, atributos[jsonb], referencias)
- **vacina_aplicada**(id, animal_id, vacina_id, aplicada_em, proxima_dose,
  status[programada/aplicada/vencida])
- **receita**(id, atendimento_id, modelo_id?, itens[jsonb], controlada?)
- **documento_emitido**(id, animal_id, modelo_documento_id, conteudo, assinaturas)

### Catálogo & Preços (cadastro único)
- **item_catalogo**(id, tenant_id, codigo, nome, tipo[produto/serviço/exame/vacina/
  medicamento/cirurgia], ativo, atributos[jsonb]) — **um lugar só**
- **preco**(id, item_id, valor, vigencia, tabela_id?) — **Tabela de preços** única
- **comissao_regra**(id, item_id, colaborador_id?, tipo, valor/percentual)
- **especie / raca / pelagem / patologia** — catálogo **global** (Petlove/IA),
  estendível por tenant (ver doc 03 §6)
- **tipo_atendimento**(id, tenant_id, codigo, nome, duracao, fluxo_agenda
  [clínica/banho&tosa], alertas, areas, ativo)

### Agenda & Escala
- **agendamento**(id, tenant_id, profissional_id, animal_id?, responsavel_id?,
  tipo_atendimento_id, inicio, fim, status, origem[recepção/IA/google], google_event_id?)
- **agenda_config**(tenant_id, dia_semana, abertura, fechamento)
- **usuario_agenda**(user_id, tenant_id, servicos, intervalo_min, escala_variavel?)
- **escala**(id, tenant_id, colaborador_id, dia, inicio, fim, confirmada?)

### Internação
- **box**(id, tenant_id, nome, status[livre/ocupado/manutenção])
- **internacao**(id, tenant_id, animal_id, box_id, vet_responsavel_id, risco
  [urgente/pouco urgente], situacao[internado/óbito/alta], admissao, alta_prevista,
  alta_real, fatura_id?)
- **prescricao_item**(id, internacao_id, item_catalogo_id, dose, via, frequencia,
  duracao, modelo_id?)
- **execucao**(id, internacao_id, prescricao_item_id, horario_previsto,
  executado_em?, executado_por?, status[programada/vencida/baixada], lancamento_id?)
  — base do **Mapa de Execução** e do faturamento automático
- **parametro_clinico**(id, tenant_id, nome, opcoes[jsonb])
- **registro_parametro**(id, internacao_id, parametro_id, valor, registrado_em)
- **modelo_prescricao**(id, tenant_id, nome, itens[jsonb])

### Comercial
- **venda**(id, tenant_id, responsavel_id, animal_id?, tipo[venda/orçamento],
  status[não pago/pago/cancelado], origem[prontuário/PDV(fase2)], total)
- **venda_item**(id, venda_id, item_catalogo_id, colaborador_id, qtd, preco,
  desconto, comissao_calculada)
- **orcamento** = venda com tipo=orçamento, vinculável à ficha do cliente
- **modelo_orcamento / pacote**(id, tenant_id, nome, codigo, itens[por código],
  compartilhado?, ativo) — ex.: INTERNAÇÃO BRONZE/OURO/PRATA
- **comissao_fechamento**(id, tenant_id, colaborador_id, periodo, valor, status
  [aberto/fechado/pago])

### Financeiro (fase 2 — lugar reservado)
- **fatura**(id, tenant_id, responsavel_id, itens, status, total) — consolida
  lançamentos automáticos do clínico/internação
- **recebimento**(id, fatura_id, forma_id, valor, data)
- **forma_recebimento**(id, tenant_id, nome, ativo)
- **saldo_cliente**(responsavel_id, saldo, situacao[devedor/credor]) — **vive no
  Financeiro**, não em Vendas (decisão do mapeamento)

### Comunicação & Auditoria
- **lembrete**(id, tenant_id, tipo[vacina/aniversário], canal[whatsapp],
  agendado_para, status, gatilho[manual/automático])
- **mensagem**(id, tenant_id, responsavel_id, canal, conteudo, status, enviado_em)
- **audit_log**(id, tenant_id, user_id, acao, entidade, antes/depois, ip, ts) —
  imutável (corresponde ao módulo "Log")

## 3. Princípio: faturamento acoplado ao clínico

`atendimento`, `execucao` (medicação aplicada) e `internacao.alta` **emitem
eventos de domínio** (`atendimento.realizado`, `medicacao.executada`,
`internacao.alta`) que, conforme configuração do tenant, geram automaticamente
`venda_item`/`fatura`. Esse acoplamento (via fila de eventos, ver doc 01) é o que
realiza a diretriz "cada ação clínica pode gerar lançamento financeiro".

## 4. Notas de modelagem
- **Código** de item é cidadão de primeira classe (diretriz: montar pacotes/
  orçamentos por código, não por abreviação).
- **Timeline do prontuário** = view sobre `evento_prontuario` (consolida tudo na
  vida do animal).
- **Soft-delete + auditoria** em entidades clínicas/financeiras (nada some sem
  rastro).
- `jsonb` usado com parcimônia (atributos de exame, opções de parâmetro, itens de
  receita/modelo) onde o schema é flexível por natureza.
