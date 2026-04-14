# Fase 7b — Email OAuth + IMAP/SMTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Permitir usuário conectar mailbox via OAuth (Gmail/Outlook) ou IMAP/SMTP; tokens encriptados; refresh automático; UI `/settings/mailboxes`.

**Architecture:** Endpoints REST `/api/oauth/*` (callback HTTP fixo); Server Actions para IMAP connect + list/set/disconnect; BullMQ `oauth-refresh` repeatable job; UI client com provider dropdown.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-7b-email-oauth-design.md`.

**Status:** planejado. Implementação aguarda:
1. `GOOGLE_OAUTH_CLIENT_ID/SECRET` — secret Portainer.
2. `MS_OAUTH_CLIENT_ID/SECRET` — secret Portainer.
3. Adicionar `googleapis`, `@azure/msal-node`, `imapflow`, `nodemailer` a package.json (CI install).

---

## Tasks

### T1 — Dependências + envs

**Files:**
- Modify: `package.json` (adicionar 4 deps).
- Modify: `.env.example` (adicionar GOOGLE_OAUTH_*, MS_OAUTH_*).

- [ ] Append deps a `dependencies`:
  ```json
  "googleapis": "^144.0.0",
  "@azure/msal-node": "^2.16.0",
  "imapflow": "^1.0.150",
  "nodemailer": "^6.9.16",
  ```
- [ ] `.env.example`: comentário + stub vars.
- [ ] Commit `chore(crm): deps for email oauth + imap + smtp (Fase 7b T1)`.

### T2 — Token helper + mailbox actions

**Files:**
- Create: `src/lib/email/tokens.ts` (encryptMailboxTokens, decryptMailboxTokens).
- Create: `src/lib/actions/mailboxes.ts`.
- Create: `src/lib/email/tokens.test.ts`.

- [ ] `encryptMailboxTokens({accessToken, refreshToken?, ...})` usa `encrypt()` do aes-gcm; `decrypt*` inverso. Tokens ficam em strings base64 no DB.
- [ ] Server Actions:
  - `listMailboxes()` — `requirePermission('email:view')`, filter by `userId` do session + tenant.
  - `setPrimaryMailbox(id)` — `requirePermission('email:manage')`; transaction: unset primary existente + set.
  - `disconnectMailbox(id)` — `requirePermission('email:manage')`; set `isActive=false`, limpa `accessTokenEnc`/`refreshTokenEnc`/`authPasswordEnc`.
  - `connectImapSmtpAction({...})` — Zod (email, host, port 1..65535, user, password non-empty). Chama `imapflow` connect + logout; se OK, encripta password, upsert mailbox.
- [ ] Tests: token round-trip + schema validation.
- [ ] Commit `feat(crm): mailbox actions (list/setPrimary/disconnect/connectImap) (Fase 7b T2)`.

### T3 — OAuth endpoints

**Files:**
- Create: `src/app/api/oauth/gmail/authorize/route.ts`
- Create: `src/app/api/oauth/gmail/callback/route.ts`
- Create: `src/app/api/oauth/outlook/authorize/route.ts`
- Create: `src/app/api/oauth/outlook/callback/route.ts`
- Create: `src/lib/email/oauth-state.ts` (Redis state nonce helper).

- [ ] `oauth-state.ts`: `saveState(userId)` → gera nonce, `redis.set('oauth:state:<nonce>', userId, 'EX', 600)`; `consumeState(nonce)` → GET + DEL.
- [ ] Gmail authorize: guard auth. Se `GOOGLE_OAUTH_CLIENT_ID` ausente → 503 `{error:"OAUTH_NOT_CONFIGURED"}`. Senão: `oauth2Client.generateAuthUrl({scopes: ['gmail.send','gmail.readonly'], state, access_type:'offline', prompt:'consent'})` redirect.
- [ ] Gmail callback: `consumeState(state)` valida; `oauth2Client.getToken(code)`; `gmail.users.getProfile` para email; upsert Mailbox com tokens encriptados. Redirect `/settings/mailboxes?connected=gmail`.
- [ ] Outlook: MSAL node. Scopes `Mail.Send Mail.Read offline_access`. Redirect target `/settings/mailboxes?connected=outlook`.
- [ ] Commit `feat(crm): oauth gmail + outlook authorize/callback (Fase 7b T3)`.

### T4 — Refresh scheduler

**Files:**
- Create: `src/lib/worker/queues/oauth-refresh.ts`
- Create: `src/lib/worker/processors/oauth-refresh.ts`
- Modify: `src/lib/worker/index.ts`

- [ ] Queue `oauth-refresh` com repeat `cron: '*/5 * * * *'`. Idempotente: `jobId = 'oauth-refresh-recurring'`.
- [ ] Processor: busca mailboxes com `accessTokenExpAt < now + 10*60*1000`; para gmail usa `oauth2Client.refreshAccessToken()`; para outlook usa MSAL. Se falha 3x (contador em Redis), set `isActive=false` + Notification.
- [ ] Boot: adiciona queue + job no worker.
- [ ] Commit `feat(crm): oauth refresh scheduler (Fase 7b T4)`.

### T5 — UI `/settings/mailboxes`

**Files:**
- Create: `src/app/(protected)/settings/mailboxes/page.tsx`
- Create: `src/app/(protected)/settings/mailboxes/_components/mailboxes-content.tsx`
- Create: `src/app/(protected)/settings/mailboxes/_components/imap-form-dialog.tsx`

- [ ] Página server com guard `email:view`. Checa `process.env.GOOGLE_OAUTH_CLIENT_ID` + `MS_OAUTH_CLIENT_ID` para passar flags `canConnectGoogle/canConnectOutlook`.
- [ ] Client: Table lista mailboxes (provider icon, emailAddress, primary badge, last refreshed). Dropdown "Conectar" com 3 opções. Ações setPrimary/disconnect via startTransition.
- [ ] IMAP dialog: fields + client calls `connectImapSmtpAction`.
- [ ] Commit `feat(crm): /settings/mailboxes UI (Fase 7b T5)`.

### T6 — i18n + memory + tag

- [ ] Pack `mailboxes.json` br/us.
- [ ] Memory `email_oauth_flow.md` (state CSRF, scopes, refresh cadence).
- [ ] Roadmap Appendix A 3 linhas (OAuth gmail, OAuth outlook, IMAP connect).
- [ ] Tag `phase-7b-deployed` — **só** após Google/MS secrets configurados em staging e fluxo testado end-to-end manual.

---

## Bloqueadores pré-tag

- OAuth secrets em Portainer (Google + MS).
- Domínio público com HTTPS válido para callbacks.
- Sem esses, parar em T5 com endpoints respondendo 503 dry-run; marcar Appendix A como `partial`.
