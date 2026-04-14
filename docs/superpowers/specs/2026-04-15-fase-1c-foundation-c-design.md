# Spec: Fase 1c — Foundation C (plataforma ops)

**Data:** 2026-04-15
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda, ambos inline)
**Depende de:** Fase 1a (DS integrado), Fase 1b (consent LGPD).
**Gate para:** Fases 2, 3, 5, 6 — começam a cobrar observabilidade, feature-flag e RBAC granular desde o merge.

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **Escopo de OTel:** spans de request + Prisma **obrigatórios em 1c**; spans de BullMQ worker e fetch-client movidos para Fase 6 (onde worker passa a ter carga real). Evita sobrecarga de instrumentação em código ainda não exercitado.
- **Sentry config:** `tracesSampleRate=0` em produção até Fase 12 (cost guard); 1c entrega SDK + DSN + error capture, não traces. Profiling desativado.
- **Feature flags — persistência:** tabela PostgreSQL **single-source**. Redis cache 60s com invalidation via `pg_notify`. Descartado "flags em .env" (operação em runtime ≠ redeploy).
- **Backup:** script `pg_dump` + encrypt (age) + upload S3 via Portainer cron. Drill = script separado que faz `pg_restore` em DB ephemeral e roda suite smoke. Sem rollback pipeline nesta fase; DR completo em Fase 12.
- **RBAC matriz:** declarada em `src/lib/rbac/permissions.ts` (TypeScript const, type-checked). Não é tabela DB em 1c. Reason: evita fase de migração de role→permission map no momento em que Fases 2/3 ainda vão alterar a matriz. Em Fase 12, avaliar promover p/ DB.
- **Kill-switch vs flag:** `DS_V3_ENABLED` **não** migra pra tabela de flags em 1c. Permanece env. Motivo: DS requer rebuild para mudar. Flags DB servem apenas para código dinâmico.
- **Health endpoints:** `/api/health` é liveness (200 sempre se processo de pé); `/api/ready` checa DB + Redis + migration version. Worker tem `/healthz` no BullMQ dashboard (Fase 6).
- **Logs PII:** pino redactors configurados para `password`, `passwordHash`, `token`, `email` (parcial) — email só mostra `j**@**.com`.

### v1 → v2 (Review 1 ampla)
- Dividido 1c em 1c.0 (obs) / 1c.1 (flags) / 1c.2 (backup) / 1c.3 (RBAC) com aceite isolado.
- Removido "dashboard Grafana" do escopo — Grafana é infra shared, não deploy do CRM.
- Adicionado integração com audit-log já existente — não duplicar eventos.
- Lint rule `no-console-log` (proíbe `console.log/error/warn` em `src/**`, força uso de `logger`) entra em 1c.0.

---

## 1. Objetivo

1. **Observabilidade** — toda request tem `requestId`, logs estruturados (pino), tracing OTel para DB calls, erros capturados no Sentry.
2. **Feature flags em runtime** — habilitar/desabilitar funcionalidade em produção sem redeploy, com rollout por tenant.
3. **Backup automatizado** — dump criptografado diário + drill de restore verificado.
4. **RBAC granular** — permissões como `leads:create` / `companies:edit` / `settings:*` — map role×módulo×ação, consumido via `hasPermission(session, "<perm>")`.

## 2. Sub-fases

### 1c.0 — Observability
- pino logger central + redactor PII.
- `/api/health` (liveness) + `/api/ready` (readiness).
- Sentry SDK (capture only; no traces).
- OTel tracing para HTTP handler + Prisma.
- `requestId` header propagation (x-request-id, gerado se ausente).
- Lint rule `no-console-log`.

### 1c.1 — Feature flags
- Model `FeatureFlag`.
- Lib `getFlag(key, ctx)` com cache Redis 60s.
- UI em /settings para toggle (admin only).

### 1c.2 — Backup + Drill
- Script `scripts/ops/backup-postgres.sh` (pg_dump → gzip → age encrypt → S3 put).
- Script `scripts/ops/restore-drill.sh` (download → decrypt → gunzip → restore em DB ephemeral → smoke test).
- Portainer cron config documentada; secret management via Portainer env vars.

### 1c.3 — RBAC granular
- `src/lib/rbac/permissions.ts` — matriz TypeScript.
- Lib `hasPermission(session, perm)`.
- Wrap de Server Actions existentes que usam role check com permission check.
- Adicionar permission seed em roles default (super_admin=*, admin=most, manager=crm edit, seller=crm create+view_own).

## 3. Escopo

### 3.1. Observability

#### 3.1.1. Logger (pino)

`src/lib/logger.ts`:

```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "token",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  base: {
    service: "nexus-crm",
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
```

Adoção: todo `console.*` de `src/**` migra para `logger.*`. Lint rule força.

#### 3.1.2. Health/Ready

```ts
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}

// src/app/api/ready/route.ts
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
export async function GET() {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    getRedis().ping(),
  ]);
  const ok = checks.every((c) => c.status === "fulfilled");
  return Response.json(
    { status: ok ? "ready" : "degraded",
      db: checks[0].status, redis: checks[1].status,
      version: process.env.APP_VERSION ?? "unknown" },
    { status: ok ? 200 : 503 },
  );
}
```

#### 3.1.3. Sentry

- `sentry.server.config.ts` + `sentry.client.config.ts` via `@sentry/nextjs`.
- DSN via `SENTRY_DSN` env (opcional; se ausente, SDK no-op).
- `tracesSampleRate: 0` (capture de error apenas).
- Tags: `tenant_id` setada em middleware via `Sentry.setTag`.

#### 3.1.4. OTel

- `@opentelemetry/sdk-node` + `@opentelemetry/instrumentation-prisma` + `@opentelemetry/instrumentation-http`.
- Export: OTLP/HTTP para `OTEL_EXPORTER_OTLP_ENDPOINT` (opcional).
- Se env ausente, SDK inicializa mas não exporta.
- Fora do escopo 1c: tracing em BullMQ (Fase 6), fetch upstream (Fase 7).

#### 3.1.5. Lint rule `no-console-log`

Regra local em `eslint-rules/no-console-in-src.js`. Proíbe `console.*` em `src/**` exceto `src/generated/**`. Mensagem: "use `logger` de `@/lib/logger`".

### 3.2. Feature flags

#### 3.2.1. Schema

```prisma
model FeatureFlag {
  key         String   @id
  description String?
  enabled     Boolean  @default(false)
  rolloutPct  Int      @default(0)  // 0..100
  updatedAt   DateTime @updatedAt
  updatedBy   String?  @db.Uuid

  @@map("feature_flags")
}

model FeatureFlagOverride {
  id        String   @id @default(uuid()) @db.Uuid
  key       String
  scope     String   // 'company' | 'user'
  scopeId   String   @db.Uuid
  enabled   Boolean
  createdAt DateTime @default(now())

  @@unique([key, scope, scopeId])
  @@index([key, scope, scopeId], name: "idx_flag_override_lookup")
  @@map("feature_flag_overrides")
}
```

#### 3.2.2. Lib

```ts
// src/lib/flags.ts
export async function getFlag(
  key: string,
  ctx: { companyId?: string; userId?: string } = {},
): Promise<boolean>;

/** Admin UI: cria/atualiza flag. */
export async function setFlag(
  key: string,
  patch: { enabled?: boolean; rolloutPct?: number; description?: string },
  actor: { userId: string },
): Promise<void>;

export async function overrideFlag(
  key: string,
  scope: { scope: "company" | "user"; scopeId: string; enabled: boolean },
): Promise<void>;
```

Resolução (em ordem):
1. Override para `userId` — retorna.
2. Override para `companyId` — retorna.
3. `rolloutPct` via hash(`key:userId`) % 100 → retorna.
4. `enabled` global.

Cache: Redis `flag:<key>` TTL 60s; invalidação por `pg_notify("flags_changed", key)` + subscriber limpa cache do key.

#### 3.2.3. UI

`/settings` → aba "Feature Flags" (admin only). Tabela: key, descrição, enabled toggle, rolloutPct slider, "última atualização". Auditoria via `audit-log` módulo existente.

### 3.3. Backup

#### 3.3.1. `scripts/ops/backup-postgres.sh`

```sh
#!/usr/bin/env sh
set -euo pipefail
: "${DATABASE_URL:?}"; : "${BACKUP_S3_BUCKET:?}"; : "${BACKUP_AGE_RECIPIENT:?}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="/tmp/crm-$TS.sql.gz.age"

pg_dump --no-owner --no-privileges --format=custom "$DATABASE_URL" \
  | gzip -9 \
  | age -r "$BACKUP_AGE_RECIPIENT" \
  > "$FILE"

aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/crm/daily/crm-$TS.sql.gz.age" \
  --storage-class STANDARD_IA

rm -f "$FILE"
echo "backup ok: crm-$TS"
```

Rodado via Portainer cron (daily 03:00 UTC). Retention: 30 dias (lifecycle S3 rule, configurado fora do repo).

#### 3.3.2. Drill

`scripts/ops/restore-drill.sh` baixa o backup mais recente, restaura em DB ephemeral (docker), valida:
- `SELECT COUNT(*) FROM users` > 0.
- Migrations table reflete versão esperada.
- Smoke Playwright spec opcional.

Aceite 1c: drill roda com sucesso 1x em staging antes do tag `phase-1c-deployed`.

### 3.4. RBAC granular

#### 3.4.1. Matriz

`src/lib/rbac/permissions.ts`:

```ts
export const PERMISSIONS = [
  "leads:view", "leads:create", "leads:edit", "leads:delete",
  "contacts:view", "contacts:create", "contacts:edit", "contacts:delete",
  "opportunities:view", "opportunities:create", "opportunities:edit", "opportunities:delete",
  "companies:view", "companies:manage",
  "users:view", "users:manage",
  "settings:view", "settings:edit",
  "flags:manage",
  "audit:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<CompanyRole | PlatformRole, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: [/* tudo menos flags:manage e audit fora do tenant */],
  manager: ["leads:*", "contacts:*", "opportunities:*", "settings:view", "users:view"].flatMap(expandStar),
  seller: ["leads:view", "leads:create", "leads:edit", "contacts:view", "contacts:create", "opportunities:view", "opportunities:create"],
  viewer: ["leads:view", "contacts:view", "opportunities:view"],
};
```

#### 3.4.2. Helper

```ts
// src/lib/rbac/index.ts
import { ROLE_PERMISSIONS, type Permission } from "./permissions";
import { getCurrentUser } from "@/lib/auth";

export async function hasPermission(perm: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const role = user.platformRole ?? user.companyRole ?? "viewer";
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export async function requirePermission(perm: Permission): Promise<void> {
  if (!(await hasPermission(perm))) {
    throw new Error(`PERMISSION_DENIED:${perm}`);
  }
}
```

#### 3.4.3. Adoção

Cada Server Action existente em `src/lib/actions/**` que faz check de role ad-hoc passa a chamar `requirePermission("<perm>")` no topo. Diferencial importante: **não quebrar flows atuais** — roles hoje são `admin/manager/seller/viewer`; map inicial preserva comportamento.

Lint rule `no-ad-hoc-role-check` (soft/warn em 1c; error em Fase 12) sinaliza comparações `user.role === "admin"` fora de `src/lib/rbac/**`.

### 3.5. Fora de escopo

- Grafana dashboards (infra compartilhada).
- PagerDuty/alerting — configurado fora do repo (Fase 12 documenta).
- RBAC em tabela DB (permanece TypeScript const em 1c).
- Traces Sentry (custo; Fase 12 avalia).
- Tracing em BullMQ / fetch upstream (Fases 6/7).
- OAuth scope-based permissions (Fase 11b).

## 4. Arquitetura

```
┌────────────────────────────────────────────────────────────┐
│ src/middleware.ts                                          │ set requestId + Sentry tags
├────────────────────────────────────────────────────────────┤
│ src/lib/logger.ts     │ src/lib/rbac/       │ src/lib/flags.ts
│ pino + redactors      │ permissions matrix  │ DB + Redis cache
│                       │ hasPermission       │ pg_notify invalidator
├────────────────────────────────────────────────────────────┤
│ src/app/api/health    │ src/app/api/ready                  │
├────────────────────────────────────────────────────────────┤
│ sentry.{server,client}.config.ts   │ otel/instrumentation.ts│
├────────────────────────────────────────────────────────────┤
│ prisma/migrations/20260416000000_feature_flags/             │
│ prisma/migrations/20260416000001_...                        │
├────────────────────────────────────────────────────────────┤
│ scripts/ops/backup-postgres.sh  │ scripts/ops/restore-drill.sh│
├────────────────────────────────────────────────────────────┤
│ eslint-rules/no-console-in-src.js │ eslint-rules/no-ad-hoc-role-check.js
└────────────────────────────────────────────────────────────┘
```

### 4.1. Request lifecycle (pós-1c)

1. `middleware.ts` gera/propaga `x-request-id`.
2. OTel HTTP instrumentation cria span `http.server`.
3. Handler roda; `logger.child({ requestId })` para logs contextuais.
4. Prisma instrumentation cria spans `db.query`.
5. `hasPermission` é chamado no topo de cada action protegida.
6. Erros → `Sentry.captureException` (via Next error boundary) + log `level=error`.

## 5. Testes

### 5.1. Unit (vitest)
- `hasPermission`: cada role resolve conjunto correto.
- `getFlag`: override user > override company > rolloutPct > enabled global.
- `logger`: redactor funciona para `password`, `token`, `authorization`.
- ESLint rules: RuleTester valid/invalid.

### 5.2. Integração
- `/api/ready` retorna 503 quando DB down (simular via adapter mock).
- Flag set via `setFlag` invalida cache Redis (pg_notify → subscriber).
- Server Action bloqueada por `requirePermission` retorna erro `PERMISSION_DENIED:*`.

### 5.3. E2E (Playwright)
- Login como seller: navega /leads, consegue criar, **não** consegue deletar (permission deny).
- /api/health e /api/ready verificam status codes.
- Admin toggla flag em /settings/flags → feature liga dinamicamente.

### 5.4. Ops drill
- `restore-drill.sh` roda 1x em staging antes do tag — log anexo ao PR de 1c.2.

## 6. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Sentry/OTel endpoints em 1c sem receiver → logs perdidos | Médio | SDK no-op quando env ausente; deploy inicial sem endpoint é aceitável. |
| Feature flags DB como SPOF | Alto | Cache Redis 60s + fallback para `false` se DB down (conservative default). |
| RBAC quebra flows existentes | Alto | Map de `role → permissions` desenhado para preservar comportamento atual; suite E2E cobre golden paths por role. |
| Backup grande (>10GB) estoura pg_dump na janela cron | Médio | Habilitar `--jobs=4` em pg_dump parallel dump quando DB > 5GB. |
| Restore drill danifica DB staging | Alto | Drill **sempre** em DB ephemeral (docker), nunca em DB staging atual. |
| pg_notify não chega em todos os réplicas | Baixo | CRM roda 1 réplica em 1c; quando subir a 2, cache key TTL limita janela para 60s no pior caso. |
| `.env` vazar via Sentry capture | Muito alto | `beforeSend` scrubs qualquer objeto com key `DATABASE_URL`/`SECRET_*`. |
| Lint rule no-console quebra código legado | Médio | Rollout como warning por 1 PR; escalar para error em commit separado quando grep mostrar 0 ocorrências. |

## 7. Aceite

### 1c.0
- `curl http://app/api/health` → 200 `{status:"ok"}`.
- `curl http://app/api/ready` → 200 com `db:"fulfilled"`, `redis:"fulfilled"`.
- `logger.info({foo:1}, "msg")` emite JSON estruturado com `service: "nexus-crm"`.
- `grep -r "console\." src/ --include="*.ts*" -l | grep -v "generated\|rbac"` = 0.
- Sentry SDK carrega sem DSN sem crashar.
- OTel SDK carrega sem endpoint sem crashar.

### 1c.1
- Migration aplicada; `SELECT * FROM feature_flags` responde.
- `getFlag("DS_V4_ENABLED", { userId: "x" })` retorna boolean em < 50ms (cache hit).
- UI /settings/flags lista + toggle; audit log registra mudança.
- Flag override por tenant funciona em E2E.

### 1c.2
- Script `backup-postgres.sh` dry-run local gera arquivo `.age`.
- `restore-drill.sh` em staging conclui com smoke teste verde.
- Portainer cron registrado (documentado em `docs/ops/backup.md`).

### 1c.3
- Matrix `ROLE_PERMISSIONS` cobre todos os roles existentes.
- `hasPermission` cobertura unit ≥ 95%.
- Server Actions existentes migradas para `requirePermission`.
- E2E seller-golden-path verde (cria lead, bloqueado em delete).
- Lint `no-ad-hoc-role-check` ativa (warn).

### 1c geral
- Tag `phase-1c-deployed` em GHCR + Portainer rollout (ou manual registrado).
- Appendix A: 6+ linhas novas `parity` (obs, health, sentry, otel, flags, backup, rbac).
- 5+ memory files novos.

## 8. Rollback

Por sub-fase:
- 1c.0 — `git revert` do merge de logger/health/sentry. Código fica com `console.*`; aceitável temporariamente.
- 1c.1 — migration `down.sql` drop tabelas + `git revert`. Flag DB-based some; app ignora.
- 1c.2 — revert script. Cron Portainer apagado manual.
- 1c.3 — `git revert` do merge. `hasPermission` substituído pelos role checks anteriores (via git history).

Sem kill-switch runtime.

## 9. Convenção de commits

- `feat(crm): pino logger + redactor PII + lint rule no-console` (1c.0.a)
- `feat(crm): /api/health + /api/ready (db + redis checks)` (1c.0.b)
- `feat(crm): Sentry SDK (capture only; tracesSampleRate 0)` (1c.0.c)
- `feat(crm): OTel http + prisma instrumentation (no-op sem endpoint)` (1c.0.d)
- `feat(crm): feature flags (DB + Redis cache + pg_notify invalidation)` (1c.1.a)
- `feat(crm): /settings/flags admin UI` (1c.1.b)
- `ops(crm): scripts/ops/backup-postgres.sh + restore-drill.sh + docs` (1c.2)
- `feat(crm): rbac matriz + hasPermission + requirePermission` (1c.3.a)
- `refactor(crm): migrate server actions to requirePermission` (1c.3.b)
- `chore(crm): release fase 1c (tag phase-1c-deployed)` (final)

## 10. Dependências externas

- `pino` (~8), `@sentry/nextjs` (~8), `@opentelemetry/sdk-node`, `@opentelemetry/instrumentation-prisma`, `@opentelemetry/instrumentation-http`, `@opentelemetry/exporter-trace-otlp-http`.
- `age` binário (backup script) — instalado no Alpine via apk em Dockerfile do runner.
- `pg_dump`/`pg_restore` — já presentes no container db; script é rodado a partir do runner ops container (imagem base `postgres:16-alpine`).
- AWS CLI OU `s3cmd` — para upload backup. Preferir `aws s3` (ubíquo).
