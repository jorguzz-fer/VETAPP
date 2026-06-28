# 07 — Perfis e RBAC

> Princípio "visão por login": cada papel vê o que lhe interessa e só pode o que
> seu papel permite. Autorização **sempre no servidor** (ver doc 02 §3).

## 1. Papéis (roles) iniciais

| Papel | Descrição | Home padrão |
|-------|-----------|-------------|
| **Admin / Dono(a)** | Configura o tenant, vê tudo (gerencial, financeiro, comissões consolidadas) | Dashboard gerencial |
| **Gestor(a)** | Gestão operacional e comercial; sem config sensível de segurança | Dashboard gerencial |
| **Recepção** | Agenda, fila, cadastro de clientes/animais, marcação | Agenda do dia / fila |
| **Veterinário(a)** | Prontuário, atendimentos, prescrições, exames, internação; **vê a própria agenda** | Minha agenda + pendências |
| **Especialista / Volante** | Como veterinário, restrito aos seus atendimentos/comissões | Minha agenda |
| **Internação** | Painel de internação, mapa de execução, baixa de medicação | Painel de internação |
| **Banho & Tosa / Estética** | Agenda e atendimentos do fluxo "Banho e Tosa" | Minha agenda |
| **Financeiro** (fase 2) | Faturas, recebimentos, saldos, formas de recebimento | Painel financeiro |

> Papéis são **por tenant** (via `membership`). Um usuário pode ter papéis
> diferentes em tenants diferentes (ver doc 03 §4).

## 2. Matriz de permissões (resumo)

| Capacidade | Admin | Gestor | Recepção | Vet | Internação | Financeiro |
|------------|:----:|:-----:|:--------:|:---:|:----------:|:----------:|
| Configurar tenant / segurança | ✅ | ➖ | — | — | — | — |
| Cadastro de clientes/animais | ✅ | ✅ | ✅ | ✅ | ➖ | — |
| Prontuário (ler/escrever) | ✅ | ➖ | ➖(ler) | ✅ | ➖ | — |
| Agenda — ver todas | ✅ | ✅ | ✅ | — | — | — |
| Agenda — ver a própria | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Marcar/alterar agendamento | ✅ | ✅ | ✅ | ➖(a própria) | — | — |
| Internação (executar/baixar) | ✅ | ➖ | — | ✅ | ✅ | — |
| Vendas/orçamento (lançar) | ✅ | ✅ | ➖ | ✅ | ➖ | — |
| Dashboard de vendas | ✅ | ✅ | — | ➖(o próprio) | — | ➖ |
| Comissões — consolidado (todos) | ✅ | ✅ | — | — | — | ➖ |
| Comissões — as próprias | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Financeiro (faturas/recebimentos) | ✅ | ➖ | — | — | — | ✅ |
| Auditoria/Log | ✅ | ➖ | — | — | — | ➖ |

Legenda: ✅ total · ➖ parcial/condicional · — sem acesso.
*(Matriz inicial; ajustável por tenant — ver §4.)*

## 3. Regras de autorização notáveis
- **Médico vê só a própria agenda** por padrão (diretriz 3.1); gestão vê todas.
- **"Cada um vê o seu"** em comissões (5.3) e produtividade individual.
- **MFA obrigatório** para Admin/Gestor/Financeiro (ver doc 02 §2.2).
- Authz **a nível de objeto** quando aplicável (prontuário do animal do tenant;
  comissão do próprio colaborador; internação sob responsabilidade do vet).
- Negação por padrão: nenhuma rota de negócio sem checagem de papel + tenant.

## 4. Extensibilidade
- Papéis e permissões são **dados** (tabelas `role`/`permission`), permitindo:
  - papéis customizados por tenant no futuro;
  - permissões granulares (ex.: "pode dar desconto até X%", ligado à regra de
    venda 4.13).
- Mudança de papel revalida o escopo da sessão na hora.
