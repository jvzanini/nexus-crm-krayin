# Handoff — Nexus CRM Krayin

> **Novo terminal / nova sessão:** este é o ponto de entrada único. Leia do início ao fim e você saberá o estado atual, como prosseguir, e quais decisões já foram tomadas. Só depois veja `CLAUDE.md` (regras) e `memory/MEMORY.md` (índice de memories).

**Atualizado:** 2026-04-15 **tarde** (Fase 5 Custom Attributes completa — 29 commits, 676/676 Vitest verde, deployed main).

> **Fase 5 — Custom Attributes (commits 05160c4..b400dfb):** JSONB custom por tenant em Lead/Contact/Opportunity. 8 tipos, 30 attrs/entity cap, 32KB/row cap, unique partial index shared via refcount, purge→drop→finalize chain BullMQ, RBAC `custom-attributes:view|manage`, feature flag `feature.custom_attributes` (OFF default), DSAR export/erase+logger respeitando `piiMasked`, settings UI + integração leads/contacts/opps + FilterBar extension + E2E spec (4 ativos + 3 skip). Testes 464→676 (+212). Docs em `docs/HANDOFF-FASE-5-VERIFICATION.md` + `docs/superpowers/{specs,plans}/2026-04-15-fase-5-custom-attributes-v3.md`.
**Branch principal:** `main` (tudo mergeado, sem branches ativas).
**URL de produção:** https://crm2.nexusai360.com ✅ operacional.
**Repositório:** https://github.com/jvzanini/nexus-crm-krayin ⭐ **PÚBLICO**
**CI/CD:** GitHub Actions ilimitado (repo público)

---

## 0. TL;DR — onde paramos (ler PRIMEIRO)

**Produção:** `/api/health` 200 ✅ • `/api/ready` 200 ✅ • `/login` 200 ✅ •
`/opportunities/pipeline` 307 (rota deploy OK).
Headers de segurança ativos (HSTS/CSP/XFO/XCTO/Referrer/Permissions).

### Repo agora PÚBLICO (resolvido billing GH Actions 2026-04-15)

Para evitar custo dos GitHub Actions minutes em repo privado, o repositório
foi tornado público. Vendor packages compilados em `vendor-packages/*.tgz`
ficam expostos (decisão estratégica aceita).

**Security review pré-público (completo em 2026-04-15):**

- `gitleaks detect` em 306 commits → 0 leaks (após allowlist expandido em
  `.gitleaks.toml` cobrindo placeholders CI conhecidos).
- URLs Portainer admin sanitizadas em docs (substituídas por `$PORTAINER_URL`).
- `.env.production`, `.env.local`, `.env.*` todos gitignored e não tracked.
- Nenhuma senha, token, API key real commitada.
- Secrets CI (PORTAINER_TOKEN, NPM_TOKEN, NEXTAUTH_SECRET) vêm só via
  `secrets.*` do GitHub, nunca hardcoded.

CI rodando com minutes ilimitados (benefício repos públicos).

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
- **Fase 21 — Mobile Kanban:** pipeline responsivo. `md:block` mantém desktop DndContext + grid. `md:hidden` mostra accordion vertical com dropdown "Mover para..." (drag desabilitado em mobile por limitação de touch UX). Touch targets 44px.
- **Fase 22 — Loading Skeletons:** 9 `loading.tsx` novos (dashboard, leads, contacts, opportunities, pipeline, products, tasks, campaigns, segments). Next Suspense renderiza skeleton durante fetch dos Server Components.
- **Fase 12.2 — E2E verde:** `phase-12-2-deployed` aplicado. 17+ tests passam em 43s (admin/manager/viewer/cross-tenant/pipeline).
- **Fase 23 — Reports/Analytics:** nova rota `/reports` (admin/manager only, `audit:view`). 4 cards: RevenueForecast (AreaChart stacked 6 meses × stage), LeadsBySource (BarChart horizontal com conversion rate qualified/converted), OwnerPerformance (table top 10 assignedTo), PipelineEvolution (LineChart 12 semanas — **dados estimados**, snapshot real em follow-up 23b). CSV export em cada card via `src/lib/reports/csv-export.ts`. Period filter 7/30/90/365d.
- **Fase 24 — Filtros + Bulk Actions:** URL-based filters (`?status=...`, `?stage=...`, `?q=...`, `?from/to=...`) em /leads/contacts/opportunities. Shareable via share URL + restaurável via back navigation. Bulk checkbox selection + BulkActionBar sticky + AlertDialog confirm + server action `delete<Entity>Bulk(ids)` com RBAC `<módulo>:delete` + tenant scope `deleteMany where companyId`. Componentes compartilhados em `src/components/tables/{bulk-action-bar,filter-bar}.tsx`.
- **Fase 25 — Busca Global UI:** expansão do CommandPalette com scoring server-side (`exact=100/startsWith=75/contains=50` + tiebreak pt-BR), deep-link (`/leads/{id}`, `/contacts/{id}`, `/opportunities/{id}`), recents localStorage TTL 30d com "Limpar", HighlightMatch component (`<mark class="bg-primary/15 …">`), novas entidades (products/tasks/workflows/campaigns/segments), RBAC gating server, a11y (`aria-live`/`aria-label`/kbd `aria-hidden`) e tratamento de erro inline. Helpers compartilhados em `src/lib/search/{normalize,scoring,recent}.ts`. 31 unit tests + 1 E2E spec novo.
- **Fase 26 — Bulk Delete em Products:** server action `deleteProductsBulk(ids)` com RBAC `products:delete` + tenant scope + limite 500. UI: checkbox column + `BulkActionBar` sticky violet + AlertDialog confirm. Escopo reduzido a products (iteração piloto — segments/campaigns/workflows/tasks em fases 27/28).
- **Fase 27 — Bulk Delete em Segments + Campaigns:** `deleteSegmentsBulkAction(ids)` filtra FK P2003 (segmentos em uso por campanhas ativas) retornando `{deletedCount, skippedInUse}`; `deleteCampaignsBulkAction(ids)` só permite status `draft|canceled|completed` (bloqueia running/sending/scheduled/paused) retornando `{deletedCount, skippedActive}`. UI replicou pattern Fase 26 em ambos.
- **Fase 28 — Bulk Delete em Workflows + Tasks:** `deleteWorkflowsBulkAction(ids)` com RBAC `workflows:manage` + tenant (WorkflowExecution cascade via onDelete Cascade nativo); `deleteActivitiesBulk(ids)` com RBAC `activities:delete` + cancela reminders best-effort + deleta files storage best-effort + cascade nativa para ActivityFile/Reminder. UI em workflows-list + tasks-content. **Completa cobertura bulk delete em todos os 8 módulos listados** (leads/contacts/opps Fase 24 + products/segments/campaigns/workflows/tasks Fases 26-28).
- **Fase 29 — Bulk Edit (Leads status + Opportunities stage):** `updateLeadsStatusBulk(ids, status)` (RBAC `leads:edit`, allowlist 5 statuses) e `updateOpportunitiesStageBulk(ids, stage)` (RBAC `opportunities:edit`, allowlist 6 stages). `BulkActionBar` estendido com prop `editActions?: BulkEditOption[]` (reutilizável). Dialog com select e Aplicar button em ambos. Limite 500 itens.
- **Fase 30 — Bulk Status em Tasks:** `updateActivitiesStatusBulk(ids, "completed"|"canceled")` filtra apenas pending, cancela reminderJobId BullMQ e set `completedAt` para completed. Dois botões diretos no BulkActionBar (sem dialog).
- **Fase 31 — Bulk Assign Owner em Leads:** `assignLeadsBulk(ids, assigneeId|null)` valida que assignee é membro ativo da company; null = desatribuir. `getCompanyAssignees()` popula select. Terceiro botão "Atribuir a..." no BulkActionBar com Dialog.

**Fase 25 — Busca Global UI (bbbc259, deployed):** CommandPalette Ctrl+K expandido com scoring server-side (exact=100/startsWith=75/contains=50), deep-link para leads/contacts/opportunities/{id}, HighlightMatch (`<mark bg-primary/15>`), recent searches localStorage (TTL 30d, limite 5), novas entidades products/tasks/workflows/campaigns/segments, RBAC gating + tenant scope, 31 unit tests + E2E admin. Spec/plan v1→v2→v3 em `docs/superpowers/{specs,plans}/2026-04-15-fase-25-busca-global-ui-v*.md`.

**Fase 25b — tenant tests fix (1e45dd1 no blueprint + próprio commit no CRM):** 9 testes tenant scoping estavam quebrados pre-Fase 25. Fix: mockUser precisa `platformRole: "admin"` pra passar `requirePermission`. 461/461 Vitest verde.

**Fase 25.1 — security + bug fixes pós-Review 2 (2 commits deployed):**
- **C1 PII leak (CRÍTICO):** users/companies cross-tenant findMany sem filtro → todo usuário autenticado via PII de outros tenants. Fix: gatear ambas queries por `isSuperAdmin`.
- **C4 HighlightMatch offset bug:** `normalize()` encurtava strings NFD-decomposed; `text.slice(nIdx, ...)` desalinhava. Fix: `findMatches` itera no texto original com `normalizeFragment` (sem trim). Bonus: múltiplos matches agora destacados (era só primeiro).
- **Débitos abertos (Fase 26):** C5 pg_trgm GIN indexes em campos de texto (seq scan aceito no MVP); C6 coverage gaps (ordering E2E, error 500 branch, aria-live snapshot). Registrado em `memory/project_phase_25_1_followups.md`.

**Todas fases acima COMPLETAS + deployed em prod.** Frente 17 tenant scoping (77e2918) e todas as fases subsequentes mergeadas em main.
**LEI ABSOLUTA #4** adicionada: toda nova implementação deve consultar `nexus-blueprint/` (design-system.md, patterns/, modules/) antes de criar componentes/features.
`npm audit --audit-level=high --omit=dev` → 0 vulns. Restam 4 moderate, tracked em `docs/ops/security.md` §2.1.

**Próximas opções actionable para nova sessão:**

| Opção | Descrição | Esforço | Blocker |
|---|---|---|---|
| ~~**A — Busca global UI**~~ ✅ | Entregue na **Fase 25** (scoring + deep-link + recents + highlight + novas entidades) | — | — |
| **B — Sentry real** | Reativar `@sentry/nextjs` 10.x + instrumentation.ts | S | secret `SENTRY_DSN` no Portainer |
| **C — Email OAuth real (Fase 7b/7c)** | Gmail/Outlook send + tracking | M-L | secrets `GOOGLE_OAUTH_*` + `MS_OAUTH_*` |
| **D — Fase 4 Quotes** | Modelo de cotações vinculadas a oportunidades | M | — |
| **E — Fase 5 Custom Attributes** | Campos customizáveis por tenant em Lead/Contact/Opportunity | L | — |
| **F — CSP nonce** | Endurecer CSP (remover unsafe-inline/eval) | M | — |
| **G — Filtros + Bulk em products/tasks/campaigns** | Estender Fase 24 para 5 módulos restantes | M | — |
| **H — Pipeline snapshots reais (23b)** | Cronjob semanal salvando pipeline evolution no DB | M | — |
| **I — Saved filters** | Persistir filtros preferidos por user | M | — |
| **J — Bulk edit** | Mudar status/stage de N items de uma vez | M | — |
| **K — Dark mode audit** | Passar pente fino contraste dark mode em todas telas | S | — |

Recomendação pós-Fase 25: avançar para **G** (Filtros + Bulk em products/tasks/campaigns/segments/workflows) → **I** (Saved filters) → **J** (Bulk edit) → **D** (Quotes) → **E** (Custom Attributes) → **H** (Pipeline snapshots reais) → **F** (CSP nonce) → **K** (Dark mode audit). Bloqueadas: B/C aguardam secrets externos.

**Já entregue (não listar):** Busca global ✅ (25), Reports ✅ (23), Filtros URL + Bulk Delete ✅ (24), Mobile kanban ✅ (21), Empty states ✅ (20), Loading skeletons ✅ (22).

---

## 1. Estado atual (2026-04-15 madrugada — sessão consolidada)

✅ **Produção estável.** `/login` 200 • `/api/health` 200 • `/api/ready` 200.
Headers de segurança completos (HSTS/CSP/XFO/XCTO/Referrer/Permissions).
E2E CI verde (17+ tests em 43s).

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
| **`phase-21-mobile-kanban`** | **21 — Mobile Kanban** | **✅ accordion <md + dropdown "Mover para..."** |
| **`phase-22-loading-skeletons`** | **22 — Loading Skeletons** | **✅ 9 loading.tsx em rotas críticas** |
| **`phase-23-reports-deployed`** | **23 — Reports/Analytics** | **✅ /reports com 4 cards (RevenueForecast + LeadsBySource + OwnerPerformance + PipelineEvolution estimado) + CSV export** |
| **`phase-24-filters-bulk-deployed`** | **24 — Filtros + Bulk Actions** | **✅ URL-based filters + bulk delete em /leads/contacts/opportunities** |
| **`prod-stable-2026-04-14-late`** | **snapshot estável pós-fix** | **✅ referência para rollback** |

### 1.2. Commits recentes em `main` (últimos 10 — 2026-04-15)

```
7606681 docs(ui): spec Fase 22 — Loading Skeletons
5d1868d feat(ui): loading.tsx skeletons em 9 rotas (Fase 22)
976f4fa docs(handoff): repo público + security review consolidado
c137336 chore(security): sanitize Portainer URLs + gitleaks allowlist CI
0bfd566 docs(handoff): alerta billing GH Actions + tags 20/21
e7bfa04 feat(ui): pipeline kanban responsivo — accordion mobile <md (Fase 21)
fb72538 docs(mobile): spec Fase 21 — Mobile Kanban Responsivo
455f76d docs(handoff): fases 17/18/19/20T2 deployed — 22 tags totais
f4eb57d feat(ui): EmptyState em mailboxes (Fase 20 T2)
cb28605 feat(ui): EmptyState em segmentos (Fase 20 T2)
```

Total na sessão 2026-04-14→15: ~60 commits com 13 tags aplicadas.

### 1.3. PRs abertos

Nenhum PR aberto no momento. Todo trabalho foi comitado diretamente em `main`.

### 1.4. Ações ainda pendentes (opcionais)

- **Secrets Portainer para features aguardando:** `SENTRY_DSN` (reativar Sentry), `OTEL_EXPORTER_OTLP_ENDPOINT` (OpenTelemetry), `GOOGLE_OAUTH_*` + `MS_OAUTH_*` (Fase 7b email OAuth real), `MARKETING_DAILY_QUOTA` + `UNSUBSCRIBE_TOKEN_SECRET` ≥ 32 chars (Fase 9 full).
- **Migrations:** aplicadas em 2026-04-14 via `prisma db push` (Prisma v7 não tem migrate deploy runtime). Sistema de migrations normalizado.
- **System user:** criado em 2026-04-14 via INSERT SQL direto (UUID nil `00000000-...`).
- **CSP nonce:** atual usa `unsafe-inline` + `unsafe-eval` (Next 16 requirements); endurecer em follow-up 12.4b.
- **Visual regression em CI:** baselines atuais são darwin (macOS local); CI linux precisa pipeline dedicado de snapshot update.

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

### Fases entregues nesta sessão (2026-04-14→15)

- **12.4** Security Audit ✅
- **12.5** Runbook Expansion ✅
- **12.6** CVE High Fixes ✅
- **13** UI Consistency (PageHeader + stagger + sidebar) ✅
- **14** E2E CI Stabilizer ✅
- **15** RBAC Server Actions ✅
- **16** Zero CVEs ✅
- **17** Pipeline Kanban ✅ (substitui Fase 2 planejada — kanban entregue)
- **18** Dashboard Funnel ✅
- **19** Sidebar Pipeline ✅
- **20 T2** EmptyStates ✅
- **21** Mobile Kanban Responsivo ✅
- **22** Loading Skeletons ✅
- **12.2** E2E CI verde ✅

### Fases ainda bloqueadas

- **1d** — DS v0.4.0 (trabalho no repo externo `@nexusai360/design-system`).
- **4** (Quotes), **5** (Custom Attributes) — domínio aberto para implementação.
- **7b full** — requer `GOOGLE_OAUTH_*` + `MS_OAUTH_*` em Portainer.
- **7c** (send+tracking) — depende de 7b real.
- **9 full** (marketing send real) — depende de 7c.
- **10** (DataTransfer CSV) — depende de 5.
- **11, 11b** (Reports, Public API) — actionable, não bloqueadas (só aguardam priorização).

---

## 4. Como continuar (novo terminal)

### 4.1. Leitura obrigatória (nesta ordem)

1. Este arquivo (`docs/HANDOFF.md`).
2. `CLAUDE.md` — **4 LEIS ABSOLUTAS** (debug via logs container; skills superpowers; ui-ux-pro-max; **consultar nexus-blueprint**).
3. `/Users/joaovitorzanini/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/MEMORY.md` — índice de 24+ memories com links.
4. Memory `session_state_2026_04_15.md` — snapshot mais recente.

### 4.2. Checklist rápido ao retomar

```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
git fetch --all --tags
git log --oneline -10
git tag -l "phase-*" | sort
gh run list --limit 3                           # CI (ilimitado em repo público)
gh pr list --state open                         # deve estar vazio
/usr/bin/curl -s -o /dev/null -w "login: %{http_code}\n" https://crm2.nexusai360.com/login
/usr/bin/curl -sI https://crm2.nexusai360.com/login | grep -iE "strict-transport|content-security"
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

Ver §0 TL;DR — tabela de 11 opções (A-K). Recomendação: **Reports/Analytics** (A) ou **tríade utility UX** (B+C+D: filtros+bulk+busca).

**Sem blockers externos — prontos para iniciar:**

- **A. Reports/Analytics avançado** — gráficos receita por mês, conversion rate por segmento, exportar CSV.
- **B. Filtros avançados** — URL query params + RSC nas tabelas.
- **C. Bulk actions** — selecionar múltiplos em tables + delete/export.
- **D. Busca global UI** — `/api/search` existe; falta UI.
- **G. Fase 4 Quotes** / **H. Fase 5 Custom Attributes**.
- **I/J. Fase 11/11b** (Reports, Public API).
- **K. CSP nonce** — remover `unsafe-inline`/`unsafe-eval` (requer nonce SSR).

**Aguardam secrets externos:**

- **Fase 7b real** — Google/MS OAuth secrets em Portainer env.
- **Fase 7c** (send+tracking) — depende 7b.
- **Fase 9 full** (marketing send real) — depende 7c.
- **Sentry real** — DSN em Portainer env.

### 4.6. PRs abertos

Nenhum PR aberto. Todo trabalho foi comitado direto em main.

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
- **Portainer:** `$PORTAINER_URL` (ver `.env.production`) (stack: db, redis, app, worker).
- **DB:** PostgreSQL 16 (`nexus-crm-krayin_db`).
- **Cache/Queue:** Redis 7 (`nexus-crm-krayin_redis`).
- **Domínio:** `crm2.nexusai360.com`.
- **CI/CD:** GitHub Actions (`.github/workflows/build.yml` dispara em push main → Docker build → GHCR push → Portainer API rollout).

---

## 7. Session totals (2026-04-14→15)

- **~75 commits novos** nesta sessão autônoma.
- **16 tags novas** (phase-12-4, 12-5, 12-6, 13, 14, 15, 16, 17, 18, 19, 20-empty-states, 21, 22, 23-reports, 24-filters-bulk + phase-12-2-deployed + prod-stable-2026-04-14-late).
- **Repo tornado público** 2026-04-15 (após security review 2-pass).
- **0 CVEs** (high + moderate) em `npm audit`.
- **E2E CI verde** (17+ tests passed em ~43s via `next start` em CI).
- **6 security headers** ativos em prod.
- **RBAC** em 14 arquivos de Server Actions + gating UI.
- **docs/superpowers/**: 25+ specs v3 + 22+ plans v3.
- **memory/**: 24+ arquivos em `.claude/projects/.../memory/`.

---

## 8. Histórico de decisões importantes

### 8.1. Incidente 2026-04-14 → resolvido via LEI #1

Prod `/login` retornou 500 após deploys de vendor UI packages (dual React).
Resolvido via logs Portainer em minutos (após perder 4h em commits especulativos
antes da LEI #1 existir). Fixes em 3 commits:

1. `67358a1` vendor `@nexusai360/*` em `transpilePackages` (next.config.ts)
2. `3a6482e` lazy `getResend()` em `src/lib/email.ts`
3. `prisma db push` via Portainer exec + system user INSERT SQL

Lição consagrada na LEI ABSOLUTA #1 (`CLAUDE.md`).

### 8.2. Repo tornado público 2026-04-15

Motivação: evitar custo GitHub Actions em repo privado (~2k min/mês grátis,
sessão 2026-04-14 consumiu >210 min). Security review 2 passes aprovado antes
de publicar:

- gitleaks: 0 leaks após allowlist expandido.
- `.env*` todos gitignored.
- URLs Portainer sanitizadas em docs.
- Vendor packages `.tgz` aceitos como expostos (decisão B do usuário).

### 8.3. E2E CI estabilizado (Fase 14)

Pré-Fase 14: E2E travava indefinidamente no global-setup viewer. Causa real:
`next dev` compilando rotas sob demanda em runner CI de 2 vCPUs, excedendo
timeout de 90s. Fix: webServer via `next start` (com `npm run build` precedente
no workflow). Resultado: de 0 specs rodando para 17+ passed em ~43s.

### 8.4. LEI ABSOLUTA #4 — consultar nexus-blueprint

Toda nova implementação deve ler `/nexus-blueprint/core/design-system.md` +
`patterns/` + `modules/` antes de criar componentes/features. Divergência OK
mas documentada no spec. Fonte única de verdade para consistência entre
projetos Nexus.

---

## 9. Contato

Handoff gerado pelo Claude Opus 4.6 (1M context) em sessão autônoma
2026-04-14→15. Decisões arquiteturais nos specs v3 em `docs/superpowers/specs/`.
Aprendizados operacionais em `CLAUDE.md` (4 LEIS) + memory.

**Modelo recomendado para continuar sessão:** Claude Opus 4.6 ou superior
(tarefas envolvem orquestração de 14+ arquivos, agents paralelos, 2-pass
reviews em specs/plans).
