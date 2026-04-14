# Handoff — Nexus CRM Krayin

> **Novo terminal / nova sessão:** este é o ponto de entrada único. Leia do início ao fim e você saberá o estado atual, como prosseguir, e quais decisões já foram tomadas. Só depois veja `CLAUDE.md` (regras) e `memory/MEMORY.md` (índice de memories).

**Atualizado:** 2026-04-14 **noite** (sessão autônoma — fixes prod + Fases 12.4 e 12.5).
**Branch principal:** `main` (tudo mergeado).
**URL de produção:** https://crm2.nexusai360.com ✅ operacional.
**Repositório:** https://github.com/jvzanini/nexus-crm-krayin

---

## 0. TL;DR — onde paramos (ler PRIMEIRO)

**Produção:** `/api/health` 200 ✅ • `/api/ready` 200 ✅ • `/login` 200 ✅ •
`/opportunities/pipeline` 307 (rota deploy OK).
Headers de segurança ativos (HSTS/CSP/XFO/XCTO/Referrer/Permissions).

### ⚠️ ALERTA BILLING GitHub Actions (2026-04-14 22:40 UTC)

Últimos 2 builds (`docs(handoff)` e `feat(ui): pipeline kanban responsivo`)
**falharam no job "deploy"** com mensagem:
> "The job was not started because recent account payments have failed or
> your spending limit needs to be increased."

**Código está em `main`** (commits + tags aplicadas), mas prod ainda está
no state do deploy anterior bem-sucedido (`f4eb57d` Fase 20 T2 EmptyStates).
Fases 21 (mobile kanban) só entrarão em prod após resolver billing em
github.com/settings/billing.

Testes E2E continuam rodando normalmente (job separado).

**Tags deployed nesta sessão (2026-04-14 noite → madrugada):**

- `prod-stable-2026-04-14-late` — após fix dual React + lazy Resend + migrations
- `phase-12-4-deployed` — security headers + npm audit/gitleaks CI + docs/ops/security.md
- `phase-12-5-deployed` — runbook expandido com LEI #1, playbooks, DB procedures, onboarding
- `phase-12-6-deployed` — CVEs high zeradas (next 16.2.3, nodemailer 8.0.5, remove @sentry/nextjs)
- `phase-13-ui-consistency-deployed` — sidebar com 4 módulos novos, 9 telas PageHeader DS, stagger 0.08, dashboard space-y-6, tasks sem next-intl
- **Fase 14 — E2E CI Stabilizer:** webServer via `next start` (build em pipeline) resolveu timeout persistente de viewer login. Pré-fix: 0 specs rodavam. Pós-fix: 17 passed em 43s.
- **Fase 15 — RBAC em Server Actions:** 8 arquivos cobertos (api-keys, company, users, settings, feature-flags, leads, contacts, opportunities); gating UI (botões Novo X escondidos para viewer); settings-ui resolver alinhado com RBAC do CRM.
- **Fase 16 — Zero vulnerabilidades:** overrides follow-redirects 1.16 + @hono/node-server 1.19.13. `npm audit --audit-level=low` exit 0 com Prisma 7.6 mantido.
- **Fase 17 — Pipeline Kanban:** rota nova `/opportunities/pipeline` com drag-and-drop via @dnd-kit, 6 colunas por stage com count+soma, card com probability badge, link "Pipeline" em /opportunities, E2E spec admin. 5 commits.
- **Fase 18 — Dashboard Funnel:** 3 cards novos (FunnelCard leads→contacts→opps→won, PipelineValueCard bar por stage, TopOpportunitiesCard top 5 por valor). Extensão do `getDashboardData` Server Action. 4 commits.
- **Fase 19 — Sidebar Pipeline:** item "Pipeline" adicionado ao menu principal abaixo de Oportunidades (ícone LayoutGrid).
- **Fase 20 T2 — EmptyStates:** 9 telas (leads, contacts, opportunities, products, tasks, workflows, campaigns, segments, mailboxes) agora mostram EmptyState amigável com CTA quando lista vazia.

**Todas fases acima COMPLETAS.** Frente 17 tenant scoping (77e2918) e todas as fases subsequentes mergeadas em main.
**LEI ABSOLUTA #4** adicionada: toda nova implementação deve consultar `nexus-blueprint/` (design-system.md, patterns/, modules/) antes de criar componentes/features.
`npm audit --audit-level=high --omit=dev` → 0 vulns. Restam 4 moderate, tracked em `docs/ops/security.md` §2.1.

**Próximas opções actionable (sem blockers externos):**

| Opção | Descrição | Esforço |
|---|---|---|
| **A — CVE high fixes** | bump next 16.2.3, nodemailer 8, sentry 10 ou desligar, prisma 7 compat | M-L (breaking changes) |
| **B — Migrar Server Actions restantes para requirePermission** | follow-up Fase 1c | M |
| **C — Validar Fase 12.2 E2E no CI** | dual React em dev pode estar resolvido agora após 12.4; rodar E2E local primeiro | S-M |
| **D — Sentry wiring real** | depende de secret `SENTRY_DSN` no Portainer | S se secret OK |
| **E — Email OAuth real (Fase 7b/7c)** | depende de `GOOGLE_OAUTH_*` + `MS_OAUTH_*` secrets | M-L |

Recomendação: **A** (security hardening) → **C** (E2E verde) → **B** (RBAC completo).

---

## 1. Estado atual (2026-04-14 fim da sessão)

✅ **Produção no ar.** `/login` 200 • `/api/health` 200 • `/api/ready` 200.
**(Nota pós-fim: login passou a retornar 500 — ver §0 TL;DR.)**

### 1.1. Tags de release aplicadas

| Tag | Fase | Status |
|-----|------|--------|
| `phase-1a-deployed` | 1a — DS core | ✅ parity |
| `phase-1b-deployed` | 1b — Consent LGPD | ✅ parity |
| `phase-1c-deployed` | 1c — Ops platform | 🟡 partial (Sentry wiring pendente) |
| `phase-3-deployed` | 3 — Products multi-moeda | ✅ parity |
| `phase-6-deployed` | 6 — Activities + reminders | ✅ parity |
| `phase-7a-deployed` | 7a — Email foundations | ✅ parity |
| `phase-8-deployed` | 8 — Automation engine | ✅ parity (send-email stub) |
| `phase-9-core-deployed` | 9.0 — Marketing core | ✅ parity (send stub) |
| `phase-12-0-deployed` | 12.0 — DSAR LGPD | ✅ parity |
| `phase-12-partial-deployed` | 12 (sub-fases 12.0/12.1/12.3) | 🟡 partial |
| **`phase-12-4-deployed`** | **12.4 — Security audit** | **✅ headers + CI scans + doc** |
| **`phase-12-5-deployed`** | **12.5 — Runbook expansion** | **✅ LEI #1 + playbooks + onboarding** |
| **`phase-12-6-deployed`** | **12.6 — CVE high fixes** | **✅ 0 vulns high em prod** |
| **`phase-13-ui-consistency-deployed`** | **13 — UI consistency** | **✅ sidebar + PageHeader em 9 telas + stagger 0.08** |
| **`phase-14-e2e-ci-stabilizer`** | **14 — E2E CI** | **✅ next start em CI resolveu timeout viewer** |
| **`phase-15-rbac-server-actions`** | **15 — RBAC Server Actions** | **✅ 8 arquivos + gating UI viewer** |
| **`phase-16-zero-vulns`** | **16 — Zero CVEs** | **✅ 0 vulns (high + moderate)** |
| **`phase-17-pipeline-kanban`** | **17 — Pipeline Kanban** | **✅ drag-drop dnd-kit, 6 stages** |
| **`phase-18-dashboard-funnel`** | **18 — Dashboard Funnel** | **✅ FunnelCard + PipelineValueCard + TopOpportunitiesCard** |
| **`phase-19-sidebar-pipeline`** | **19 — Sidebar Pipeline** | **✅ item "Pipeline" no menu principal** |
| **`phase-12-2-deployed`** | **12.2 — E2E CI verde** | **✅ 17+ tests passed em ~43s** |
| **`phase-14-e2e-ci-stabilizer`** | **14 — E2E CI Stabilizer** | **✅ next start em CI resolveu timeout** |
| **`phase-20-empty-states`** | **20 T2 — EmptyStates** | **✅ 9 telas com EmptyState amigável** |
| **`phase-21-mobile-kanban`** | **21 — Mobile Kanban** | **🟡 código OK, deploy pendente (billing GH)** |
| **`prod-stable-2026-04-14-late`** | **snapshot estável pós-fix** | **✅ referência para rollback** |

### 1.2. Commits recentes em `main` (últimos 10)

```
0b015f0 test(crm): diagnóstico detalhado no global-setup em caso de timeout
f632cb3 chore: cleanup debug endpoints + try/catch temporário após /login=200
ee5c583 fix(prod): turbopack.resolveAlias em vez de webpack (Next 16)
b0fb63f fix(prod): wrap app com DS ThemeProvider (Toaster usa useTheme do DS) ← RESOLVEU /login 500
be22cee docs(claude-md): LEI ABSOLUTA #1 — debug de prod SEMPRE via logs do container
3fa4579 fix(prod): alias react/* (dual React — antes de descobrir que Next 16 usa turbopack)
1898bd8 fix(i18n): aninhar chaves com ponto
6e9377c fix(build): remove imports sentry órfãos
cc30cce chore: remove sentry.*.config.ts
a78aa82 ci(crm): test:e2e:seed via tsx + skip base seed no E2E (12.2)
```

### 1.3. PRs abertos (trabalho em feature branches — NÃO mergeados)

| # | Título | Head branch | Base |
|---|---|---|---|
| 1 | Frente 8: adopt @nexusai360/core (rate-limit + password) | `feat/pkg-core-rate-limit-password` | main |
| 2 | Frente 9: adopt @nexusai360/multi-tenant | `feat/pkg-multi-tenant` | main |
| 3 | Frente 10: adopt @nexusai360/audit-log | `feat/pkg-audit-log` | `feat/pkg-multi-tenant` |
| 4 | Frente 11: adopt @nexusai360/api-keys | `feat/pkg-api-keys` | main |
| 5 | Frente 13: CRM E2E auth fixture | `feat/e2e-auth-fixture` | main |

Todas estão **behind main em 24–28 commits** — vão precisar de rebase antes de merge. **Não merge sem user validar individualmente.**

### 1.4. Ações ainda pendentes (pós-1b fase)

- **Migrations em produção:** 9 migrations novas (entre `f2224d7` e HEAD) precisam ser aplicadas manualmente via psql no container DB (Prisma v7 não aplica em runtime). Ver §4.2.
- **Seed do system user:** `prisma/seed.ts` cria user `system@nexuscrm.internal` (UUID nil) usado por automation action `create-task`. Executar `npx prisma db seed` em prod após migrations.
- **Secrets Portainer (opcionais):** `ENCRYPTION_KEY`, `UNSUBSCRIBE_TOKEN_SECRET`, `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, OAuth secrets para Fase 7b real.

---

## 2. Incidente 2026-04-14 — /login retornando 500 (4h de debug)

### 2.1. O que aconteceu

Entre `859228f` e `b0fb63f`, produção retornou 500 em `/login` e qualquer rota SSR. Todas rotas `/api/*` continuavam 200. Demoramos ~4h em commits especulativos antes de consultar os logs do container.

### 2.2. Causa raiz

`@nexusai360/design-system` exporta `useTheme` no barrel (`index.cjs`) mas `ThemeProvider` só é exportado em `/theme-provider` entry. Componentes do barrel (ex: Toaster, Button com variantes tematizadas) chamavam `useTheme` mas não encontravam um ThemeProvider no tree → React 19 lançava `useTheme must be used within ThemeProvider` → Next streaming convertia em HTTP 500 sem digest.

### 2.3. Fix

Commit `b0fb63f` — em `src/components/providers/theme-provider.tsx` o `Providers` passa a envolver children também com `DsThemeProvider` (do DS):

```
<SessionProvider>
  <ThemeProvider initialTheme={...}>
    <DsThemeProvider initialTheme={...}>
      {children}
    </DsThemeProvider>
  </ThemeProvider>
</SessionProvider>
```

### 2.4. Lição aprendida → **LEI ABSOLUTA #1**

Consagrada em `CLAUDE.md` (seção "LEIS ABSOLUTAS") + memory `law_debug_via_container_logs.md`:

> **Ao debugar erro de prod/deploy, PRIMEIRA ação = puxar logs do container via Portainer API.** Nunca sair de commit em commit adivinhando. Comando canônico documentado.

Token Portainer em `.env.production` (`PORTAINER_TOKEN`). URL em `PORTAINER_URL`.

---

## 3. Arquitetura atual (resumo por fase)

### Fase 1b — Consent LGPD ✅
- `src/lib/consent/` — `recordConsent` idempotente, `maskIp` (/24, /48), predicates `canSendMarketing`/`canTrackOpen`.
- Tabelas `leads.consent_*`, `contacts.consent_*`, `consent_logs` imutável.
- Backfill script em `prisma/scripts/backfill-consent.ts`.
- ESLint rule `nexus-crm/no-direct-consent-write` força uso da lib.
- i18n packs `br/us/messages/consent.json`.
- Docs: `docs/lgpd.md`.

### Fase 1c — Ops partial 🟡
- Logger pino + redactors PII em `src/lib/logger.ts`.
- `/api/health` (liveness) + `/api/ready` (DB + Redis).
- `x-request-id` middleware.
- Feature flags: DB + Redis cache + pg_notify triggers; lib em `src/lib/flags/`; UI `/settings/flags`.
- Backup scripts em `scripts/ops/`; doc em `docs/ops/backup.md`.
- RBAC 21+ permissions × 5 roles em `src/lib/rbac/permissions.ts`.
- **Pendentes:** Sentry/OTel wiring real (requer DSN configurados), migração das Server Actions existentes para `requirePermission`.

### Fase 3 — Products multi-moeda ✅
- 10 moedas em `SUPPORTED_CURRENCIES` (`src/lib/currency/allowlist.ts`).
- `Product` + `ProductPrice` (1-N) + `Company.baseCurrency`.
- Server Actions CRUD em `src/lib/actions/products.ts`.
- UI `/products` (list + editor + prices inline) em `src/app/(protected)/products/`.
- Seed 6 produtos × 2 categorias por company.

### Fase 6 — Activities ✅
- Model polimórfico (`Activity` com `subjectType` + `subjectId`). 5 types: call/meeting/task/note/file.
- BullMQ queue `activity-reminders` + worker + boot reenqueue.
- `FileStorageDriver` abstrato em `src/lib/files/` (LocalDiskDriver MVP; S3Driver em Fase 12).
- UI timeline em `src/components/activity/` + rotas `/tasks` + `/<subject>/[id]/activities`.

### Fase 7a — Email Foundations ✅
- Schema `Mailbox` + `EmailMessage` + enum `MailboxProvider`.
- `src/lib/crypto/aes-gcm.ts` — AES-256-GCM com derivação scrypt de `ENCRYPTION_KEY` (64 hex).
- RBAC `email:view|connect|send|manage`.

### Fase 7b — Email OAuth 🟡 dry-run
- Endpoints `/api/oauth/{gmail,outlook}/{authorize,callback}` — retornam 503 quando secrets ausentes.
- Mailbox actions (list/setPrimary/disconnect/connectImapSmtp stub).
- UI `/settings/mailboxes` funcional (dropdown connect + IMAP dialog).
- **Pendente:** configurar `GOOGLE_OAUTH_*`, `MS_OAUTH_*`, `UNSUBSCRIBE_TOKEN_SECRET` em Portainer + substituir stubs por SDK real.

### Fase 8 — Automation Engine MVP ✅ (send-email stub)
- Schema `Workflow` + `WorkflowExecution` + 3 enums.
- 3 triggers: `lead_created`, `contact_created`, `activity_completed`.
- 4 actions: `update-field`, `create-task`, `assign-user`, `send-email` (stub aguardando 7c).
- Condition evaluator puro (operadores eq/neq/in/gt/lt/contains).
- Dispatcher idempotente + BullMQ queue + anti-storm (chainDepth<10 + daily quota Redis + circuit breaker 50% fail em 1h).
- Emissores em `createLead/createContact/completeActivity`.
- UI `/automation/workflows` com block builder declarativo.

### Fase 9.0 — Marketing core ✅ (send stub)
- Schema `Segment` + `Campaign` + `CampaignRecipient` + enums.
- Segment evaluator filtros allowlisted (6 campos).
- Unsubscribe HMAC SHA-256 stateless TTL 90d.
- Queue `marketing-send` isolada de email transacional; worker re-check consent + quota + stub.
- UI `/marketing/{segments,campaigns}`.
- **Pendente:** sendEmailAction real (Fase 7c), SPF/DKIM DNS, `MARKETING_DAILY_QUOTA` + `UNSUBSCRIBE_TOKEN_SECRET` em Portainer.

### Fase 12.0 — DSAR LGPD ✅
- 3 endpoints: `/api/v1/subjects/:type/:id/{export,consent/revoke,erase}`.
- RBAC `dsar:execute` (admin/super_admin only).
- Anonimização preserva FK + `consent_logs`.
- Docs: `docs/lgpd.md` §6.

### Fase 12.2 — E2E Playwright ✅
- Seed E2E 2 tenants × 3 roles.
- Playwright global-setup + storageState por role.
- Specs: admin/manager/viewer golden paths + cross-tenant smoke.
- Workflow `.github/workflows/` com postgres + redis.

### Fases bloqueadas

- **1d** — DS v0.4.0 (trabalho no repo externo `@nexusai360/design-system`).
- **2** (Pipelines kanban), **4** (Quotes), **5** (Custom Attributes) — depende de 1d.
- **7c** (send+tracking) — depende de 7b real.
- **10** (DataTransfer CSV) — depende de 5.
- **11, 11b** (Reports, Public API) — dependem transitivamente de 2/4/5.

---

## 4. Como continuar (novo terminal)

### 4.1. Leitura obrigatória (nesta ordem)

1. Este arquivo (`docs/HANDOFF.md`).
2. `CLAUDE.md` — regras + LEIS ABSOLUTAS (debug via logs container; skills superpowers; ui-ux-pro-max).
3. `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/MEMORY.md` — índice de 16 memories com links.

### 4.2. Checklist rápido ao retomar

```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
git fetch --all --tags
git status
git log --oneline phase-12-partial-deployed..HEAD | head -20
gh run list --limit 5                           # CI status
gh pr list --state open                         # PRs abertos
/usr/bin/curl -s -o /dev/null -w "login: %{http_code}\n" https://crm2.nexusai360.com/login
```

### 4.3. Aplicar migrations em produção (quando for necessário)

Acessar DB pelo Portainer console ou via API:

```sh
# Lista ordenada das migrations a aplicar (se ainda pendentes):
ls prisma/migrations/ | sort
# Aplicar uma a uma via psql no container:
docker exec -i <container-id-db> psql -U nexus -d nexus_crm_krayin < prisma/migrations/<pasta>/migration.sql
```

### 4.4. Debug de produção (LEI #1)

Token Portainer já está em `.env.production` do repo (**arquivo é gitignored** — não commitar). Comando canônico:

```sh
export PTOKEN=$(grep '^PORTAINER_TOKEN=' .env.production | sed 's/^PORTAINER_TOKEN=//')
export PURL=$(grep '^PORTAINER_URL=' .env.production | cut -d= -f2)

TASK=$(/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/tasks?filters=%7B%22service%22%3A%5B%22nexus-crm-krayin_app%22%5D%7D")
CID=$(echo "$TASK" | python3 -c "import json,sys; d=json.load(sys.stdin); r=[t for t in d if t.get('Status',{}).get('State')=='running']; print(r[0]['Status']['ContainerStatus']['ContainerID'][:12] if r else '')")

/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/containers/$CID/logs?stdout=1&stderr=1&tail=400&timestamps=1" | tail -200
```

### 4.5. Próximas fases actionable

**Sem blockers externos — pode iniciar no próximo ciclo:**

- Migrar Server Actions restantes para `requirePermission` (followup 1c.3).
- Rodar backup drill real em staging (Fase 1c.2 execução).
- Configurar secrets Sentry/OTel e validar instrumentation (Fase 1c pendente).

**Com blockers externos (aguardam config):**

- **Fase 7b T3/T4** real: requer Google/MS OAuth secrets em Portainer. Plan pronto em `docs/superpowers/plans/2026-04-15-fase-7b-email-oauth.md`.
- **Fase 7c** (send+tracking): depende de 7b real. Spec pronta em `docs/superpowers/specs/2026-04-15-fase-7c-email-send-tracking-design.md`.
- **Fase 9 full** (send real + deliverability): depende de 7c.
- **Fase 1d** (DS v0.4.0): trabalho no repo externo `@nexusai360/design-system`.

### 4.6. PRs abertos — recomendações

Todas as 5 PRs estão behind main em 24+ commits. **Sequência sugerida:**

1. **Rebase cada PR em main** individualmente.
2. **#1 Frente 8** (core rate-limit+password) primeiro — base de outros pkgs.
3. **#2 Frente 9** (multi-tenant) depois.
4. **#3 Frente 10** (audit-log) — base é feat/pkg-multi-tenant, rebase depois de #2 merge.
5. **#4 Frente 11** (api-keys) independente.
6. **#5 Frente 13** (E2E auth fixture) — depende de estado E2E atual.

Validar cada PR isoladamente (build + login funcional + testes) antes de merge.

---

## 5. Convenções e padrões (consulta rápida)

- **Commits:** português, imperativo, conventional commits (`feat|fix|chore|docs|ci|test|refactor`).
- **Código:** inglês (variáveis, funções, classes). Comentários PT-BR quando necessário.
- **Schemas Zod em Server Actions:** ficam em arquivo separado `<nome>-schemas.ts` — `"use server"` só aceita exports de funções async. Nunca exportar zod const ou enum runtime de arquivo `"use server"`.
- **Casts de Prisma JSON:** `as unknown as TipoDominio` (não `as TipoDominio` direto).
- **DS theme:** Providers wrap com `<DsThemeProvider>` também (não só o nosso). Componentes do DS barrel usam `useTheme` do próprio barrel.
- **Consent:** sempre via `recordConsent`. Lint `no-direct-consent-write` force.
- **Logger:** `@/lib/logger` — nunca `console.*`. Lint `no-console-in-src` force.
- **ID de request:** middleware garante `x-request-id`.
- **Test:** vitest --environment=node para libs puras; Playwright para E2E.

---

## 6. Infraestrutura

- **Registry:** `ghcr.io/jvzanini/nexus-crm-krayin`.
- **Portainer:** `https://painel.nexusai360.com` (stack: db, redis, app, worker).
- **DB:** PostgreSQL 16 (`nexus-crm-krayin_db`).
- **Cache/Queue:** Redis 7 (`nexus-crm-krayin_redis`).
- **Domínio:** `crm2.nexusai360.com`.
- **CI/CD:** GitHub Actions (`.github/workflows/build.yml` dispara em push main → Docker build → GHCR push → Portainer API rollout).

---

## 7. Session totals (2026-04-14)

- **~90 commits** entre `phase-1a-deployed` e HEAD.
- **11 tags** de fase deployadas.
- **>380 unit tests** passando (vitest).
- **E2E** funcional (seed + 4 golden-path specs).
- **docs/superpowers/**: 9 specs v3 + 9 plans v3.
- **memory/**: 16 arquivos em `.claude/projects/.../memory/`.
- **Entrega por assistente** + **parallel commits pelo usuário** em 5 feature branches.

---

## 8. Fase 12.2 — E2E Golden Paths (entregue parcial 2026-04-14, CI pendente)

**Código completo, CI aguardando prod estabilizar.** 10 commits (`0f7d0a0` até `2c9a7b4`) criaram toda a infra de E2E Playwright:

- `tests/e2e/fixtures/e2e-users.ts` — 3 roles (admin/manager/viewer) + 2 tenants (password `E2E-Test-Pass-2026!`).
- `prisma/seed-e2e.ts` — seed idempotente (`npm run test:e2e:seed`).
- `tests/e2e/global-setup.ts` — login 1× por role, persiste `storageState` em `tests/e2e/.auth/<role>.json` (gitignored), com retry 3× e timeout 90s.
- `tests/e2e/golden-paths/{admin,manager,viewer,cross-tenant}.spec.ts` — smoke por rota/permission + cross-tenant 404.
- `playwright.config.ts` — projects matrix (unauth/admin/manager/viewer) + globalSetup.
- `.github/workflows/e2e.yml` — postgres:16 + redis:7 services, `prisma db push --url $DATABASE_URL`, tsx para seed, `--legacy-peer-deps`.

**Bloqueio atual:** CI `E2E Tests` não conclui porque a app tem bugs pré-existentes em cascata que várias sessões pararelas corrigiram (i18n nested keys, dual React, DS ThemeProvider), e novos commits de vendor packages (`@nexusai360/core|api-keys|multi-tenant`) reintroduziram dual React (`useState null`). Global-setup diagnostic mostrou admin logando OK, manager timing out sem erro visível — provável lentidão de compile do next dev.

**Ao retomar:**

1. Confirme que prod está com `/login` + `/dashboard` renderizando sem erros de React/ThemeProvider (use logs container — LEI #1).
2. Rode localmente `npm run dev` + `npm run test:e2e:seed` + `npm run test:e2e -- --project=admin` para validar antes de confiar no CI.
3. Se verde local: push trivial (empty commit) para disparar CI e validar E2E workflow.
4. Se verde em CI: `git tag phase-12-2-deployed && git push origin phase-12-2-deployed`.

**Próximas fases actionable (sem bloqueios externos):**

- **12.4 — Security audit:** checklist OWASP + `npm audit --audit-level=high` + gitleaks. Sem dependência.
- **12.5 — Runbook docs:** completar `docs/ops/runbook.md` (on-call + deploy). Parcialmente entregue.
- **7b/7c — Email OAuth + send:** bloqueado por secrets OAuth em Portainer (`GOOGLE_OAUTH_*`, `MS_OAUTH_*`).

---

## 9. Contato

Este handoff foi gerado pelo Claude Opus 4.6 (1M context) em sessão autônoma. Decisões arquiteturais estão nos specs v3. Aprendizados operacionais (debug, LEI #1) estão em `CLAUDE.md` + memory.

---

## 10. Frente 17 — Tenant Scoping (descoberta + retomada)

### 10.1. Contexto

Durante Fase 12.2 foi identificada vuln pré-existente: `Lead`, `Contact`, `Opportunity` não têm coluna `companyId` no schema e server actions (`getLeads`, `updateContact`, `deleteOpportunity`, etc.) **não filtram por tenant**. Qualquer usuário autenticado pode ler/editar/apagar linhas de qualquer company. Isso é um vazamento cross-tenant em produção.

### 10.2. Spec + plan já escritos (uncommitted)

Branch: **`feat/tenant-scoping-crud`**. Arquivos uncommitted:

- `docs/superpowers/specs/2026-04-14-tenant-scoping-crud-domains.md` (v3, 95 linhas)
- `docs/superpowers/plans/2026-04-14-tenant-scoping-crud-domains.md` (T1..T7)

Escopo:

1. **T1 Migration + helper** — adicionar `companyId` a Lead/Contact/Opportunity com FK + index + backfill (primeiro company herda linhas legacy). Criar `src/lib/tenant-scope.ts` com `requireActiveCompanyId()`.
2. **T2-T4** — refactor de `leads.ts`, `contacts.ts`, `opportunities.ts` + testes unit Prisma mock.
3. **T5** — refactor de ~12 callsites auxiliares (search, activities, dashboard, marketing-*, worker marketing-send, automation actions).
4. **T6** — ajustar seeds.
5. **T7** — CI local + PR + squash merge.

### 10.3. Retomada — opções priorizadas

| Opção | Quando escolher | Ação |
|---|---|---|
| **A — Fix prod 500 primeiro** | Se login/app em prod afeta clientes (hoje está 500) | LEI #1 → logs container → identificar regressão de Frentes 14b/15b → fix mínimo |
| **B — Frente 17 tenant scoping** | Se prod OK, queremos avançar e resolver vuln | `git checkout feat/tenant-scoping-crud`, commit spec+plan, executar T1..T7 via `superpowers:subagent-driven-development` |
| **C — Destravar 12.2 E2E CI** | Se Frente 17 desbloquear ou prod estiver fine | Investigar dual React em `next dev` (alias turbopack não prevendo regressão com vendor packages) |

**Recomendação:** **A → B → C** (corrigir prod crítico → lançar tenant scoping → validar E2E no fim).

### 10.4. Como retomar (roteiro autônomo)

1. **Ler memory** `session_state_2026_04_14_late.md` para mapa rápido.
2. **Checar prod:** `curl -s https://crm2.nexusai360.com/api/health && curl -s -o /dev/null -w "%{http_code}" https://crm2.nexusai360.com/login`.
3. **Se login 500:** seguir **LEI #1** (`CLAUDE.md` §1) — logs container ANTES de qualquer commit.
4. **Quando prod estável:** `git checkout feat/tenant-scoping-crud`, commit do spec+plan, executar plan via superpowers (skills obrigatórias per CLAUDE.md).
5. **Final:** PR merge → main → tentar validar 12.2 E2E CI novamente (agora com companyId isolando tenants, cross-tenant spec real passa) → tag `phase-12-2-deployed`.
