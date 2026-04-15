# Plan v3 FINAL — Fase 5 Custom Attributes

**Status:** v3 FINAL (pós Review 2 — CR-1/CR-2/CR-3 + IM-1..IM-6 + S-1..S-7 endereçados)
**Spec:** `docs/superpowers/specs/2026-04-15-fase-5-custom-attributes-v3.md`
**Base:** plan v1 + deltas v2 + deltas v3 (este doc é o canônico; v1/v2 mantidos como histórico).

---

## Regras globais do plan (overrides)

1. **TDD por task:** cada task de impl (marcada **(TDD)**) invoca `Skill superpowers:test-driven-development` no prompt do subagent: red → green → refactor.
2. **Orquestrador subagent-driven-development:** invoca `Skill superpowers:subagent-driven-development` antes de despachar wave.
3. **Rollback:**
   - Tasks aditivas: `git revert <sha>`.
   - Migrations DB: `migration.down.sql` executado manual via `psql`.
   - UI: feature flag OFF.
   - Jobs: drain queue + `DROP INDEX CONCURRENTLY IF EXISTS <name>`.
4. **Commit strategy:** 1 commit por task (`feat(custom-attrs): T<N>/<TOTAL> — <slug>`), **sem** squash.
5. **Boilerplate do subagent prompt:** cada spawn inclui: TDD skill, quality gates (`npm run build`, `npx tsc --noEmit`, affected tests verde).

---

## Delta v2 → v3 (correções load-bearing)

### CR-1 — Cadeia delete purge→drop (orquestração explícita)

**T8b delete action:**
1. `requirePermission("custom-attributes:manage")`.
2. `prisma.customAttribute.update({ where: { id }, data: { status: "deleting" } })` — novo campo `status CustomAttributeStatus @default(active)` enum `{active, deleting}`. (**Atualiza T1 schema**.)
3. Se `def.isUnique`, `indexHandoff = true`, senão `false`.
4. Enqueue purge job com metadata `{ defId, companyId, entity, key, indexHandoff }`.
5. Retorna `{ success: true, data: { jobId } }`.

**Purge processor (T11) ao final:**
- `success` E `affectedRows >= 0`:
  - Se `indexHandoff === true`: enqueue `drop-unique-index` job.
  - Senão: enqueue `finalize-delete-def` (novo processor T11.5) que faz `prisma.customAttribute.delete({ where: { id: defId } })`.
- `failure` após 3 retries (BullMQ default): job vai para DLQ. Def permanece `status=deleting`. Pino logger emite `custom_attr.purge.failed_to_dlq` com alerta. Operator pode reenqueuar manualmente via script `scripts/ops/reenqueue-custom-attr-purge.ts` (T-OP nova task opcional).

**Drop-index processor (T10) ao final success:**
- Enqueue `finalize-delete-def` job.

**Regra:** `drop-index` NUNCA dispara sem confirmação de `purge success` (processor de purge é o único gate). Se drop-index falha (ex. index em uso por tenant ainda vigente), refcount continua e def não é deletada — ok, consistente.

**Audit trail (S-1):** 3 entries — `cust_attr.delete_initiated`, `cust_attr.purge_completed` (ou `.purge_failed_to_dlq`), `cust_attr.index_dropped` (ou `.index_retained_refcount` ou `.delete_finalized`).

### CR-2 — Worker registration em `src/lib/worker/index.ts` (não boot.ts)

**T9.0 corrigido:**
- Cada processor exporta `startXxxCustomAttrWorker(): Worker`.
- Novo arquivo `src/lib/worker/processors/custom-attr-create-index.ts` exporta `startCustomAttrCreateIndexWorker()`.
- Idem create-index, drop-index, purge-values, finalize-delete-def (4 workers total).
- **Editar** `src/lib/worker/index.ts`:
  - Imports das 4 funções.
  - No bloco de startup: chamar cada `startXxxCustomAttrWorker()` como os existentes.
  - No `shutdown` Promise.all: incluir os 4 worker handles.
  - No log `worker.startup.ready`: estender array `queues` com os 4 novos nomes.

**Aceite T9.0:**
- `pnpm run worker` ou `node dist/worker.js` inicia e loga `{queues: [...existentes, "custom-attr-create-index", "custom-attr-drop-index", "custom-attr-purge-values", "custom-attr-finalize-delete"]}`.
- Shutdown gracioso (SIGTERM) aguarda jobs em flight.

### CR-3 — T11 `$executeRaw` returns number

Snippet corrigido:
```typescript
const ALLOWED_TABLES = new Set(["leads", "contacts", "opportunities"] as const);
const KEY_REGEX = /^[a-z][a-z0-9_]{1,79}$/;

export async function purgeCustomAttrValues(job: Job<{ entity: string; key: string; companyId: string; defId: string; indexHandoff: boolean }>) {
  const { entity, key, companyId, defId, indexHandoff } = job.data;
  if (!KEY_REGEX.test(key)) throw new Error(`invalid key: ${key}`);
  const tableName = `${entity}s`;
  if (!ALLOWED_TABLES.has(tableName as any)) throw new Error(`invalid entity: ${entity}`);

  let totalPurged = 0;
  while (true) {
    const affected: number = await prisma.$executeRaw`
      UPDATE ${Prisma.raw(tableName)}
      SET custom = custom - ${key}
      WHERE id IN (
        SELECT id FROM ${Prisma.raw(tableName)}
        WHERE company_id = ${companyId}::uuid AND custom ? ${key}
        LIMIT 500
      )
    `;
    if (affected === 0) break;
    totalPurged += affected;
    await job.updateProgress({ purged: totalPurged });
  }

  // chain
  if (indexHandoff) {
    await dropIndexQueue.add(`drop-${entity}-${key}`, { entity, key, defId }, {
      jobId: `di:${entity}:${key}`
    });
  } else {
    await finalizeDeleteQueue.add(`finalize-${defId}`, { defId }, {
      jobId: `fd:${defId}`
    });
  }

  return { totalPurged };
}
```

**Aceite T11 atualizado:**
- `affected` é `number` (compile ok).
- `KEY_REGEX` e `ALLOWED_TABLES` impedem SQL injection antes do `Prisma.raw`.
- Job idempotency key `purge:<entity>:<key>:<companyId>`.
- Retomável: kill pod → retomar → zero rows puladas/duplicadas.
- Performance target: 1M rows em <10min (2000 × 500 × ~300ms por batch).

### IM-4 — DIRECT_URL propagation

**Tasks novas:**
- **T1.5** (entre T1 e T2): atualizar `prisma/schema.prisma`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- **T1.6:** append em `.env.example`:
  ```
  # Usado por migrations e CREATE INDEX CONCURRENTLY quando DATABASE_URL passa por pgBouncer.
  # Pode ficar vazio em dev local (fallback para DATABASE_URL).
  DIRECT_URL=
  ```
- Documentar no runbook `docs/ops/database.md` (criar se não existir): "se pgBouncer for introduzido, configurar DIRECT_URL bypass".

**T9/T10 (create/drop index):** usam `new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })`. Loga aviso quando cai no fallback.

### S-7 — Refcount 2→1→0 cobertura

**T21 adiciona teste dedicado:**
- Tenant A habilita `isUnique:true` em `mrr` → index criado, refCount=1.
- Tenant B habilita `isUnique:true` em `mrr` → index preexistente, refCount=2.
- Tenant B desabilita → refCount=1, index permanece.
- Tenant A desabilita → refCount=0, `DROP INDEX CONCURRENTLY` executa, ref row deletada.
- Verificação: `SELECT * FROM pg_indexes WHERE indexname LIKE 'idx_%_custom_mrr_unique'` retorna 0 rows após drop.

### IM-1 — TDD boilerplate no subagent prompt

Task **T-1** (meta, não-código): definir template string do prompt de subagent de impl:
```
Você é subagent de implementação da Fase 5 Custom Attributes.

Passos obrigatórios:
1. Invoque Skill superpowers:test-driven-development.
2. Leia <spec_path> e <task_details>.
3. Red: escreva teste(s) falhando cobrindo o aceite.
4. Green: implemente o mínimo para passar.
5. Refactor: limpeza sem quebrar testes.
6. Verifique `npx tsc --noEmit` + `npx vitest run <test-path>` limpos.
7. Commit única: feat(custom-attrs): T<N>/<TOTAL> — <slug>.

NÃO modifique arquivos fora dos listados em <files>.
NÃO pule os testes.
Retorne diff aplicado + output dos comandos.
```
Orquestrador usa este template ao spawnar cada subagent.

### IM-2 — Wave C não modifica T13a/T13b

Regra explícita no grafo:
- T15/T16/T17 só **consomem** `<CustomFieldsSection>` (T13a) e `<CustomColumnsRenderer>` (T13b).
- Se Wave C detectar bug em T13a/T13b, abre task separada pós-wave (não edita paralelamente).

### IM-3 — P2002 parser util

Novo arquivo `src/lib/custom-attributes/p2002-parser.ts`:
```typescript
// Extrai {entity, key} do error.meta.target quando index = idx_<entity>_custom_<key>_unique
export function parseP2002IndexName(err: Prisma.PrismaClientKnownRequestError): { entity: string; key: string } | null;
```
Usado em T15/T16/T17 `catch` de createLead/updateLead para mapear ao label via `listCustomAttributes`.

### IM-6 — T21 CONCURRENTLY skip em CI

`T21.concurrent-index-under-load.integration.test.ts` usa `describe.skipIf(process.env.CI_SKIP_HEAVY === "true")`. CI GH Actions default roda; `CI_SKIP_HEAVY=true` no workflow de PR flaky. Staging E2E sempre roda.

---

## Grafo v3 (completo)

```
T0 baseline (vitest/build/lint + gravar número)
 └─ T1 schema+migration (edit schema → create-only → append SQL manual)
     └─ T1.5 datasource directUrl
         └─ T1.6 .env.example + runbook
             ├─ T2 rbac permissions
             ├─ T12 flag seed (prisma/seed.ts append ou create)
             └─ T3 types+limits
                 └─ T3.5 index-naming util
                     ├─ T4 validator (TDD)
                     ├─ T5 query-builder (TDD)
                     └─ T6 custom-parser (TDD, +underscore regression)
                         └─ T7 list cached (TDD)
                             ├─ T8a list/get/create action (TDD, audit diff-keys)
                             ├─ T8c reorder action (TDD)
                             ├─ T9.0 queue registration em src/lib/worker/index.ts
                             │   ├─ T9 create-index processor (TDD, DIRECT_URL)
                             │   ├─ T10 drop-index processor (TDD, refcount)
                             │   ├─ T11 purge-values processor (TDD, chain)
                             │   └─ T11.5 finalize-delete-def processor (TDD)
                             ├─ T13a CustomFieldInput + Section (TDD + ui-ux-pro-max)
                             ├─ T13b CustomColumnsRenderer (TDD)
                             ├─ T13c CustomFiltersSection (TDD)
                             └─ T-P2002 parseP2002IndexName util (TDD)
T8a + T-P2002 → T8b update/delete action (TDD, chain orchestration)
T7+T8a+T8b+T13a+T13b → T14 settings UI (ui-ux-pro-max, flag 404 test)
T4+T5+T7+T8a+T13a+T13b+T-P2002 → T15 leads integration
                                ├─ T16 contacts integration
                                └─ T17 opportunities integration (Wave C)
T13c → T18 filter-bar extension (customFilters prop)
T7 → T19 DSAR + logger PII (TDD)
T4..T19 → T20 unit tests (≥45)
T8..T11 + T15..T18 → T21 integration tests (+refcount 2→1→0 + CONCURRENTLY CI_SKIP)
T14..T18 → T22 E2E tests
T20+T21+T22 → T23 build+lint+audit+migrate status+diff --exit-code
T23 → T24 docs HANDOFF + memórias
T24 → T25 commits já em série (1 por task) + push + CI monitor
T25 → T26 tag phase-5-deployed
```

**Total: 34 tasks** (T0, T1, T1.5, T1.6, T2, T3, T3.5, T4–T7, T8a, T8b, T8c, T9.0, T9, T10, T11, T11.5, T12, T13a, T13b, T13c, T-P2002, T-1 (meta), T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26).

---

## Ordem de execução autônoma (subagent-driven-development)

**Wave 0 (serial — foundation):** T0 → T1 → T1.5 → T1.6 → T2 → T12 → T3 → T3.5.
**Wave A (3 subagents paralelos):** T4, T5, T6.
**Join → Wave A.5 (serial):** T7.
**Wave B (6 subagents paralelos):** T8a, T8c, T9.0, T13a, T13b, T13c, T-P2002.
**Wave B.5 (3 subagents paralelos):** T9, T10, T11, T11.5 (4 paralelos, dependem de T9.0).
**Wave B.7 (serial):** T8b (depende de T8a + T-P2002 + jobs).
**Wave C (3 subagents paralelos):** T15, T16, T17.
**Wave D (3 subagents paralelos):** T14, T18, T19.
**Wave E (3 subagents paralelos):** T20, T21, T22.
**Wave F (serial ship):** T23 → T24 → T25 → T26.

**Duração estimada autônoma:** ~4h (com paralelismo agressivo).

---

## Critério de aceite global do plan

Todas as tasks executadas sem críticos; spec v3 §7 critérios de sucesso atendidos; 464→500+ Vitest verde; `npm run build` verde; `npm audit` 0 high/critical; feature flag OFF preservado (não ativa prod); tag `phase-5-deployed` criada.

## Veredito plan v3

**Aprovado internamente** após consolidação CR-1/CR-2/CR-3 + IM-1..IM-6 + S-1/S-4/S-5/S-6/S-7. Pronto para execução via `superpowers:subagent-driven-development`.
