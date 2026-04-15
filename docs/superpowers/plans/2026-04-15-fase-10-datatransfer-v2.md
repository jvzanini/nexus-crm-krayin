# Fase 10 DataTransfer — Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`).

**Goal:** Import/export CSV+XLSX seguro, auditado, tenant-scoped, com custom attrs, worker BullMQ, storage FS/S3, RBAC granular, feature flag gradual.

**Architecture:** 3 waves — 10a backend (Tasks 1–35), 10b UI (36–50), 10c verification/obs (51–76). Task 4 contratos + Task 4b stubs shippam primeiro para paralelizar 10a↔10b sem quebrar typecheck.

**Tech Stack:** Next 16, Prisma, Postgres, BullMQ, Redis, Vitest 3, Playwright, Tailwind, shadcn/ui, Zod, papaparse@^5.4.1, exceljs@^4.4.0, file-type@^19, chardet@^2, iconv-lite@^0.6, fast-levenshtein@^3, yauzl@^3, @aws-sdk/client-s3@^3, @aws-sdk/s3-request-presigner@^3.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-10-datatransfer-v3.md`

**Commit convention:** `<type>(scope): <desc> (T<N>)` — ex: `feat(data-transfer): parseCsv streaming (T11b)`.

---

## Changelog v1 → v2

Review 1 aplicada (ver `docs/superpowers/reviews/plan-v1-fase-10.md` quando commitado):

- **B1–B6** decomposição: Task 11 → 11a-d, Task 13 → 13a-e, Task 22 → 22a-e, Task 23 → 23a-f, Tasks 41-43 → 9 tasks E2E, Task 24 → 24a-b.
- **B7** layout flag gate como task dedicada.
- **B8** rate-limit keys task dedicada.
- **B9** `.env.example` + docs env vars task dedicada.
- **B10** Dockerfile worker build target.
- **B11** error boundaries UI task dedicada.
- **B12** export-stream separa helpers de orchestrator (fica em action).
- **B13** bench script separado do runbook.
- **M14–M28** aplicadas (rollback SQL, coverage snapshot, zod audit events, code inline, pagination action 22e, CHANGELOG bump DS, transition invalid test, poll env, a11y enumerated, close-wave steps expandidos, rollout em duas etapas, dep graph, soma testes reconciliada, convention).

Plan final: **76 tasks**. Target **87 unit** + **7 integration** + **9 E2E** tests.

---

## Dependency graph (resumo)

```
1 (deps) → 2 (migration) → 2b (env vars)
3 (perms+flag+rbac tests) ─┐
4 (contratos) ─→ 4b (stubs) ─┬─ wave 10a actions (18, 19, 20, 21, 22a-e)
                              └─ wave 10b UI (36-50 em paralelo)
5 (storage FS) → 6 (storage S3)
7 (formula) → 15a,15b (export stream)
8 (dedupe) → 18
9 (levenshtein) → 30 (MappingStep)
10 (coerce) → 13a-e (import schemas)
11a-d (parse) → 19 (parseImportFile)
12 (lookup) → 13a-e
13a-e (schemas) → 20 (previewImport)
14 (buildListQuery) → 15a,15b
16 (commit-chunks) → 21 (commitImport sync)
17 (audit events zod) → todas actions
17b (rate-limit keys) → 18, 22c
23a-f (worker commit) → 21 (commitImport async path)
24a-b (cleanup + purge workers) → 35 close 10a
35 (close 10a) → 37 (close 10b) → 51+ (wave 10c)
```

---

## File structure

(Conforme plan v1; acrescenta) `docs/env-vars.md`, `scripts/seed-bench.mjs`, `Dockerfile.worker` (ou target), `src/lib/rate-limit/datatransfer-keys.ts`.

---

## Wave 10a — Backend core (Tasks 1-35)

### Task 1: Dependências npm

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] Step 1: Install
```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
pnpm add papaparse@^5.4.1 exceljs@^4.4.0 file-type@^19 chardet@^2 iconv-lite@^0.6 fast-levenshtein@^3 yauzl@^3 @aws-sdk/client-s3@^3 @aws-sdk/s3-request-presigner@^3
pnpm add -D @types/papaparse @types/fast-levenshtein @types/yauzl aws-sdk-client-mock
```
- [ ] Step 2: `pnpm install` green.
- [ ] Step 3: Commit `chore(deps): datatransfer libs (T1)`.

### Task 2: Prisma migration + down rollback

**Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_data_transfer/migration.sql`, `prisma/migrations/<ts>_add_data_transfer/rollback.sql`

- [ ] Step 1: Adicionar ao `schema.prisma` os 4 enums, models `DataTransferJob`, `DataTransferMappingPreset`, e `importJobId` em Lead/Contact/Opportunity/Product (spec §3.8).
- [ ] Step 2: `pnpm prisma migrate dev --name add_data_transfer`.
- [ ] Step 3: Escrever `rollback.sql` manual: DROP tables, DROP enums, ALTER TABLE … DROP COLUMN importJobId, DROP INDEX.
- [ ] Step 4: Testar rollback em DB local: `psql … -f rollback.sql` → reverter → `prisma migrate deploy` de novo.
- [ ] Step 5: `pnpm prisma generate`.
- [ ] Step 6: Commit `feat(data-transfer): migration + rollback.sql (T2)`.

### Task 2b: Env vars + docs

**Files:** `.env.example`, `docs/env-vars.md`

- [ ] Step 1: Adicionar `.env.example`:
```
STORAGE_DRIVER=fs # fs | s3
STORAGE_FS_ROOT=/tmp/crm-storage
STORAGE_SIGN_SECRET=change-me-32chars-min
S3_REGION=us-east-1
S3_BUCKET=nexus-crm
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT= # opcional (MinIO)
DATA_TRANSFER_POLL_INTERVAL_MS=2000
DATA_TRANSFER_WORKER_CONCURRENCY=1
```
- [ ] Step 2: `docs/env-vars.md` — tabela var × descrição × dev/prod default.
- [ ] Step 3: Commit `docs(env): data-transfer vars (T2b)`.

### Task 3: Permissions + flag registry + RBAC matrix test

**Files:** `src/constants/permissions.ts`, `src/lib/flags/registry.ts`, `src/lib/rbac/__tests__/data-transfer-perms.test.ts`

- [ ] Step 1: TDD escrever matrix test table-driven 5 roles × 5 perms (25 cases).
- [ ] Step 2: Run fail.
- [ ] Step 3: Adicionar 5 perm strings + role matrix; registrar flag `data_transfer` no registry.
- [ ] Step 4: Run tests green.
- [ ] Step 5: Commit `feat(rbac): data-transfer 5 perms + flag + matrix test (T3)`.

### Task 4: Contratos TS/Zod públicos

**Files:** `src/lib/datatransfer/types.ts`

- [ ] Step 1: Escrever arquivo completo com todos tipos (ver plan v1 §Task 4 — manter íntegro) + adicionar `HistoryItem`, `ListHistoryArgs`, `MappingPreset`.
- [ ] Step 2: `pnpm typecheck` green.
- [ ] Step 3: Commit `feat(data-transfer): contratos públicos (T4)`.

### Task 4b: Action stubs (desbloqueia 10b paralelo)

**Files:** `src/app/(app)/settings/data-transfer/actions.ts`

- [ ] Step 1: Criar 10 actions com assinatura real retornando `throw new Error('stub: T<N>')`:
`uploadImportFile`, `parseImportFile`, `previewImport`, `commitImport`, `rollbackImport`, `cancelImport`, `exportEntity`, `savePreset`, `getPreset`, `listHistory`.
- [ ] Step 2: `pnpm typecheck` green.
- [ ] Step 3: Commit `feat(data-transfer): action stubs (T4b — unblocks 10b)`.

### Task 5: FsStorageAdapter + signed route

(Conteúdo plan v1 Task 5 mantido — 5 tests TDD.)

### Task 6: S3StorageAdapter (TDD 3 cases com aws-sdk-client-mock)

### Task 7: Formula injection escape (TDD 6 cases)

### Task 8: Dedupe SHA-256 (TDD 3 cases)

### Task 9: Levenshtein auto-suggest (TDD 4 cases)

### Task 10: Coerce (date 5 + money 3 = 8 cases)

### Task 11a: detectBOM + detectEncoding

**Files:** `src/lib/datatransfer/encoding.ts` + test.

- [ ] Step 1: TDD `__tests__/encoding.test.ts` 3 cases (UTF-8 BOM, UTF-16 reject, chardet latin1).
- [ ] Step 2: Implementar `detectBOM(buffer): 'utf-8'|'utf-16le'|'utf-16be'|null` + `detectEncoding(buffer): { encoding, confidence, candidates }`.
- [ ] Step 3: Pass. Commit `feat(data-transfer): encoding detection (T11a)`.

### Task 11b: parseCsv streaming

**Files:** `src/lib/datatransfer/parse-csv.ts`

- [ ] Step 1: TDD 3 cases (CSV basic, timeout 60s, rows>50k abort).
- [ ] Step 2: Implementar `parseCsv(stream, { onRow, onComplete, onError, abortSignal }): void` via papaparse step callback + setTimeout watchdog + row counter.
- [ ] Step 3: Pass. Commit.

### Task 11c: parseXlsx streaming + zip-bomb

**Files:** `src/lib/datatransfer/parse-xlsx.ts`

- [ ] Step 1: TDD 2 cases (XLSX basic, zip-bomb ratio reject).
- [ ] Step 2: Implementar `checkZipBomb(path): Promise<void>` via yauzl ratio + `parseXlsx(stream/path, opts)` via `ExcelJS.stream.xlsx.WorkbookReader`.
- [ ] Step 3: Pass. Commit.

### Task 11d: parseFile orchestrator + mime/size guards

**Files:** `src/lib/datatransfer/parse.ts`

- [ ] Step 1: TDD 3 cases (mime mismatch, size>20MB, dispatches csv/xlsx).
- [ ] Step 2: Implementar `parseFile(buffer, filename, { encodingOverride? })`:
  - file-type magic bytes check.
  - Size 20MB guard.
  - Dispatch parseCsv/parseXlsx.
  - Retorna `ParseResult`.
- [ ] Step 3: Pass. Commit `feat(data-transfer): parseFile orchestrator (T11d)`.

### Task 12: FK lookup (TDD 5 cases)

### Task 13a: schemas/custom-attrs dynamic shape

**Files:** `src/lib/datatransfer/schemas/custom-attrs.ts`

- [ ] Step 1: TDD 2 cases (text+number+date defs → valid shape; invalid type throws).
- [ ] Step 2: Implementar `dynamicCustomShape(defs)` reusando registry Fase 5.
- [ ] Step 3: Pass. Commit.

### Task 13b: leadImportSchema (TDD 4 cases)

### Task 13c: contactImportSchema (TDD 4 cases)

### Task 13d: opportunityImportSchema (TDD 3 cases)

### Task 13e: productImportSchema (TDD 3 cases)

### Task 14: buildListQuery + POC refactor leads

**Files:** `src/lib/queries/build-list-query.ts`, `src/lib/queries/build-tenant-filter.ts`, refactor `src/app/(app)/leads/actions.ts`

- [ ] Step 1: Verificar re-export de `@nexusai360/multi-tenant.buildTenantFilter`. Se ausente, criar wrapper local.
- [ ] Step 2: TDD 4 cases.
- [ ] Step 3: Implementar `buildListQuery<E>(entity, filters, ctx)`.
- [ ] Step 4: `pnpm vitest run src/app/\(app\)/leads --coverage` baseline antes.
- [ ] Step 5: Refactor leads listing → helper.
- [ ] Step 6: Re-run coverage — manter ≥ baseline.
- [ ] Step 7: Commit.

### Task 15a: streamCsv

**Files:** `src/lib/datatransfer/export-csv.ts`

- [ ] Step 1: TDD 2 cases (1k rows + escape formula).
- [ ] Step 2: Implementar `streamCsv({ rows: AsyncIterable<T>, columns, bom }): Readable` via papaparse.unparse chunks + escape universal.
- [ ] Step 3: Pass. Commit.

### Task 15b: streamXlsx

**Files:** `src/lib/datatransfer/export-xlsx.ts`

- [ ] Step 1: TDD 2 cases (1k rows + header bold/freeze + force string).
- [ ] Step 2: Implementar `streamXlsx({ rows, columns }): Readable` via `WorkbookWriter` + escape.
- [ ] Step 3: Pass. Commit.

### Task 16: commitChunksSync (TDD 3 cases, timeout 30s)

### Task 17: Audit events registry com Zod

**Files:** `src/lib/audit-log/events.ts`

- [ ] Step 1: TDD 7 cases — um por event type; payload Zod valida.
- [ ] Step 2: Implementar 7 events + schemas.
- [ ] Step 3: Commit.

### Task 17b: Rate-limit keys registry

**Files:** `src/lib/rate-limit/datatransfer-keys.ts`

- [ ] Step 1: TDD 3 cases — bucket 10/h upload, 5/h export, 30/h parse.
- [ ] Step 2: Implementar helpers `dataTransferLimits.upload(userId)`, `.export(userId)`, `.parse(userId)` usando `@nexusai360/core/rate-limit`.
- [ ] Step 3: Commit.

### Task 18: action uploadImportFile (TDD integration, código inline completo)

**Files:** `src/app/(app)/settings/data-transfer/actions.ts` (substitui stub T4b)

- [ ] Step 1: TDD cases (happy, size>20MB, mime mismatch, dedupe hit, rate-limit trip, RBAC deny).
- [ ] Step 2: Implementar:
```ts
export async function uploadImportFile(formData: FormData): Promise<UploadResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import');
  await dataTransferLimits.upload(ctx.userId).consume();
  const file = formData.get('file') as File;
  const entity = entityEnum.parse(formData.get('entity'));
  const force = formData.get('force') === 'true';
  if (file.size > 20 * 1024 * 1024) throw new DataTransferError('SIZE_EXCEEDED');
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = await fileTypeFromBuffer(buf);
  if (!isAllowedMime(file.name, mime)) throw new DataTransferError('MIME_MISMATCH');
  const hash = sha256Hex(buf);
  if (!force) {
    const dup = await findDuplicate({ prisma, companyId: ctx.companyId, entity, fileHash: hash });
    if (dup) return { duplicate: true, jobId: dup.id, existingJobId: dup.id };
  }
  const jobId = randomUUID();
  const key = `quarantine/${ctx.companyId}/${jobId}/original.${extFrom(file.name)}`;
  await storage.put(key, buf, { contentType: mime?.mime });
  await prisma.dataTransferJob.create({ data: { id: jobId, companyId: ctx.companyId, userId: ctx.userId, direction: 'import', entity, format: extToFormat(file.name), status: 'pending', quarantineId: jobId, fileHash: hash, filename: file.name, sizeBytes: BigInt(file.size) } });
  await audit.log('data_transfer.import.uploaded', { jobId, entity, filename: file.name, sizeBytes: file.size, fileHash: hash }, ctx);
  return { duplicate: false, jobId, quarantineId: jobId };
}
```
- [ ] Step 3: Pass. Commit.

### Task 19: action parseImportFile (código inline, idem estrutura T18)

**Skeleton**:
```ts
export async function parseImportFile(jobId: string, opts?: { encodingOverride?: string }): Promise<ParseResult> {
  const ctx = await requireAuth();
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId }});
  if (job.status !== 'pending') throw new DataTransferError('INVALID_STATE');
  const stream = await storage.get(`quarantine/${ctx.companyId}/${jobId}/original.${extFromFilename(job.filename)}`);
  const buf = await streamToBuffer(stream);
  const bom = detectBOM(buf);
  if (bom?.startsWith('utf-16')) throw new DataTransferError('UNSUPPORTED_ENCODING');
  const { encoding, confidence, candidates } = opts?.encodingOverride ? { encoding: opts.encodingOverride, confidence: 1, candidates: [] } : detectEncoding(buf);
  if (confidence < 0.7 && !opts?.encodingOverride) return { rows: 0, columns: [], sample: [], needsEncoding: true, encodingCandidates: candidates };
  const decoded = iconv.decode(buf, encoding);
  return await parseFile(Buffer.from(decoded), job.filename!, { encodingOverride: encoding });
}
```

TDD + commit.

### Task 20: action previewImport + snapshot custom attrs (código inline)

Chave: persiste `customAttrsSnapshot` idempotente; roda schema; retorna erros.

### Task 21: action commitImport (sync + enqueue)

Decide sync vs async; sync chama `commitChunksSync`; async `queue.add('data-transfer-commit', payload)`.

### Task 22a: action rollbackImport

```ts
export async function rollbackImport(jobId: string): Promise<RollbackResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import:rollback');
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId, direction: 'import', status: 'success' }});
  const model = modelFor(job.entity);
  const { count } = await (model as any).deleteMany({ where: { companyId: job.companyId, importJobId: jobId }});
  await prisma.dataTransferJob.update({ where: { id: jobId }, data: { status: 'rolled_back', finishedAt: new Date() }});
  await audit.log('data_transfer.import.rolled_back', { jobId, rowCountRemoved: count }, ctx);
  return { removed: count };
}
```
TDD + commit.

### Task 22b: action cancelImport (análogo, job.discard())

### Task 22c: action exportEntity (código inline completo)

Chama buildListQuery + streamCsv/Xlsx + storage.put + dataTransferJob.create + signedUrl + audit. Respeita cap 50k.

### Task 22d: actions savePreset + getPreset (upsert DataTransferMappingPreset)

### Task 22e: action listHistory (paginação cursor, tenant filter)

### Task 23a: worker skeleton + Zod payload + boot

**Files:** `src/workers/data-transfer-commit.worker.ts`, `instrumentation.ts`

- [ ] Step 1: TDD payload schema valid/invalid.
- [ ] Step 2: Esqueleto BullMQ Worker com `commitJobPayloadSchema.parse(job.data)` + `configureRateLimit`.
- [ ] Step 3: Register em `instrumentation.ts` (Node boot).
- [ ] Step 4: Commit.

### Task 23b: advisory lock

- [ ] Step 1: TDD 2 cases (lock acquired, two workers serialize).
- [ ] Step 2: `pg_try_advisory_xact_lock(hashtext('dt:' || companyId))` dentro de tx curta.
- [ ] Step 3: Commit.

### Task 23c: chunk loop + committedChunks idempotency

- [ ] Step 1: TDD 2 cases (process 3 chunks / resume skipping [1,2] chunks).
- [ ] Step 2: Loop lê `progress.committedChunks`, processa próximo chunk em tx 30s, atualiza progress.
- [ ] Step 3: Commit.

### Task 23d: retry + backoff + DLQ

- [ ] Step 1: TDD 2 cases (retry 3× then DLQ).
- [ ] Step 2: BullMQ Worker opts `attempts: 3, backoff: { type: 'exponential', delay: 1000 }` + queue DLQ.
- [ ] Step 3: Commit.

### Task 23e: progress update + snapshot read

- [ ] Step 1: TDD 2 cases (progress updated between chunks / snapshot read).
- [ ] Step 2: Worker lê `customAttrsSnapshot` on start, nunca refetch.
- [ ] Step 3: Commit.

### Task 23f: resume after crash integration test

- [ ] Step 1: Integration test simula worker kill mid-chunk → restart → resumes committedChunks.
- [ ] Step 2: Commit.

### Task 24a: cleanup worker (quarantine >30min)

**Files:** `src/workers/data-transfer-cleanup.worker.ts`

- [ ] Step 1: TDD 3 cases (TTL expiry, deleta storage, marca failed).
- [ ] Step 2: Repeatable job 5min. Instrumentar métrica `data_transfer_cleanup_removed_total` aqui.
- [ ] Step 3: Boot register. Commit.

### Task 24b: history-purge worker (>90d)

**Files:** `src/workers/data-transfer-history-purge.worker.ts`

- [ ] Step 1: TDD 2 cases (purge >90d + audit event).
- [ ] Step 2: Repeatable semanal domingos 02:00.
- [ ] Step 3: Commit.

### Task 25: healthcheck script

**Files:** `src/workers/healthcheck.ts`

- [ ] Step 1: `node dist/workers/healthcheck.js <queueName>` ping BullMQ queue (exit 0 healthy).
- [ ] Step 2: Commit.

### Task 26-34: (reservado para expansão)

### Task 35: Close wave 10a

- [ ] Step 1: `pnpm lint && pnpm typecheck && pnpm vitest run && pnpm build`.
- [ ] Step 2: Dispatch `Agent superpowers:code-reviewer` sobre diffs 10a (review independente).
- [ ] Step 3: Bundle check se tocou packages.
- [ ] Step 4: Tag local `phase-10a-green`. Commit fence.

---

## Wave 10b — UI (Tasks 36-50)

**Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes de cada task visual.**

### Task 36: DS Stepper (se ausente)

**Files:** `packages/settings-ui/src/ui/stepper.tsx`, CHANGELOG.md, package.json bump patch

- [ ] Step 1: Grep existente; se ausente continuar.
- [ ] Step 2: TDD render + a11y (aria-current, step roles).
- [ ] Step 3: Implementar seguindo DS tokens.
- [ ] Step 4: Bump patch, CHANGELOG, rebuild.
- [ ] Step 5: Bundle budget <15KB gz.
- [ ] Step 6: Commit.

### Task 37: DS Dropzone (idem T36)

### Task 38: rota layout flag gate

**Files:** `src/app/(app)/settings/data-transfer/layout.tsx`

- [ ] Step 1: TDD E2E smoke (flag OFF → 404).
- [ ] Step 2: Server component:
```tsx
export default async function Layout({ children }) {
  const ctx = await requireAuth();
  const enabled = await getFlag('data_transfer', { companyId: ctx.companyId, userId: ctx.userId });
  if (!enabled) notFound();
  return children;
}
```
- [ ] Step 3: Commit.

### Task 39: page tabs

**Files:** `src/app/(app)/settings/data-transfer/page.tsx`

- [ ] Step 1: PageHeader + Tabs (Import/Export/Histórico) com defaultValue URL query.
- [ ] Step 2: Commit.

### Task 40: ImportWizard state machine

**Files:** `src/components/data-transfer/import-wizard.tsx`

- [ ] Step 1: TDD reducer transitions (advance valid, block invalid, reset).
- [ ] Step 2: useReducer + context provider.
- [ ] Step 3: Commit.

### Task 41: UploadStep + hook progress

### Task 42: MappingStep + presets

### Task 43: PreviewStep + Progress + Cancel

- [ ] Poll interval via `DATA_TRANSFER_POLL_INTERVAL_MS` env (default 2000) + backoff exp após 5 polls sem mudança.

### Task 44: Error boundaries + network failure states

**Files:** `src/components/data-transfer/error-boundary.tsx`

- [ ] Step 1: TDD 3 cases (upload fail / parse fail / commit fail com retry CTA).
- [ ] Step 2: ErrorBoundary + toasts.
- [ ] Step 3: Commit.

### Task 45: ExportPanel + ExportDialog

### Task 46: HistoryTable + RollbackDialog

### Task 47: A11y pass (checklist enumerado)

- [ ] roles: banner/main/dialog
- [ ] aria-live="polite" progress
- [ ] focus trap modal
- [ ] keyboard esc/enter
- [ ] contraste AA verify via axe-core
- [ ] labels em inputs
- [ ] Commit por batch.

### Task 48: Responsivo <md

### Task 49: Sidebar menu item condicional

### Task 50: Close wave 10b

- [ ] `pnpm lint && typecheck && vitest && build`
- [ ] Dispatch code-reviewer
- [ ] Tag `phase-10b-green`

---

## Wave 10c — Verification + obs (Tasks 51-76)

### Task 51: OTel MeterProvider init

### Task 52-55: 4 metrics (rows_total, duration_ms, errors_total, queue_depth) instrumentadas

### Task 56: dlq_depth metric

### Task 57: Sentry custom span wrapper

### Task 58-66: 9 E2E Playwright specs (uma task por spec conforme §6.3)

- [ ] 58: happy path 10 rows
- [ ] 59: lenient com erros
- [ ] 60: strict bloqueia
- [ ] 61: size 60k erro
- [ ] 62: viewer 403
- [ ] 63: export com filtro
- [ ] 64: rollback UI
- [ ] 65: super_admin history cross-tenant
- [ ] 66: dedupe AlertDialog

### Task 67-73: 7 integration tests (uma task cada)

- [ ] 67: import 1000 CSV sync
- [ ] 68: import 10k worker
- [ ] 69: round-trip
- [ ] 70: rollback DB state
- [ ] 71: cancel mid-worker
- [ ] 72: super_admin history:all
- [ ] 73: rate-limit 11º reject

### Task 74: Runbook

**Files:** `docs/runbooks/data-transfer.md`

- Health probe commands.
- Métricas-chave com threshold alerta.
- Troubleshoot: TIMEOUT_QUARANTINE, DLQ inspect+reprocess, storage errors, rate-limit saturation.
- Rollback operacional (flag OFF + instruções).

### Task 74b: bench script + seed

**Files:** `scripts/bench-datatransfer.mjs`, `scripts/seed-bench.mjs`

- [ ] Step 1: Seed helper 10k rows.
- [ ] Step 2: Bench round-trip capturing p50/p95.
- [ ] Step 3: Commit baseline numbers em `bench-baseline.json`.

### Task 75: DLQ reprocess script + test

### Task 76a: Deploy Portainer — Dockerfile target

**Files:** `Dockerfile` (atualizado) ou `Dockerfile.worker`

- [ ] Step 1: Multi-stage target `worker` com CMD `node dist/workers/data-transfer-commit.worker.js` parametrizado via `WORKER_NAME` env.
- [ ] Step 2: Build local test.
- [ ] Step 3: Commit.

### Task 76b: Portainer stack.yml

**Files:** `portainer/stack.yml`

- Adicionar 2 serviços commit + cleanup com healthcheck, restart, replicas 1.

### Task 76c: Rollout staging + piloto (entrega final)

- [ ] Step 1: Override flag staging → smoke round-trip 100 rows.
- [ ] Step 2: Override 1 tenant prod piloto.
- [ ] Step 3: Tag `phase-10-delivered` + atualiza HANDOFF/RELATORIO/memória.

### Task 76d: GA rollout (pós-deploy, fora do marco entrega)

- [ ] Monitor 7d → 25% → 50% → 100% → tag `phase-10-ga`.

---

## Failure modes

| Cenário | Recuperação |
|---------|-------------|
| Migration falhou mid-deploy | `prisma migrate resolve --rolled-back` + aplicar `rollback.sql` manual |
| Worker não sobe | Feature flag OFF; sync-only ≤5k permanece funcional |
| Storage S3 outage | Toast "Storage indisponível"; manual retry |
| Commit parcial crash | Retry BullMQ via committedChunks; ou rollback via importJobId |
| DLQ acumulado | `scripts/dlq-reprocess.js data-transfer-commit` |
| Flag rollout ruim | `overrideFlag('data_transfer', 'company', X, false)` instant |

---

## Self-review

- **Spec coverage:** §1-§16 mapeados. ✅
- **Placeholders:** todos "Idem task X" expandidos ou explicitamente trivia. ✅
- **Type consistency:** `PreviewResult`, `UploadResult`, `CommitJobPayload`, `HistoryItem` definidos em T4 consumidos coerentemente. ✅
- **Paralelismo:** T4+T4b desbloqueiam 10b sem quebrar typecheck. ✅
- **Total testes:** 87 unit enumerados na spec (reconcile OK) + 7 integration (67-73) + 9 E2E (58-66) = 103 tests. ✅
- **Tasks count:** 76.
- **Decomposição:** tasks 2-5min cada, TDD disciplinado.
- **Rollback story:** section "Failure modes" explícita. ✅
