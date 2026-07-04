# 02 — Segurança e autenticação

> Diretriz do stakeholder: **"Segurança de altíssimo nível — autenticações sempre
> do lado do servidor, não permitir nenhuma porta aberta ou rota exposta para
> usuários."** Este documento detalha como isso é garantido.

## 1. Princípios de segurança

1. **Server-authoritative auth**: o cliente nunca decide se está autenticado ou
   autorizado. Toda rota valida sessão + permissão + tenant no servidor, a cada
   request. Não existe "rota protegida só no front".
2. **Superfície mínima**: somente o gateway/BFF é público (porta 443). Nenhum
   serviço interno, banco, fila ou worker tem porta exposta (ver doc 01).
3. **Zero trust interno**: serviços se autenticam entre si (mTLS / tokens de
   serviço). Estar na rede não concede acesso.
4. **Defense in depth**: authz na aplicação **e** RLS no banco por `tenant_id`.
5. **Segredos fora do código**: KMS/Vault; rotação automática; nada de chave em
   repositório ou no bundle do cliente.
6. **Privacidade por padrão (LGPD)**: minimização de dados, criptografia em
   repouso e trânsito, trilha de auditoria.

## 2. Autenticação de usuários

### 2.1 Métodos suportados
- **E-mail + senha** (Argon2id para hashing; política de senha forte).
- **Login com Google (OIDC)** — "Google connectors" da diretriz. Conta Google
  vinculada a um usuário do tenant; o servidor valida o `id_token` e o domínio.
- **WebAuthn / Passkeys** — recomendado como segundo fator forte e, futuramente,
  como passwordless.

### 2.2 MFA (obrigatório para papéis sensíveis)
- **TOTP** (Google Authenticator/Authy) e/ou **WebAuthn** como segundo fator.
- MFA **obrigatório** para gestor/admin e financeiro; **configurável** (e
  recomendado) para os demais. Política de MFA por tenant.
- Códigos de recuperação de uso único, gerados e exibidos uma só vez.
- "Lembrar este dispositivo" por tempo limitado, vinculado a device fingerprint +
  reautenticação MFA periódica.

> **Implementado (fase 2)** — recovery codes de uso único. Ao ativar o MFA
> (`POST /auth/mfa/enable`) a API gera 10 códigos no formato `xxxx-xxxx`, exibidos
> **uma única vez**; no banco fica só o **hash argon2id** (`mfa_recovery_codes`,
> tabela global sem RLS, escopo por `user_id`). `POST /auth/mfa/verify` aceita um
> TOTP **ou** um recovery code (consumido → `used_at`). `POST /auth/mfa/recovery-codes`
> regera o conjunto (exige TOTP; invalida os anteriores). Desativar o MFA apaga os
> códigos. **Pendente**: MFA obrigatório por papel (exige fluxo de setup forçado),
> WebAuthn, "lembrar dispositivo".

### 2.3 Sessões e tokens
- **Web**: sessão em **cookie httpOnly + Secure + SameSite=strict/lax**. Tokens
  **não** acessíveis a JavaScript (mitiga XSS-roubo de token). CSRF mitigado por
  SameSite + token anti-CSRF em mutações.
- **Mobile/nativo (futuro)**: OAuth2/OIDC com **access token curto** (ex.: 10–15
  min) + **refresh token rotativo** guardado no keystore seguro do dispositivo
  (Keychain/Keystore). Rotação detecta replay (refresh token reuse).
- Revogação imediata: logout, troca de senha, suspeita de comprometimento e
  remoção de usuário invalidam sessões ativas (lista de revogação em Redis).

> **Implementado (fase 2)** — refresh token **stateful com rotação e detecção de
> reuso**. Cada sessão tem uma *family* (UUID). O refresh JWT carrega apenas
> `{ sub, jti, family, scope:'refresh' }` (assinado com `JWT_REFRESH_SECRET`); todo
> o estado — expiração, revogação, encadeamento — mora em `refresh_tokens` (tabela
> global sem RLS, escopo por `jti`/`user_id`). `POST /auth/refresh` valida a linha,
> emite um novo par na **mesma family** e revoga o `jti` apresentado (rotação).
> Apresentar um `jti` **já revogado** = reuso (replay/roubo) → **revoga a family
> inteira** e recusa. `POST /auth/logout` revoga a family (best-effort, idempotente).
> O access token segue stateless (`{ sub, tenantId, role }`, TTL curto). Frontend:
> renovação **proativa** ~60s antes do `exp` (não intercepta 401). **Pendente**:
> migrar do Bearer/localStorage para **cookie httpOnly/BFF**; lista de revogação por
> troca de senha; limpeza periódica de tokens expirados.

### 2.4 Proteções de fluxo
- Rate limiting e **lockout progressivo** por usuário/IP em login e MFA.
- Detecção de credential stuffing; alerta de login de novo dispositivo/local.
- Verificação de e-mail e fluxo seguro de reset de senha (token de uso único,
  curta validade, sem enumerar usuários).

## 3. Autorização (RBAC + tenant scoping)

- Cada request resolve **(usuário, tenant, papéis, permissões)** no servidor.
- **Toda** consulta/escrita é filtrada por `tenant_id` na aplicação **e** no banco
  (RLS). Um usuário de um tenant nunca acessa dado de outro, mesmo com ID forjado.
- Permissões por papel (ver doc 07): ex.: recepção marca agenda mas não fecha
  comissão; médico vê só a própria agenda por padrão.
- Autorização a nível de objeto onde necessário (ex.: prontuário de animal
  pertencente ao tenant; comissão do próprio colaborador).
- Princípio do menor privilégio também para chaves de integração.

## 3.1 Acesso de aplicações externas (machine-to-machine)

A API é exposta a outras aplicações (ver doc 11), mas **sob as mesmas regras**:
- **OAuth2 Client Credentials** (server-a-servidor) ou **Authorization Code +
  PKCE** (quando age em nome de um usuário). Tokens JWT de curta duração com
  `tenant_id` + `scopes`.
- **Escopos granulares** + RBAC + RLS: a aplicação só acessa o que o tenant
  concedeu, e só dados daquele tenant.
- `client_secret`/API keys **apenas no servidor** do parceiro, rotacionáveis e
  revogáveis; **rate limiting/quotas** por aplicação; auditoria de todo acesso.
- "Exposta" não é "aberta": **nenhuma** rota de negócio é anônima.

## 4. "Nenhuma porta aberta / rota exposta"

Tradução concreta da diretriz:
- **Único ingress público**: gateway/BFF em HTTPS atrás de WAF. Todo o resto em
  rede privada sem rota de entrada.
- **Nenhum endpoint de negócio sem authz**: o gateway nega por padrão; rotas são
  *allow-list*. Não existe rota pública de leitura de dados de clínica. A API para
  terceiros é **autenticada e escopada** (§3.1 e doc 11), nunca aberta.
- **Sem acesso direto a recursos**: anexos do prontuário só por **URL assinada**
  de curta validade emitida após checagem de permissão; bucket privado.
- **Admin/observabilidade** (dashboards, métricas, banco) só por rede interna /
  VPN / bastion, nunca expostos publicamente.
- **Webhooks** (Google/WhatsApp) em endpoint dedicado com verificação de
  assinatura e IP allow-list quando aplicável.

## 5. Integrações e segredos de terceiros
- Tokens OAuth de Google Agenda, credenciais da API de WhatsApp e chaves da
  Petlove/Vet Smart vivem **apenas no servidor** (cofre), nunca no cliente.
- Escopos mínimos (ex.: Google Agenda apenas calendar do tenant autorizado).
- Tokens por tenant, isolados; revogáveis individualmente.

## 6. Proteção de dados (LGPD)
- Criptografia **em trânsito** (TLS 1.2+/1.3, mTLS interno) e **em repouso**
  (disco do banco, storage de anexos).
- Dados pessoais de responsáveis e dados clínicos tratados como sensíveis;
  minimização e retenção definidas por política.
- **Trilha de auditoria** imutável (quem fez o quê, quando, em qual tenant) —
  corresponde ao módulo "Log" mantido (item 7.3 do mapeamento), elevado a
  requisito de segurança.

  > **Implementado** — tabela `audit_log` **append-only por tenant** (`tenant_id`,
  > `user_id` nullable, `acao`, `entidade`, `entidade_id`, `resumo`, `detalhe` jsonb,
  > `ip`, `created_at`). **Imutabilidade garantida no banco**, não só na aplicação:
  > a migração 0023 cria policies RLS **apenas** de `SELECT` e `INSERT` (isolamento
  > por tenant, padrão `NULLIF` fail-closed) — como não há policy de `UPDATE`/`DELETE`
  > e o RLS é *default-deny*, qualquer papel sujeito ao RLS afeta **zero linhas** ao
  > tentar editar/apagar (role-agnóstico); em cima disso, `REVOKE UPDATE, DELETE` de
  > `vetapp_app` dá erro **duro** em produção. `AuditService.registrar(tenantId, …)`
  > é **best-effort** (falha nunca quebra a ação de negócio) e roda sob `withTenant`.
  > Gravada hoje nas escritas sensíveis: **auth** (`login`/`logout`/`register`),
  > **usuários/acessos** (criar/atualizar/reset-senha/remover), **fiscal**
  > (emitir/cancelar) e **financeiro** (receber). Consulta em `GET /api/auditoria`
  > (paginada + filtro por entidade), **restrita a admin** (doc 07). O teste de
  > isolamento (`tenant-isolation.spec.ts`) cobre o append-only na CI. **Pendente**:
  > `request_id` correlacionável, auditar prontuário/acessos de leitura sensível,
  > exportação/retenção por política e alerta de anomalia.
- Direitos do titular (acesso, correção, exclusão) suportados por processo.
- Preferência por **hospedagem em região no Brasil** **[A DEFINIR]**.

## 7. Ciclo de desenvolvimento seguro (SSDLC)
- Revisão de segurança no PR; análise estática (SAST) e de dependências (SCA) na
  CI; secret scanning.
- Testes de autorização automatizados (garantir que tenant A não lê tenant B).
- Pentest antes do go-live e a cada major.
- Gestão de vulnerabilidades com SLA por severidade.

## 8. Modelo de ameaças (resumo)

| Ameaça | Mitigação |
|--------|-----------|
| Vazamento entre tenants | Tenant scoping na app + RLS no banco; testes automatizados |
| Roubo de token (XSS) | Cookie httpOnly; CSP estrita; tokens fora do JS |
| CSRF | SameSite + token anti-CSRF em mutações |
| Força bruta / stuffing | Rate limit, lockout, MFA, alerta de novo device |
| Acesso direto a anexos | Bucket privado + URL assinada curta pós-authz |
| Exposição de serviço interno | Tudo privado; só BFF público; mTLS interno |
| Comprometimento de chave de terceiro | Cofre, escopo mínimo, rotação, isolamento por tenant |
| Escalonamento de privilégio | RBAC server-side, menor privilégio, authz por objeto |
