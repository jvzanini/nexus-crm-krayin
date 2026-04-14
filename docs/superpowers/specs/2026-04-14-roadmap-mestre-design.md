# Spec: Roadmap Mestre — Adaptação Krayin → Nexus CRM

**Data:** 2026-04-14
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda)
**Status:** Fase 0 — documento vivo que governa as fases seguintes.
**Escopo:** Mapear e sequenciar todas as fases para transformar o Krayin CRM (referência em `nexus-crm`) na versão Nexus CRM (`nexus-crm-krayin`), preservando lógica útil do original e aplicando 100% a identidade visual do Nexus Blueprint.

### Changelog
- **v1 → v2:** aplicada Review 1 ampla (observability, backup/DR, RBAC granular, API+webhooks, OAuth email, multi-moeda+timezone, feature flags, dependências entre fases corrigidas, Foundation expandido em 1a/1b/1c, LGPD/GDPR, performance budgets, seed demo, riscos estendidos, fora de escopo ampliado, fast-path em reviews).
- **v2 → v3:** aplicada Review 2 profunda (7 críticos + 9 importantes + 5 sugestões). Destaques: dependência Fase 8→Fase 2, hardening PDF, proteção JSONB/SQLi, anti-storm/loop em Automation, deliverability de Email (SPF/DKIM/DMARC/FBL/list-unsubscribe/warm-up), ponto de coleta de consent LGPD, defesa contra zip-bomb/formula-injection, rollback concreto, reuso explícito de pacotes do Blueprint, Fase 1d para DS de domínio, fast-path objetivo, métricas de custo/storm, teste cross-tenant em reports.

---

## 1. Contexto

- **Repo de implementação:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin` — Next.js 16, React 19, TypeScript, Tailwind 4, Prisma 7, PostgreSQL 16, NextAuth 5, BullMQ/Redis, i18n (next-intl), Resend, Sonner, Framer Motion.
- **Repo referência (bruto):** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm` — Krayin Laravel 10, pacotes Webkul modulares, Blade templates, REST API v2.1.
- **Fonte de identidade visual:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint` — monorepo `@nexusai360/*` (design-system, core, multi-tenant, audit-log, encryption, realtime, queue, outbox, webhook-routing, billing, api-keys, notifications, search, settings, onboarding, dashboard, types, cli).

**Estado atual do CRM (já entregue):** Auth (NextAuth 5), multi-tenant básico (Company + 2 camadas de roles), Users/Profile, tema dark/light/system SSR, CRUD Leads/Contacts/Opportunities, Activities mínima, AuditLog, Notifications (feed+badge+SSE), Search global Ctrl+K, Settings, API Keys, Encryption, Realtime, Dashboard, deploy Docker Swarm+Portainer+GitHub Actions.

**Lacunas vs Krayin:** pipelines configuráveis, Products (multi-moeda), Quotes, Custom Attributes, Activities completo, Email OAuth/IMAP/SMTP, Automation, Marketing Campaigns, DataTransfer CSV/XLSX, Reports avançados, Public API, Webhooks de saída, RBAC granular, Observability/Backup/Feature flags.

---

## 2. Princípios do Roadmap

1. **Foundation antes de features.** Design system + plataforma ops 100% prontos antes de features de domínio.
2. **Lógica do Krayin, identidade Nexus.** Copiar domínio/fluxos; refazer código/visual no padrão Nexus.
3. **Entregas pequenas e testáveis.** Cada fase é ciclo spec + plan + impl com testes.
4. **Reuso do monorepo.** Transversais → pacotes `@nexusai360/*`; específicos do CRM → `src/lib/features/<feature>`.
5. **Segurança, privacidade, performance por padrão.** Cada fase valida RLS/tenant, Zod, audit, rate limit, LGPD/GDPR, budgets de performance.
6. **Deploy contínuo com rollback preparado.** Fase verde vai para Portainer; toda fase produz git tag, migrations reversíveis, kill-switch flag.
7. **I18n + timezone desde o dia 1.** next-intl PT-BR/EN (hooks para ES); horários sempre com tz user/tenant.
8. **Observable por padrão.** Toda feature produz logs estruturados, métricas, traces e alertas úteis.
9. **Reuso explícito do Blueprint.** Cada spec de fase declara quais pacotes `@nexusai360/*` consome.

---

## 3. Fases (sequência)

| # | Fase | Deliverable | Depende | Complexidade |
|---|------|-------------|---------|--------------|
| **0** | Roadmap mestre | Este documento | — | Baixa |
| **1a** | Foundation A: DS core + shell | `@nexusai360/design-system` v0.3.0 publicado (Skeleton, LoadingSpinner, EmptyState, ErrorState, AppShell, PageHeader, Breadcrumb, IconTile, Separator, Avatar, Tooltip, Tabs, DropdownMenu, ScrollArea); audit WCAG AA baseline com tooling CI | 0 | Alta |
| **1b** | Foundation B: migração de telas + consent | Telas atuais (Auth, Leads, Contacts, Opportunities, Dashboard, Settings, Search, Notifications) migradas para DS v0.2.0. **Forms de Leads/Contacts passam a coletar `consent_marketing` e `consent_tracking` explícitos (LGPD).** | 1a | Alta |
| **1c** | Foundation C: plataforma ops | Observability (logs pino, métricas Prometheus, tracing OTel, Sentry, `/api/health`, `/api/ready`); feature flags; backup Postgres automatizado + drill inicial em staging; RBAC granular (matriz permissão×role×módulo via `@nexusai360/multi-tenant`) | 1a | Alta |
| **1d** | Foundation D: DS compound (domínio) | Componentes compostos que serão usados nas fases seguintes: `KanbanBoard`, `RichTextEditor` (email templates), `CsvColumnMapper`, `PdfPreview`, `ChartPrimitives` (line/bar/funnel/donut), `AutomationNodeBuilder` (low-level blocks). Publicados como `@nexusai360/design-system` v0.4.0 | 1a | Alta |
| **2** | Pipelines & Stages configuráveis | CRUD pipelines; kanban Opportunities drag-drop; estágios por tenant; eventos de domínio (`pipeline.*`, `opportunity.stage_changed`) via `@nexusai360/outbox` | 1b, 1c, 1d | Alta |
| **3** | Products & Catálogo (multi-moeda) | CRUD produtos (SKU, preço base + moedas suportadas, categoria, ativo); `currency` no tenant | 1b, 1c | Média |
| **4** | Quotes (cotações) | Quote a partir de Opportunity; linha de itens; impostos; moeda+FX snapshot; **PDF server-side sandboxed** (sem JS arbitrário, sem fetch externo, fontes/imagens allowlistadas, signed URL para download); status workflow; atributos custom | 2, 3, 5 | Alta |
| **5** | Custom Attributes | Atributos por tenant para Leads/Contacts/Opportunities/Quotes; **armazenamento JSONB com índice GIN nos campos consultáveis; queries só via Prisma typed filters / parâmetros validados, zero `$queryRawUnsafe`; operadores em allowlist**; render dinâmico em forms/tabelas/filtros | 1b, 1d | Alta |
| **6** | Activities expandido | Calls, Meetings (timezone-aware), Tasks, Notes, File; reminders via BullMQ | 1b, 1c | Média |
| **7** | Email integration | OAuth Google/Microsoft (primário, refresh token criptografado via `@nexusai360/encryption`, rotação documentada) + IMAP/SMTP (fallback, creds criptografadas); templates via `RichTextEditor`; envio via Activity; tracking abertura **condicional a `consent_tracking`**; threading | 6, `@nexusai360/encryption` | Muito alta |
| **8** | Automation Workflows (MVP) | Engine trigger→condições→ações via `@nexusai360/queue` + `@nexusai360/outbox`. Triggers MVP: `lead.created`, `contact.created`, `opportunity.stage_changed` (requer Fase 2), `activity.completed`. Ações MVP: send-email, assign-user, create-task, update-field. **Anti-storm/loop: idempotência por event id, detecção de ciclo (counter por event-chain, abort em N), quota de jobs/dia por tenant, circuit breaker em falhas em cascata**. Sem editor visual complexo no MVP (usa blocks do DS v0.3.0) | 2, 5, 6, 7 | Muito alta |
| **9** | Marketing Campaigns | Campanhas email em massa sobre segmentos (usa Custom Attributes). **Deliverability: SPF/DKIM/DMARC configurados por tenant ou pool dedicado; list-unsubscribe (RFC 8058); bounce/complaint handling + supressão automática; FBL (feedback loop) onde aplicável; warm-up de IP quando pool dedicado; opt-out obrigatório; quota diária configurável; fila dedicada BullMQ com prioridade distinta da transacional** | 5, 7, 8 | Alta |
| **10** | DataTransfer (import/export) | Import CSV/XLSX com mapeamento de colunas (inclui atributos custom); export CSV/XLSX. **Defesas: limite tamanho (e.g. 20MB), limite linhas (e.g. 50k), proteção zip-bomb (XLSX), neutralização CSV formula-injection (`=/+/-/@` prefixed com `'`), validação encoding UTF-8, timeout parsing, upload em área quarentenada antes de commit, scanner de mime real vs ext.** | 5 | Média |
| **11** | Reports avançados | Funil, conversão, forecast, performance por vendedor; filtros por custom attributes; **E2E obrigatório com 2 tenants populados validando que agregados de A não incluem nada de B** | 2, 4, 5, 6 | Alta |
| **11b** | Public API + Outbound Webhooks | API REST versionada (v1) escopo Leads/Contacts/Opportunities/Quotes/Activities/Products; **outbound webhooks via `@nexusai360/webhook-routing` + `@nexusai360/outbox`**; rate limit por API key (`@nexusai360/api-keys`); OpenAPI docs; rotação/revogação de API key com grace period | 11 | Alta |
| **12** | Hardening + deploy final | E2E golden paths; audit segurança; performance budgets validados (inclui budget de Marketing); backup drill completo; LGPD/GDPR endpoints (DSAR export/delete/anonimize, teste E2E no CI); docs Portainer finais; go-live | 1–11b | Média |

---

## 4. Processo por fase (LEI ABSOLUTA, com fast-path objetivo)

Cada fase segue rigorosamente:

1. **Brainstorm** via `superpowers:brainstorming` (+ `ui-ux-pro-max` para qualquer UI).
2. **Spec v1** em `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
3. **Review 1 (ampla)** via agente `superpowers:code-reviewer` — passou batido, excessos, lacunas transversais.
4. **Spec v2** aplicando a review 1.
5. **Review 2 (profunda)** — segurança, integrações, edge cases, multi-tenant leak, privacidade, performance, reuso de pacotes.
6. **Spec v3 final** (ou v2 com fast-path — ver regra abaixo).
7. **Plan v1** em `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` via `superpowers:writing-plans`.
8. **Review 1 ampla** do plan.
9. **Plan v2** aplicando.
10. **Review 2 profunda** do plan.
11. **Plan v3 final** (ou v2 com fast-path).
12. **Implementação** via `superpowers:executing-plans` / `subagent-driven-development`. A cada task: implementar → testes → `superpowers:verification-before-completion` → marcar concluída.
13. **Commit granular** por bloco coerente.
14. **Review final da fase** via `superpowers:code-reviewer`.
15. **Deploy Portainer** quando fase verde; git tag `phase-N-deployed`.
16. **Atualizar memória** com decisões não-óbvias.

**Fast-path objetivo:** a v2 é promovida a final SE E SOMENTE SE a Review 2 retornar ZERO achados de severidade Crítico ou Importante — apenas Sugestões. O veredito literal da review (extraído do output do agente) é registrado no topo do arquivo. Review 1 é sempre obrigatória; nunca pulada.

---

## 5. Convenções transversais

### 5.1. UI / Frontend
- Sempre invocar `ui-ux-pro-max:ui-ux-pro-max` antes de criar/alterar componentes visuais.
- Tokens (cor, radius, sombra, tipografia, espaçamento): só do `@nexusai360/design-system`.
- Componentes base + compostos (Kanban, PDF preview, RichText, Chart, CsvMapper, AutomationBuilder): só do DS. Proibido recriar.
- Animações Framer Motion via variants pré-definidas.
- Dark/light/system, WCAG AA, aria labels, foco visível.
- Timezone/Intl obrigatórios: datas/horas com tz user/tenant; números/moedas com `Intl.NumberFormat`.

### 5.2. Backend / Dados / Privacy / Segurança
- Multi-tenant: toda query de domínio escopada por `companyId`.
- Validação Zod em `src/lib/validations/<feature>.ts`.
- Server Actions em `src/lib/actions/<feature>/*.ts` retornando `ActionResult<T>`.
- Audit log via `withAudit` em mutações sensíveis.
- Rate limit em endpoints públicos via `@nexusai360/core`.
- Migrations Prisma com índices revisados (GIN em JSONB consultável; compostos para queries quentes).
- **LGPD/GDPR:**
  - Consent coletado em Fase 1b nos CRUDs de Leads/Contacts: flags `consent_marketing` e `consent_tracking`, ambos com timestamp e origem.
  - Tracking de abertura e envio de marketing são PREDICADOS dessas flags (enforcement no backend).
  - Endpoints DSAR (export completo + delete/anonimize do titular) entregues em Fase 12 com teste E2E.
  - Unsubscribe/opt-out em toda campanha (link + header RFC 8058).
  - Retention policy documentada (por entidade).
- **PDF (Fase 4):** renderizador server-side sandboxed (Puppeteer com `--no-sandbox` proibido; preferir biblioteca pure-JS como `pdfkit` ou Chromium isolado com network off); sem JS arbitrário do input; templates compilados; fontes/imagens allowlistadas; anexos servidos via signed URL expirável.
- **JSONB (Fase 5):** acesso via Prisma typed filters; operadores em allowlist (`equals`, `in`, `contains`, `gt/gte/lt/lte`); nunca `$queryRawUnsafe` com input do usuário; GIN index nos campos filtráveis.
- **Uploads (Fase 10):** limites de tamanho/linhas; detector zip-bomb; neutralização CSV formula-injection; validação encoding; timeout; quarentena antes de commit; verificação mime real.
- **Seed de demonstração:** `pnpm db:seed:demo` dataset coerente, com nomes obviamente fake (ex: `Maria Exemplo`, `acme-demo.test`) para não ser confundido com prod.

### 5.3. Qualidade / Performance
- `pnpm lint` + `tsc --noEmit` passam.
- Unit tests para helpers puros; integração para actions críticas; E2E para golden paths.
- `superpowers:verification-before-completion` antes de concluir task.
- **Performance budgets por tipo de rota:**
  - CRUD listagens: p95 servidor < 300ms.
  - Dashboard/Reports (heavy): p95 servidor < 600ms; TTI < 2s.
  - Bundle por rota: leve < 250KB gz; heavy (kanban/charts) < 400KB gz.
  - Queue job lag regime normal: < 30s.
  - **Marketing (Fase 9):** campanha de 10k destinatários enviada em < 15min; lag < 5min durante campanha; fila transacional não degrada > 20%.

### 5.4. Deploy / Ops / Rollback
- `Dockerfile` + compose atualizados a cada fase.
- Fase verde → deploy Portainer; **git tag `phase-N-deployed` imediatamente antes**.
- `.env.example` atualizado sempre que nova var é introduzida.
- **Feature flags** env-based em `src/lib/flags.ts`; todo recurso novo nasce atrás de flag (kill-switch) até estabilizar.
- **Secrets** em Swarm secrets / env criptografadas. Nunca em git.
- **Rollback preparado:**
  - Git tag pré-deploy permite revert rápido no Portainer.
  - Migrations reversíveis (`down` testado) OU plano de forward-fix documentado na PR.
  - Kill-switch flag acionável sem deploy para qualquer feature crítica nova.

### 5.5. Observability
- **Logs estruturados** (pino): request id, tenant id, user id, feature, level, duration.
- **Métricas** `/metrics` (Prometheus): HTTP latency histogram; BullMQ job duration/error rate; auth failures; **`email_sent_total{tenant}`, `email_bounce_rate{tenant}`, `email_complaint_rate{tenant}`, `automation_jobs_rejected_total{reason}` (quota/loop/breaker), `campaign_cost_estimate_usd{tenant}` (baseado em quota Resend/SES), `jsonb_query_fallback_total`.**
- **Tracing** OpenTelemetry (OTLP exporter configurável) cobrindo actions e jobs.
- **Errors** para Sentry; alertas críticos via webhook do próprio CRM (dogfooding).
- **Health/readiness** `/api/health`, `/api/ready`.
- **Alerts obrigatórios:** bounce rate > 5% por tenant/24h, complaint rate > 0.1%, automation storm (jobs_rejected spike), queue lag > budget, custo estimado > threshold por tenant, auth failures spike.

---

## 6. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Escopo monolítico | Alto | Fase >7 tasks no plan é decomposta. |
| DS muda durante o percurso | Médio | SemVer em `@nexusai360/design-system`; pin no CRM. |
| Automation storm / loop infinito | Muito alto | Idempotência event-id; contador de chain; quota/dia; circuit breaker (Fase 8). |
| Email deliverability (spam/blacklist) | Muito alto | SPF/DKIM/DMARC + bounce/complaint handling + warm-up + FBL (Fase 9). |
| PDF server-side (SSRF/XXE/LFI) | Alto | Sandbox sem network; templates compilados; fontes allowlist (Fase 4). |
| SQLi via JSONB em filtros dinâmicos | Muito alto | Prisma typed filters; operador allowlist; GIN index (Fase 5). |
| Zip-bomb / formula-injection em CSV/XLSX | Alto | Defesas em Fase 10 (§5.2). |
| Multi-tenant leak | Muito alto | Review 2 cross-tenant manual; E2E obrigatório com 2 tenants em Reports. |
| Regressão visual em 1b | Médio | Screenshots antes/depois; golden path manual. |
| Deploy quebrar produção | Alto | Tag git + migrations reversíveis + kill-switch flag. |
| Dependência em Resend | Médio | Fallback IMAP/SMTP na Fase 7; quota alerts. |
| Custo Redis/BullMQ/Resend escalar | Médio | Métricas + alertas em 5.5; quota por tenant. |
| Drift `@nexusai360/*` vs CRM | Médio | CI valida latest minor compatível. |
| Secrets vazando | Muito alto | Swarm secrets only; audit Portainer. |
| Fadiga do loop YOLO | Médio | Fast-path objetivo; memória; commits pequenos. |
| Perda de dados | Muito alto | Backup + drill inicial Fase 1c + trimestral pós Fase 12. |
| LGPD/GDPR gap | Muito alto | Consent em Fase 1b; DSAR em Fase 12; predicate de tracking/marketing. |

---

## 7. Critérios de conclusão (mensuráveis e automatizados)

- **Parity matrix** (Appendix A): `pnpm parity:check` lê o doc e reporta ≥95% em `parity`/`dropped`.
- **E2E** golden paths passando em CI: login, CRUD de cada entidade principal, kanban drag-drop, criar quote, disparar automation, enviar campanha (dry-run em staging), importar CSV, gerar report, **DSAR export + delete**, **agregado cross-tenant isolado**.
- **Performance budgets** (§5.3) validados em load test k6 no CI (smoke) e em staging (full).
- **Backup + restore drill** executado com sucesso (inicial Fase 1c; final Fase 12).
- **Observability** endpoints vivos em produção coletando em Sentry/Prometheus/OTel.
- **Deploy Portainer** 100% green (health/readiness OK).
- **Docs** `docs/superpowers/specs/` e `/plans/` espelham código; README atualizado; changelog de cada fase no doc respectivo.

---

## 8. Fora de escopo (v3)

- App mobile nativo (só web responsivo).
- VoIP real — Activities de call são log manual.
- BI embarcado (Looker/Metabase) — reports nativos via charts do DS.
- BI self-service / dashboards customizáveis pelo usuário final.
- Marketplace de plugins; SSO SAML; white-label multi-brand.
- Chat interno entre usuários da mesma empresa.
- App desktop (Electron/Tauri).
- Marketplace integrations (Shopify/etc.).
- Migração de dados de instância Krayin existente.
- **Inbound webhooks genéricos** — Public API cobre recepção programática; não há endpoint "receba qualquer coisa de qualquer terceiro".
- Zapier/n8n nativo — outbound webhooks (11b) são a integração suportada.
- Chat/SMS/WhatsApp nativo.

---

## Appendix A — Parity Matrix (esqueleto)

Preenchida durante cada fase. Status: `parity` | `partial` | `dropped` | `pending`. Script `pnpm parity:check` conta e falha se <95%.

| Módulo Krayin | Feature | Fase Nexus | Status | Observação |
|---------------|---------|-----------|--------|------------|
| Lead | CRUD | — | parity | já entregue |
| Lead | Pipeline/Stages | 2 | pending | |
| Lead | Custom attributes | 5 | pending | |
| Contact | CRUD | — | parity | já entregue |
| Contact | Custom attributes | 5 | pending | |
| Opportunity | CRUD | — | parity | já entregue |
| Opportunity | Kanban | 2 | pending | |
| Activity | Call/Meeting/Task/Note | 6 | pending | |
| Activity | Reminders | 6 | pending | |
| Email | OAuth Google/MS | 7 | pending | primário |
| Email | IMAP/SMTP | 7 | pending | fallback |
| Email | Templates | 7 | pending | |
| Email | Tracking | 7 | pending | consent-gated |
| Product | CRUD | 3 | pending | multi-moeda |
| Quote | CRUD + PDF | 4 | pending | PDF sandboxed |
| Quote | Line items + taxes | 4 | pending | |
| Automation | Workflows MVP | 8 | pending | anti-storm/loop |
| Marketing | Campaigns | 9 | pending | deliverability full |
| DataTransfer | Import CSV/XLSX | 10 | pending | defesas file attack |
| DataTransfer | Export CSV/XLSX | 10 | pending | |
| Reports | Funnel/Forecast | 11 | pending | cross-tenant test |
| REST API | Public v1 | 11b | pending | versioned |
| Webhooks | Outbound | 11b | pending | signed |
| UI | Design System core (14 comps) | 1a | parity | @nexusai360/design-system@0.3.0 publicado; 32 unit tests; bundle 15.17KB/60KB gz |
| UI | Tokens + theming (dark/light) | 1a | parity | theme-provider + tokens em v0.2.0, consumido em v0.3.0 |
| UI | /__ds-preview smoke (3vp×2temas) | 1a | parity | Playwright spec + axe; baselines via workflow_dispatch |
| Infra | GitHub Packages publish pipeline | 1a | parity | tag v<ver>-<pkg> → publish.yml |
| Infra | Docker CRM build + deploy Portainer | 1a | parity | node:20-slim; rollout automático quando Portainer alcançável |
| UI | Telas migradas para DS (10 rotas) | 1b | parity | Fase 1b.0 — imports swap (auth, dashboard, leads, contacts, opportunities, profile, users, companies, settings) |
| Compliance | Consent LGPD Leads/Contacts | 1b | parity | migration + lib recordConsent + forms + consent_logs + backfill + docs/lgpd.md |
| Quality | ESLint rule no-direct-consent-write | 1b | parity | rule local em `eslint-rules/`, wired em `eslint.config.mjs`, teste RuleTester |
| Quality | i18n parity check (br × us) | 1b | parity | `scripts/check-i18n-parity.ts`; pacotes locale-específicos (address, common) pulados por design |
| Ops | Logger pino + redactors PII | 1c | parity | `src/lib/logger.ts`; lint `no-console-in-src` (warn-first) |
| Ops | /api/health + /api/ready | 1c | parity | liveness puro + readiness (DB + Redis); públicos via authConfig allowlist |
| Ops | x-request-id middleware | 1c | parity | gera UUID se ausente; propaga no response |
| Ops | Feature flags runtime | 1c | partial | lib `src/lib/flags` + migration + pg_notify triggers; UI /settings/flags pendente |
| Ops | Backup Postgres + drill | 1c | partial | scripts `backup-postgres.sh` + `restore-drill.sh` + `docs/ops/backup.md`; cron Portainer + drill em staging pendentes |
| Security | RBAC granular matriz + helpers | 1c | partial | `src/lib/rbac/` com 21 permissions × 5 roles + hasPermission/requirePermission; migração das Server Actions pendente |
| Ops | Sentry + OTel SDK | 1c | parity | instrumentation.ts + sentry.{server,client,edge}.config.ts + withSentryConfig; DSN opcional (no-op sem env) |
| CRM | Products + ProductPrice (multi-moeda) | 3 | parity | migration + 10-currency allowlist + Server Actions CRUD+prices + UI /products + i18n + seed 6×2 cat/company |
| Security | RBAC products:view/create/edit/delete | 3 | parity | matriz atualizada em src/lib/rbac/permissions.ts |
