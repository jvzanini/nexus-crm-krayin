# Spec: Fase 7b — Email OAuth + IMAP/SMTP connect

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** Fase 7a (schema + crypto + RBAC email:*) ✅.
**Gate para:** Fase 7c (send+tracking) + Fase 9 (marketing).

---

## Changelog

### v2 → v3 (Review 2)
- **Dry-run mode:** quando `GOOGLE_OAUTH_CLIENT_ID` / `MS_OAUTH_CLIENT_ID` ausentes, endpoints `/api/oauth/*/authorize` retornam 503 com mensagem clara em vez de crash. Permite deploy sem secrets.
- **Refresh scheduler:** BullMQ repeatable job (`oauth-refresh`) roda a cada 5 min, renovando tokens que expiram em < 10 min. Re-enqueue no boot, idempotente.
- **State param:** CSRF protection via random state guardado em Redis com TTL 10 min, validado no callback.
- **Scopes mínimos:** Gmail `https://www.googleapis.com/auth/gmail.send` + `gmail.readonly` (readonly para fetch threads; send para 7c). Outlook `Mail.Send Mail.Read offline_access`.
- **IMAP connect:** test connection no save. Password criptografado via `encrypt()` antes de persistir.

### v1 → v2 (Review 1)
- Endpoints REST (não Server Actions) porque OAuth providers exigem HTTP endpoints fixos para callback.
- UI `/settings/mailboxes` mostra lista + botão "Conectar" → dropdown provider → redirect.

---

## 1. Objetivo

Permitir usuário conectar caixa de email via OAuth (Gmail, Outlook) ou IMAP/SMTP direto. Tokens criptografados. Refresh automático. CSRF-protected.

## 2. Escopo

### 2.1. Endpoints (App Router `/api/oauth/*`)

- `GET  /api/oauth/gmail/authorize` — gera `state`, guarda em Redis (`oauth:state:<nonce>:<userId>`, TTL 600s), redirect para Google com scopes + redirect_uri.
- `GET  /api/oauth/gmail/callback?code&state` — valida state, trocar code por tokens, upsert Mailbox com tokens encriptados.
- `GET  /api/oauth/outlook/authorize` + callback análogos.

### 2.2. Server Actions

- `connectImapSmtpAction({ emailAddress, displayName?, imapHost, imapPort, smtpHost, smtpPort, authUsername, authPassword })` — testa IMAP login (via `imapflow`), se OK encripta password, salva Mailbox provider=imap_smtp.
- `listMailboxes()` — lista mailboxes do tenant (para o usuário atual).
- `setPrimaryMailbox(id)` — unset others, set.
- `disconnectMailbox(id)` — `requirePermission('email:manage')` ou owner; set `isActive=false` e apaga tokens/creds (limpa strings encrypt).
- `getMailboxTokens(id)` — server-only, para uso em send (7c). Retorna `{ accessToken, expiresAt, refreshToken, provider }` decrypted.

### 2.3. Refresh scheduler (BullMQ)

`src/lib/worker/queues/oauth-refresh.ts`:
- Queue `oauth-refresh`.
- Repeatable job `refresh`, cron `*/5 * * * *`.
- Processor: `findMany` mailboxes com `accessTokenExpAt < now + 10 min` e `provider in ('gmail','outlook')`, executa refresh via provider SDK, atualiza `accessTokenEnc` + `accessTokenExpAt`.

### 2.4. UI `/settings/mailboxes`

- Guard `email:view` no server component.
- Lista: table mailboxes com provider icon, emailAddress, isPrimary badge, status (connected/expired/error), ações (Set primary / Disconnect).
- Botão "Conectar nova caixa" abre dropdown:
  - "Google (Gmail)" — se `GOOGLE_OAUTH_CLIENT_ID` set, link para `/api/oauth/gmail/authorize`; caso contrário disabled com tooltip "Configure GOOGLE_OAUTH_CLIENT_ID".
  - "Microsoft (Outlook)" — idem.
  - "IMAP/SMTP custom" — abre Dialog com form.

### 2.5. Fora de escopo

- Múltiplos tenants conectando o mesmo Google account (permite, mas UX separada).
- OAuth refresh via provider webhook (polling é suficiente).
- Shared mailbox (delegação).

## 3. Testes

- Unit: `encryptMailboxTokens` helper + refresh logic com mock.
- Integration: connect IMAP (contra servidor de teste dockerizado — opcional).
- E2E: Manual OAuth via staging (requer secrets).

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Token vazado em logs | Muito alto | Redactors já cobrem `*.accessToken`, `*.refreshToken`. Nunca logar mailbox com tokens. |
| CSRF em callback | Alto | State nonce em Redis, TTL curto, validado antes do code exchange. |
| Secret exfil via exception | Alto | Sentry `beforeSend` scrub já cobre `*_SECRET*` + `*_TOKEN*`. |
| Refresh loop infinito | Médio | Se refresh falha 3x consecutivas, marca mailbox `isActive=false` e cria Notification. |

## 5. Aceite

- Endpoints OAuth retornam 503 sem secrets (dry-run).
- `connectImapSmtpAction` funcional contra servidor test.
- `/settings/mailboxes` renderiza mesmo com 0 mailboxes.
- Refresh scheduler registra-se no boot do worker (sem rodar em dev local sem Redis).

## 6. Dependências

- `googleapis` `^144` — Gmail OAuth + API.
- `@azure/msal-node` `^2` — MS OAuth.
- `imapflow` `^1.0.150` — IMAP test/receive.
- `nodemailer` `^6.9` — SMTP send (Fase 7c usa).
