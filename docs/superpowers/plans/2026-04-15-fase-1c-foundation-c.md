# Plan: Fase 1c — Foundation C (plataforma ops)

**Data:** 2026-04-15
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda, ambos inline)
**Spec:** `docs/superpowers/specs/2026-04-15-fase-1c-foundation-c-design.md` (v3)
**Repo:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin`

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **T-pino-adoption** movida para antes de T-sentry — logger precisa existir para Sentry beforeSend logar scrubbing events.
- **Migrations T-flags-schema** inclui o par de `feature_flags` + `feature_flag_overrides` em **uma migration só** — idempotência do deploy piorava se separadas.
- **T-otel** explícita sobre `instrumentation.ts` na raiz (Next 16 hook oficial).
- **T-rbac-adoption** dividida em 2: T-rbac-lib (novos helpers) + T-rbac-migrate (rewrap das Server Actions existentes). Reduz risco de regressão num único PR.
- **T-backup-drill** tem aceite "log anexo ao commit" — sem prova, não merge.
- Acrescentada T-lint-no-console-softrollout entre "rule implementada" e "rule error". Evita bloqueio total ao primeiro PR.

### v1 → v2 (Review 1 ampla)
- Adicionada `subagent_safe` em cada T.
- Tasks 1c.0 reordenadas para minimizar conflito de imports.
- Aceite `curl` / `grep` reproduzível em todas.

---

## Sequência de tasks

### 1c.0 — Observability

**T0a. `src/lib/logger.ts` (pino + redactors)**
- Export `logger` + `childLogger`.
- Unit test: `password` redacted, `token` redacted, `email` partial mask helper.
- **subagent_safe:** yes.
- **Aceite:** `vitest run src/lib/logger.test.ts` verde.

**T0b. Lint rule `no-console-in-src` (warn-first)**
- `eslint-rules/no-console-in-src.js` + RuleTester test.
- `eslint.config.mjs` registra como **warn** em 1c.0; mudança para `error` em T0c após grep=0.
- **subagent_safe:** yes.
- **Aceite:** `pnpm lint` mostra warns nos `console.*` existentes.

**T0c. Migrate all console.* → logger.***
- `grep -rE "console\.(log|error|warn|info|debug)" src/ --include="*.ts*"` lista, cada subagent pega 3-5 arquivos.
- Depois: promover rule para `error`.
- **subagent_safe:** yes (por arquivo).
- **Aceite:** `grep -r "console\." src/ --include="*.ts*" -l | grep -v "generated\|rbac"` = 0 + `pnpm lint` verde.

**T0d. `/api/health` + `/api/ready`**
- `src/app/api/health/route.ts` + `src/app/api/ready/route.ts`.
- Implementa checks DB (`$queryRaw SELECT 1`) + Redis (`ping()`).
- Adiciona `/api/health` e `/api/ready` à allowlist de middleware (pular auth).
- **subagent_safe:** yes.
- **Aceite:** `curl localhost:3000/api/health` 200; stop DB → `curl /api/ready` 503.

**T0e. Sentry (`@sentry/nextjs`)**
- `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts` + `next.config.ts` wrap com `withSentryConfig`.
- `SENTRY_DSN` opcional; `tracesSampleRate: 0`.
- `beforeSend`: scrub keys sensíveis (`DATABASE_URL`, `*_SECRET`, `password*`, `token*`).
- **subagent_safe:** no (toca `next.config.ts` + root).
- **Aceite:** sem DSN, app arranca normal; com DSN fake, error é tentado capturar (log local mostra).

**T0f. OpenTelemetry**
- `instrumentation.ts` na raiz — register SDK com instrumentações HTTP + Prisma.
- Exporter OTLP/HTTP condicional ao env.
- **subagent_safe:** no (root hook).
- **Aceite:** sem endpoint, SDK inicia sem erro; com fake endpoint, spans são criados em dev (log).

**T0g. Middleware `x-request-id` + Sentry tags**
- `src/middleware.ts` gera nanoid se header ausente; propaga.
- `Sentry.setTag("tenant_id", sessionCompanyId)` quando disponível.
- **Aceite:** response header `x-request-id` presente; logs carregam o mesmo id.

### 1c.1 — Feature flags

**T1a. Migration `feature_flags` + `feature_flag_overrides`**
- schema.prisma + `prisma/migrations/20260416000000_feature_flags/migration.sql` (+ `down.sql`).
- **Aceite:** `prisma validate` ok; SQL aplicável em DB test.

**T1b. Redis client**
- `src/lib/redis.ts` — singleton `ioredis` wrapper (já existe? senão criar).
- **Aceite:** `getRedis().ping()` resolve "PONG".

**T1c. Lib `src/lib/flags/*`**
- `getFlag`, `setFlag`, `overrideFlag`, hash determinístico (fnv1a) para rolloutPct.
- pg_notify trigger + subscriber que invalida cache.
- Unit tests cobrindo resolução (override user > company > rollout > global).
- **Aceite:** `vitest run src/lib/flags` cobre 6 cenários + coverage ≥ 90%.

**T1d. UI /settings/flags (ui-ux-pro-max)**
- Aba nova em settings com tabela: key, descrição, toggle, slider rolloutPct, updatedAt.
- Requer permission `flags:manage` (entregue em 1c.3, mas pode usar role admin interim).
- Audit log event on save.
- **Aceite:** E2E `flags-admin.spec.ts` cria/toggla flag, vê refletir em lib.

### 1c.2 — Backup + Drill

**T2a. `scripts/ops/backup-postgres.sh`**
- Script sh com set -euo pipefail; usa `pg_dump`, `gzip`, `age`, `aws s3 cp`.
- Dockerfile auxiliar em `docker/ops.Dockerfile` (postgres:16-alpine + age + aws-cli).
- **Aceite:** `./scripts/ops/backup-postgres.sh` em staging gera .age e upload S3 (teste com bucket throwaway).

**T2b. `scripts/ops/restore-drill.sh`**
- Script: baixa último .age, decrypt, gunzip, `pg_restore` em container ephemeral, roda smoke (COUNT queries).
- **Aceite:** drill completo com log de execução anexo ao commit final de 1c.2.

**T2c. `docs/ops/backup.md`**
- Setup Portainer cron + secrets (BACKUP_AGE_RECIPIENT, BACKUP_S3_BUCKET, AWS creds).
- Runbook de restore emergencial (manual).
- **Aceite:** commit do doc.

### 1c.3 — RBAC granular

**T3a. Matriz `src/lib/rbac/permissions.ts`**
- Const exportada + tipo `Permission`.
- `ROLE_PERMISSIONS` map para todos os roles.
- **Aceite:** `pnpm tsc --noEmit` valida tipos.

**T3b. Lib `src/lib/rbac/index.ts`**
- `hasPermission`, `requirePermission`, `getUserPermissions(user)`.
- Unit test cobertura ≥ 95%.
- **Aceite:** vitest verde.

**T3c. Migrate Server Actions p/ requirePermission**
- Subagents por arquivo: users, companies, leads, contacts, opportunities, settings, api-keys, notifications, password-reset, profile, search, dashboard.
- Mantém comportamento atual (map role→permission preserva).
- **subagent_safe:** yes (por arquivo).
- **Aceite:** E2E seller-golden-path verde (pode criar leads, não pode deletar).

**T3d. Lint rule `no-ad-hoc-role-check` (warn)**
- AST: `BinaryExpression` com `user.role === "..."` ou `===` contra literais de role.
- Escopo: exceto `src/lib/rbac/**`.
- **Aceite:** `pnpm lint` mostra warns nas comparações antigas.

### Fechamento

**Tz1. Atualiza memory**
- `observability_pipeline.md` — pino + sentry + otel + health
- `feature_flags_contract.md` — API de getFlag + resolução
- `backup_policy.md` — script + cron + retention
- `rbac_matrix.md` — ROLE_PERMISSIONS como fonte; como adicionar novo permission
- `project_crm_phase_status.md` — Fase 1c ✅

**Tz2. Roadmap Appendix A**
- 6+ linhas parity: observability, /api/health, sentry, otel, flags, backup, rbac.

**Tz3. Tag + deploy `phase-1c-deployed`**
- Commit final, tag, push.

---

## Ordem de execução

1. T0a (logger) — bloqueia tudo que loga.
2. T0b + T0c em paralelo (rule warn + migração).
3. T0d (health/ready) — independente.
4. T0e + T0f + T0g em paralelo (sentry/otel/middleware) após T0a.
5. T1a (migration) — independente de 1c.0.
6. T1b → T1c → T1d (flags lib → UI).
7. T2a + T2b + T2c em paralelo (backup + docs).
8. T3a → T3b → T3c → T3d (rbac).
9. Tz1, Tz2, Tz3 sequencial final.

Estimativa: 2-3 dias em paralelo; 1 semana serial.

## Convenção de commits

Conforme spec §9.

## Rollback

Conforme spec §8.

## Dependências externas

- npm: `pino@~8`, `@sentry/nextjs@~8`, `@opentelemetry/sdk-node`, `@opentelemetry/instrumentation-{http,prisma}`, `@opentelemetry/exporter-trace-otlp-http`, `ioredis` (já existe).
- Binaries (Dockerfile ops): `age`, `aws-cli`, `pg_dump` (base postgres:16-alpine).
- Infra: bucket S3 `<BACKUP_S3_BUCKET>` + chave age `<BACKUP_AGE_RECIPIENT>` — setup manual documentado em `docs/ops/backup.md`.
