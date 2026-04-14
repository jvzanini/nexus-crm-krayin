# Handoff — Sessão 2026-04-14

> **Para continuar em outro terminal:** leia este arquivo do início ao fim, depois `CLAUDE.md`, depois `memory/MEMORY.md`. Todos os contextos importantes estão em um desses três lugares.

**Commit de referência do handoff:** `b0fb63f` (fix wrap app com DS ThemeProvider — resolveu o /login 500).

**Status do deploy no momento do handoff:** ✅ **PRODUÇÃO NO AR.** `/login` = 200, `/api/health` = 200, `/api/ready` = 200. Valida em `https://crm2.nexusai360.com/login`.

## Causa raiz do 500 que derrubou prod (resolvido)

`@nexusai360/design-system` exporta `useTheme` mas o barrel `index.cjs` não exporta `ThemeProvider` (ele fica em `/theme-provider` entry). Nosso layout usava apenas `useTheme` do barrel sem envolver com `ThemeProvider` correspondente → `useTheme must be used within ThemeProvider`.

**Fix (`b0fb63f`):** wrap com DS `ThemeProvider` explicitamente no layout em adição ao nosso custom theme provider.

**Debug hard-learned:** a primeira coisa em qualquer erro de prod = **puxar logs do container via Portainer API** (token em `.env.production`). Sem isso, perdemos ~4h em commits especulativos. Está registrado em `CLAUDE.md` LEI ABSOLUTA #1 + memory `law_debug_via_container_logs.md`.

---

## 1. Contexto imediato

### 1.1. Sintoma relatado
`crm2.nexusai360.com` retornando "This page couldn't load" (pantalla preta).

### 1.2. Causa raiz
Todos os ~50 pushes anteriores a `859228f` falharam no CI com erro de build do Next 16 (turbopack):

> `Error: Turbopack build failed with 29 errors: ... Export cancelActivity doesn't exist in target module ... The module has no exports at all.`

Diretiva `"use server"` do Next 16 **só aceita exports de funções async**. Arquivos `src/lib/actions/activities.ts` e `src/lib/actions/mailboxes.ts` tinham re-exports de runtime (enums Prisma + const de Zod schemas), o que fez o turbopack rejeitar o módulo inteiro — cascata de "Cannot find export" em todos os componentes dependentes (activity-timeline, activity-form, tasks-content, páginas `/leads/[id]/activities` etc.).

Produção continuava servindo a última imagem válida (`f2224d7` — "Toaster via client wrapper"), porém o Portainer rollout para a nova tag falhou e o DNS apontou para container parado/zombie → erro de browser "couldn't load".

### 1.3. Fix aplicado (commit `859228f`)
- `src/lib/actions/activities.ts`:
  - Linha 17: `export { ActivityType, ActivityStatus, ActivitySubjectType }` → `export type { ... }` (type-only, erased runtime).
  - Linha 140: `export { _schemas, createActivitySchema, updateActivitySchema } from "./activities-schemas"` → **removido**. Consumidores importam direto de `./activities-schemas`.
- `src/lib/actions/mailboxes.ts`:
  - `export const connectImapSmtpSchema = z.object(...)` → extraído para `src/lib/actions/mailboxes-schemas.ts` (novo arquivo).
  - Teste `mailboxes.test.ts` atualizado para importar do novo local.
- **Auditoria dos outros `"use server"`:** workflows/products/feature-flags/marketing-*/leads/contacts etc. OK — só exportam funções async + interfaces (type-only).

### 1.4. O que fazer agora
1. Aguarde o build CI do `859228f` (aprox. 5-7 min). Comando: `gh run list --limit 1 --json status,conclusion,headSha`.
2. Quando `conclusion: success`, Portainer faz rollout automático (se token configurado) ou rodar manualmente.
3. Acesse `https://crm2.nexusai360.com/api/health` — deve retornar 200 `{status:"ok"}`.
4. Acesse `https://crm2.nexusai360.com/api/ready` — deve retornar 200 com `db:"fulfilled"`, `redis:"fulfilled"`.
5. Login via `/login` deve funcionar.

**Se o build falhar novamente:** rode `gh run view <databaseId> --log-failed | grep -iE "error|fail" | head -30` e investigue o novo erro — provavelmente outro arquivo com mesma classe de problema que escapou da auditoria.

### 1.5. Migrations pendentes em produção
Entre a última imagem deployada (`f2224d7`) e o fix atual há **10 migrations novas** que **precisam ser aplicadas manualmente** via psql no container db (Prisma v7 não aplica em runtime):

```sh
# Em ordem (ordem cronológica):
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260415000000_add_consent_to_leads_contacts_and_consent_logs/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260416000000_feature_flags/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260417000000_products/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260418000000_activities/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260419000000_email_foundations/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260420000000_notification_activity_reminder/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260422000000_automation/migration.sql
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin < prisma/migrations/20260423000000_marketing/migration.sql
```

Existem `down.sql` em cada pasta para rollback.

**Seed atualizado:** `prisma/seed.ts` agora garante o `system user` (UUID nil `00000000-0000-0000-0000-000000000000`) necessário para `automation create-task` action. Executar: `npx prisma db seed` (após migrations).

### 1.6. Secrets que precisam ser configurados em Portainer
Adicionados em `.env.example` mas ainda não settados em produção. Impacto se ausentes:

| Env | Impacto se ausente | Prioridade |
|-----|-------------------|-----------|
| `ENCRYPTION_KEY` (64 hex) | Qualquer encrypt/decrypt (tokens OAuth/IMAP) lança. Login funciona. | **Alta** antes de Fase 7b |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI` | `/api/oauth/gmail/*` retornam 503 dry-run. App funciona. | Média (Fase 7b real) |
| `MS_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI` | Idem outlook. | Média |
| `UNSUBSCRIBE_TOKEN_SECRET` (≥32 chars) | Marketing queue processor lança ao tentar sign. | Alta antes de Fase 9 send real |
| `MARKETING_DAILY_QUOTA` | Default 5000. | Baixa |
| `SENTRY_DSN` | SDK no-op. | Baixa |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | SDK no-op. | Baixa |
| `BACKUP_S3_BUCKET`, `BACKUP_AGE_RECIPIENT`, `AWS_*` | Cron backup não funciona. | Alta antes de 12.3 full |
| `FILE_STORAGE_ROOT` | Default `./.storage/files`. OK default em container. | Baixa |

---

## 2. Resumo do que foi entregue nesta sessão

**76 commits** empurrados desde `phase-1b-deployed`. **11 tags** de release aplicadas:

| Tag | Fase | Status | O que inclui |
|-----|------|--------|--------------|
| `phase-1b-deployed` | 1b | ✅ parity | Consent LGPD: migration + lib recordConsent + zod + ConsentFieldset + i18n + backfill + docs/lgpd.md + ESLint no-direct-consent-write |
| `phase-1c-deployed` | 1c | 🟡 partial | Pino logger + /api/health + /api/ready + x-request-id + feature flags (DB+Redis+pg_notify) + RBAC 21 perms × 5 roles + backup scripts + Sentry/OTel config |
| `phase-3-deployed` | 3 | ✅ parity | Products & Catálogo multi-moeda — 10 currencies allowlist + CRUD + prices inline + i18n + seed 6×2 cat/company |
| `phase-6-deployed` | 6 | ✅ parity | Activities timeline polimórfica (5 types) + BullMQ reminders + FileStorageDriver local + RBAC + i18n |
| `phase-7a-deployed` | 7a | ✅ parity | Email Foundations — Mailbox + EmailMessage schema + AES-256-GCM crypto + RBAC email:* |
| — (sem tag) | 7b | 🟡 dry-run | OAuth endpoints 503 sem secrets + mailbox actions + /settings/mailboxes UI + IMAP stub |
| `phase-8-deployed` | 8 | ✅ parity (send stubado) | Automation MVP — 3 triggers + 4 actions + anti-storm + UI editor + emissores em leads/contacts/activities |
| `phase-9-core-deployed` | 9.0 | ✅ partial | Marketing — segments + campaigns + recipients + queue isolada + unsubscribe HMAC + UI; send via stub aguardando 7c |
| `phase-12-0-deployed` | 12.0 | ✅ parity | DSAR LGPD — 3 endpoints (export/revoke/erase) + RBAC dsar:execute + audit |
| `phase-12-partial-deployed` | 12 | 🟡 partial | Lighthouse CI + backup drill schedule + security checklist + runbook |

**316 tests passing** em 26 test files no último snapshot válido.

---

## 3. Onde parar e onde continuar

### 3.1. Ações imediatas (quando produção voltar)
1. ✅ Validar /api/health, /api/ready.
2. ✅ Aplicar 8 migrations manuais via psql (ver §1.5).
3. ✅ Rodar seed para garantir system user (ver §1.5).
4. Testar login + navegação básica (dashboard, leads, contacts, products).
5. Testar novas rotas: `/activities`, `/tasks`, `/automation/workflows`, `/marketing/segments`, `/marketing/campaigns`, `/settings/flags`, `/settings/mailboxes`.

### 3.2. Próxima fase actionable (depende de externos)
| Fase | Bloqueador | O que precisa |
|------|-----------|---------------|
| **7b real** | Secrets OAuth | `GOOGLE_OAUTH_*` e `MS_OAUTH_*` em Portainer; após isso, rodar plan `docs/superpowers/plans/2026-04-15-fase-7b-email-oauth.md` Tasks T1 (install deps) + T3 (endpoints reais) + T4 (refresh scheduler) |
| **7c (send+tracking)** | 7b real | Spec `docs/superpowers/specs/2026-04-15-fase-7c-email-send-tracking-design.md` — migration ActivityType.email + sendEmailAction + tracking pixel + EmailComposeDialog |
| **9 full** | 7c | Trocar `sendEmailStub` em `src/lib/worker/processors/marketing-send.ts` por chamada real. Criar `docs/ops/email-deliverability.md` runbook DNS. |
| **12.2 (E2E)** | — | Setup Playwright auth state + 5 specs por role + cross-tenant. 100% actionable. |

### 3.3. Fases bloqueadas por DS externo
**Fase 1d** (DS v0.4.0) é trabalho no repo `@nexusai360/design-system`, não aqui. Bloqueia:
- **Fase 2** (Pipelines kanban).
- **Fase 4** (Quotes — depende de 2, 3 ✅, 5).
- **Fase 5** (Custom Attributes — depende de 1d).

→ **Fase 10** (DataTransfer CSV) depende de 5 (blocked).
→ **Fase 11** (Reports) depende de 2/4/5/6 — 2/4/5 blocked.
→ **Fase 11b** (Public API + Webhooks) depende de 11.

### 3.4. Follow-ups pendentes de Fase 1c
- Migração das Server Actions existentes (users, company, opportunities, api-keys, notifications, password-reset, profile, search, settings) para `requirePermission` — lint `no-ad-hoc-role-check` está **warn** em 1c.3; pode promover a `error` quando todos os files migrados.
- UI `/settings/flags` já existe (commit `fc29a6c`); só precisa ser validada com app rodando.

### 3.5. Follow-ups pendentes de Fase 6
- `NotificationType` tem valor `activity_reminder` (commit `17da92c`) — sem PR follow-up.

---

## 4. Como reiniciar em outro terminal

### 4.1. Leia nesta ordem:
1. `docs/HANDOFF.md` (este arquivo).
2. `CLAUDE.md` (instruções globais do projeto).
3. `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/MEMORY.md` — índice de 14 memory files.
4. `docs/superpowers/specs/2026-04-14-roadmap-mestre-design.md` (Appendix A tem matriz parity).

### 4.2. Checklist ao retomar
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
git fetch --tags
git log --oneline phase-1b-deployed..HEAD | head -10   # ver últimos commits
gh run list --limit 5                                   # status CI
git tag --list | grep phase | sort                      # tags disponíveis
```

### 4.3. Skills superpowers que **devem** ser invocadas (user exigiu explicitamente):
Para qualquer trabalho novo (spec, plan, implementação):
- `superpowers:brainstorming` — antes de creative work.
- `superpowers:writing-plans` — para criar plans.
- `superpowers:subagent-driven-development` — para implementar plans (fresh subagent per task + 2-stage review).
- `superpowers:test-driven-development` — subagents invocam ao implementar.
- `superpowers:verification-before-completion` — antes de tag/merge.

Para UI/layout: `ui-ux-pro-max:ui-ux-pro-max` é mandatório (ver CLAUDE.md).

### 4.4. Modo autônomo
Usuário configurou esta sessão como **autônomo** ("Segue autônomo até eu dar um comando claro para sair desse modo"). Para retomar no mesmo modo: não pedir confirmação em cada passo; executar spec → plan → implementação em sequência.

### 4.5. Convenções específicas do projeto
- Commits em português, código em inglês.
- Trailer `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.
- Server Actions em `src/lib/actions/`.
- Schemas Zod usados em Server Actions **devem** ficar em arquivo separado `<nome>-schemas.ts` (não em arquivo `"use server"`). Exemplos: `activities-schemas.ts`, `workflows-schemas.ts`, `marketing-*-schemas.ts`, `mailboxes-schemas.ts`.
- Enums re-exportados de Prisma também: use `export type { ... }` (erased runtime) se consumers usam como tipo; caso contrário, consumers importam direto de `@/generated/prisma/enums`.
- Logger: sempre `@/lib/logger` — nunca `console.*` (lint rule `nexus-crm/no-console-in-src` é **error**).
- Consent: sempre via `recordConsent` — lint rule `nexus-crm/no-direct-consent-write` é **error**.

---

## 5. Links úteis

- **Repo:** https://github.com/jvzanini/nexus-crm-krayin
- **Produção:** https://crm2.nexusai360.com
- **GHCR:** ghcr.io/jvzanini/nexus-crm-krayin
- **CI workflows:** `.github/workflows/*.yml`
- **Portainer:** ver `docs/ops/runbook.md` §1.
- **Specs mestras:** `docs/superpowers/specs/2026-04-14-roadmap-mestre-design.md`.

---

## 6. Contato técnico

Este documento foi gerado pelo Claude Opus 4.6 (1M context) durante sessão autônoma orquestrada com skills superpowers. Toda a decisões de arquitetura estão documentadas nos specs v3 + memory files citados.
