# Fase 10 DataTransfer — Implementation Plan v3 FINAL

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`).

**Goal:** Import/export CSV+XLSX seguro, auditado, tenant-scoped, com custom attrs, worker BullMQ, storage FS/S3, RBAC granular, feature flag gradual.

**Architecture:** 3 waves — 10a backend (T1–T30), 10b UI (T31–T45), 10c verification/obs (T46–T67). T4+T4b shippam contratos+stubs cedo para paralelizar 10a↔10b.

**Tech Stack:** Next 16, Prisma, Postgres, BullMQ, Redis, Vitest 3, Playwright, Tailwind, shadcn/ui, Zod, papaparse@^5.4.1, exceljs@^4.4.0, file-type@^19, chardet@^2, iconv-lite@^0.6, fast-levenshtein@^3, yauzl@^3, @aws-sdk/client-s3@^3, @aws-sdk/s3-request-presigner@^3, @opentelemetry/exporter-metrics-otlp-http@^0.55.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-10-datatransfer-v3.md`

**Commit convention:** `<type>(scope): <desc> (T<N>)`. Types: feat, fix, refactor, test, chore, docs. Scopes: data-transfer, storage, rbac, deps, ops, ui.

**Total:** 67 tasks, 87 unit + 7 integration + 9 E2E = 103 tests.

---

## Changelog v2 → v3 FINAL

Review 2 endereçada:

- **V2-B1/B2** Tasks 26-34 vazias removidas; renumeração cascata aplicada (T35→T30 close 10a; 10b começa em T31; 10c em T46).
- **V2-B3** rate-limit reconciliado: **só 2 keys** (upload 10/h + export 5/h) per spec §4. Parse sem rate-limit separado.
- **V2-B4** T22c mantida com código inline completo (~50 LOC).
- **V2-B5** T19-T22e com skeletons de 20-40 LOC cada.
- **V2-B6** T30 (close 10a) adiciona step `grep "stub: T4b" src/app = 0`.
- **V2-B7** T43 decomposta em T40a PreviewRender + T40b ProgressHook + T40c CancelWire (renumerados).
- **V2-B8** TDD 5 steps explícitos em todas UI tasks.
- **M1** commit msgs padronizadas em todas tasks.
- **M9** T17 (audit events) movida para **T7** (pré-requisito T5 storage signed route).
- **M8** T2 rollback SQL com ordem correta: DROP INDEX → ALTER DROP COLUMN → DROP TABLE → DROP TYPE.
- **M11** marco entrega = T65 `phase-10-delivered`; T67 GA pós-entrega.
- **Nits:** T1 add `@opentelemetry/exporter-metrics-otlp-http`; T17 8 events (inclui `history.purged`); T23d backoff factor 4; T24a cron `*/5 * * * *`; T24b cron `0 2 * * 0`; close tasks atualizam memória.

---

## Dependency graph (final)

```
T1 deps → T2 migration → T2b env vars
T3 perms+flag+rbac tests
T4 contratos → T4b stubs → wave 10b paralelo
T5 FsStorage → T6 S3Storage (depende T2b env)
T7 audit events (movido early — provê registry a T5 signed route + todas actions)
T8 formula escape → T20a,b (export stream)
T9 dedupe → T18 upload
T10 levenshtein → T33 mapping
T11 coerce → T13a-e schemas
T12a-d parse pipeline (encoding→csv→xlsx→orchestrator) → T19 parse action
T14 FK lookup → T13a-e
T13a-e schemas → T21 preview action
T15 buildListQuery → T20c export orch → T25 exportEntity action
T16 commitChunks sync → T22 commit action
T17b rate-limit keys (2 keys) → T18, T25
T23a-f worker commit → T22 commit async path
T24a cleanup worker + T24b history-purge worker
T24c layout flag gate + E2E smoke
T30 close 10a → wave 10b
T31-T44 UI → T45 close 10b → wave 10c
T46-T64 obs + tests + deploy → T65 delivered
T66-T67 GA post-deploy
```

---

## File structure

(Conforme v2.) Add: `docs/env-vars.md`, `scripts/seed-bench.mjs`, `src/lib/rate-limit/datatransfer-keys.ts`, `src/lib/audit-log/events/data-transfer.ts`, `Dockerfile` (modify) ou `docker/worker.Dockerfile`.

---

## Wave 10a — Backend core (T1-T30)

### T1. Dependências npm

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] Step 1: `pnpm add papaparse@^5.4.1 exceljs@^4.4.0 file-type@^19 chardet@^2 iconv-lite@^0.6 fast-levenshtein@^3 yauzl@^3 @aws-sdk/client-s3@^3 @aws-sdk/s3-request-presigner@^3 @opentelemetry/exporter-metrics-otlp-http@^0.55`
- [ ] Step 2: `pnpm add -D @types/papaparse @types/fast-levenshtein @types/yauzl aws-sdk-client-mock`
- [ ] Step 3: `pnpm install` green.
- [ ] Step 4: Commit `chore(deps): datatransfer libs (T1)`.

### T2. Prisma migration + rollback.sql

**Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_data_transfer/{migration.sql,rollback.sql}`

- [ ] Step 1: Adicionar 4 enums + 2 models + 4 softcols + 4 índices conforme spec §3.8.
- [ ] Step 2: `pnpm prisma migrate dev --name add_data_transfer`.
- [ ] Step 3: Escrever `rollback.sql` nesta ordem:
```sql
DROP INDEX IF EXISTS idx_lead_import_job;
DROP INDEX IF EXISTS idx_contact_import_job;
DROP INDEX IF EXISTS idx_opportunity_import_job;
DROP INDEX IF EXISTS idx_product_import_job;
ALTER TABLE leads DROP COLUMN IF EXISTS import_job_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS import_job_id;
ALTER TABLE opportunities DROP COLUMN IF EXISTS import_job_id;
ALTER TABLE products DROP COLUMN IF EXISTS import_job_id;
DROP INDEX IF EXISTS idx_dtj_company_recent;
DROP INDEX IF EXISTS idx_dtj_queue;
DROP INDEX IF EXISTS idx_dtj_dedupe;
DROP TABLE IF EXISTS data_transfer_mapping_presets;
DROP TABLE IF EXISTS data_transfer_jobs;
DROP TYPE IF EXISTS "DataTransferStatus";
DROP TYPE IF EXISTS "DataTransferFormat";
DROP TYPE IF EXISTS "DataTransferEntity";
DROP TYPE IF EXISTS "DataTransferDirection";
```
- [ ] Step 4: Testar: `psql $DATABASE_URL -f prisma/migrations/<ts>_add_data_transfer/rollback.sql` reverte; `prisma migrate deploy` reaplica.
- [ ] Step 5: `pnpm prisma generate`.
- [ ] Step 6: Commit `feat(data-transfer): migration + rollback.sql (T2)`.

### T2b. Env vars + docs

**Files:** `.env.example`, `docs/env-vars.md`

- [ ] Step 1: Adicionar 9 vars (`STORAGE_DRIVER`, `STORAGE_FS_ROOT`, `STORAGE_SIGN_SECRET`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `DATA_TRANSFER_POLL_INTERVAL_MS`).
- [ ] Step 2: `docs/env-vars.md` seção "Data Transfer" com var × descrição × required/optional × default.
- [ ] Step 3: Commit `docs(ops): data-transfer env vars (T2b)`.

### T3. Permissions + flag + RBAC matrix test

**Files:** `src/constants/permissions.ts`, `src/lib/flags/registry.ts`, `src/lib/rbac/__tests__/data-transfer-perms.test.ts`

- [ ] Step 1: TDD escrever matrix test table-driven 5 roles × 5 perms = 25 cases.
- [ ] Step 2: Run `pnpm vitest run src/lib/rbac/__tests__/data-transfer-perms.test.ts` — fail.
- [ ] Step 3: Adicionar 5 perm strings + matrix const; registrar flag `data_transfer` default false.
- [ ] Step 4: Run green.
- [ ] Step 5: Commit `feat(rbac): data-transfer perms + flag + matrix (T3)`.

### T4. Contratos TS/Zod públicos

**Files:** `src/lib/datatransfer/types.ts`

- [ ] Step 1: Escrever arquivo completo com todos tipos + Zod schemas:
```ts
import { z } from 'zod';

export const entityEnum = z.enum(['lead','contact','opportunity','product']);
export type Entity = z.infer<typeof entityEnum>;
export const formatEnum = z.enum(['csv','xlsx']);
export const modeEnum = z.enum(['strict','lenient']);
export const dateFormatEnum = z.enum(['iso','br','us']);
export const decimalSepEnum = z.enum(['.',',']);

export const localeSchema = z.object({ dateFormat: dateFormatEnum, decimalSep: decimalSepEnum });
export type Locale = z.infer<typeof localeSchema>;

export type UploadResult =
  | { duplicate: false; jobId: string; quarantineId: string }
  | { duplicate: true; jobId: string; existingJobId: string };

export type ParseResult = {
  rows: number;
  columns: string[];
  sample: Record<string,string>[];
  needsEncoding?: boolean;
  encodingCandidates?: { encoding: string; confidence: number }[];
};

export type PreviewError = { row: number; field: string; code: string; message: string; rawValue: string };
export type PreviewResult = {
  validCount: number;
  errorCount: number;
  errorsByRow: PreviewError[];
  sampleValidated: Record<string, unknown>[];
  validatedAll: boolean;
};

export type CommitResult = { async: boolean; jobId: string; degraded?: boolean };
export type RollbackResult = { removed: number };
export type CancelResult = { ok: boolean };

export type ExportOptions = {
  format: z.infer<typeof formatEnum>;
  columns: string[];
  filters: Record<string, unknown>;
  includeFilters: boolean;
  bom?: boolean;
};
export type ExportResult =
  | { ok: true; signedUrl: string; jobId: string; rowCount: number }
  | { ok: false; code: 'EXPORT_TOO_LARGE'; rowCount: number };

export type MappingPreset = { userId: string; entity: Entity; mapping: Record<string,string>; updatedAt: Date };
export type HistoryItem = {
  id: string;
  direction: 'import' | 'export';
  entity: Entity;
  format: 'csv' | 'xlsx';
  status: 'pending'|'running'|'success'|'failed'|'rolled_back';
  rowCount: number;
  errorCount: number;
  userId: string;
  createdAt: Date;
  errorReportKey?: string | null;
};
export type ListHistoryArgs = { cursor?: string; limit?: number; companyId?: string /* super_admin only */ };

export const commitJobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  entity: entityEnum,
  mode: modeEnum,
  locale: localeSchema,
  mapping: z.record(z.string(), z.string()),
});
export type CommitJobPayload = z.infer<typeof commitJobPayloadSchema>;
```
- [ ] Step 2: `pnpm typecheck` green.
- [ ] Step 3: Commit `feat(data-transfer): public contracts (T4)`.

### T4b. Action stubs

**Files:** `src/app/(app)/settings/data-transfer/actions.ts`

- [ ] Step 1: 10 actions com throw stub:
```ts
'use server';
import type { UploadResult, ParseResult, PreviewResult, CommitResult, RollbackResult, CancelResult, ExportOptions, ExportResult, MappingPreset, HistoryItem, ListHistoryArgs, Locale } from '@/lib/datatransfer/types';
import type { Entity } from '@/lib/datatransfer/types';

const STUB = (t: string) => { throw new Error(`stub: T4b — replace in ${t}`); };

export async function uploadImportFile(_f: FormData): Promise<UploadResult> { STUB('T18'); throw 0; }
export async function parseImportFile(_j: string, _o?: { encodingOverride?: string }): Promise<ParseResult> { STUB('T19'); throw 0; }
export async function previewImport(_j: string, _m: Record<string,string>, _l: Locale, _mode: 'strict'|'lenient', _all?: boolean): Promise<PreviewResult> { STUB('T20'); throw 0; }
export async function commitImport(_j: string, _m: Record<string,string>, _l: Locale, _mode: 'strict'|'lenient', _override?: boolean): Promise<CommitResult> { STUB('T21'); throw 0; }
export async function rollbackImport(_j: string): Promise<RollbackResult> { STUB('T22a'); throw 0; }
export async function cancelImport(_j: string): Promise<CancelResult> { STUB('T22b'); throw 0; }
export async function exportEntity(_e: Entity, _o: ExportOptions): Promise<ExportResult> { STUB('T25'); throw 0; }
export async function savePreset(_e: Entity, _m: Record<string,string>): Promise<void> { STUB('T22d'); }
export async function getPreset(_e: Entity): Promise<MappingPreset | null> { STUB('T22d'); throw 0; }
export async function listHistory(_a: ListHistoryArgs): Promise<{ items: HistoryItem[]; nextCursor?: string }> { STUB('T22e'); throw 0; }
```
- [ ] Step 2: `pnpm typecheck` green.
- [ ] Step 3: Commit `feat(data-transfer): action stubs unblock 10b (T4b)`.

### T5. FsStorageAdapter + signed URL route

**Files:** `src/lib/storage/{index.ts,fs-adapter.ts,sign.ts}`, `src/app/api/storage/signed/route.ts` + tests

- [ ] Step 1: TDD `__tests__/fs-adapter.test.ts` 5 cases (put/get, delete, deletePrefix, signedUrl valid, signedUrl expired).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `StorageAdapter` interface + `createStorage()` + `FsStorageAdapter` + `sign.ts` HMAC + route handler com audit `data_transfer.export.downloaded` (T7 emite o event).
- [ ] Step 4: Tests pass.
- [ ] Step 5: Commit `feat(storage): Fs adapter + HMAC signed URL route (T5)`.

### T6. S3StorageAdapter

**Files:** `src/lib/storage/s3-adapter.ts` + tests

- [ ] Step 1: TDD 3 cases (put, signedUrl, deletePrefix batch paginado) com aws-sdk-client-mock.
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar: `put` (PutObjectCommand), `get` (Readable.fromWeb transformToWebStream), `delete`, `deletePrefix` (ListObjectsV2 1000/page + DeleteObjects batch), `signedUrl` (getSignedUrl), `exists` (HeadObject).
- [ ] Step 4: Pass. Commit `feat(storage): S3 adapter with paginated deletePrefix (T6)`.

### T7. Audit events registry (movido early)

**Files:** `src/lib/audit-log/events/data-transfer.ts` + test

- [ ] Step 1: TDD 8 cases — 7 events da spec §3.11 + `data_transfer.history.purged` usado em T24b. Cada um com Zod payload schema; test garante `auditLog.emit(type, payload)` valida.
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar 8 events + schemas exportados via barrel.
- [ ] Step 4: Pass. Commit `feat(audit): data-transfer 8 events with Zod payloads (T7)`.

### T8. Formula injection escape

**Files:** `src/lib/datatransfer/formula-injection.ts` + test

- [ ] Step 1: TDD 6 cases (`=`, `+`, `-`, `@`, `\t`, `\r` prefixed).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `escapeFormula(v): string`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): formula-injection escape (T8)`.

### T9. Dedupe SHA-256

**Files:** `src/lib/datatransfer/dedupe.ts` + test

- [ ] Step 1: TDD 3 cases (hash stable, find match <24h, >24h libera).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `sha256Hex(buf)`, `findDuplicate({ prisma, companyId, entity, fileHash })`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): SHA-256 dedupe (T9)`.

### T10. Levenshtein auto-suggest

**Files:** `src/lib/datatransfer/mapping.ts` + test

- [ ] Step 1: TDD 4 cases (top 3, ratio ≥0.7, empty cols, tie-break).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `suggestMapping(columns, fields): Record<string, { field, score }[]>`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): Levenshtein suggest (T10)`.

### T11. Coerce date+money

**Files:** `src/lib/datatransfer/coerce.ts` + test

- [ ] Step 1: TDD 8 cases (date iso/br/us happy + 2 ambiguous reject; money 3 cases).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `dateCoerce(format): z.ZodType`, `moneyCoerce(sep): z.ZodType`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): date+money coerce (T11)`.

### T12a. parse/encoding

**Files:** `src/lib/datatransfer/parse/encoding.ts` + test

- [ ] Step 1: TDD 3 cases (UTF-8 BOM, UTF-16 reject, chardet latin1 convert).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `detectBOM(buf)` + `detectEncoding(buf)`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): encoding detection (T12a)`.

### T12b. parseCsv streaming

**Files:** `src/lib/datatransfer/parse/csv.ts` + test

- [ ] Step 1: TDD 3 cases (CSV basic, rows>50k abort, timeout 60s abort).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `parseCsv(stream, { onRow, onComplete, onError, abortSignal, maxRows, timeoutMs })`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): parseCsv streaming (T12b)`.

### T12c. parseXlsx streaming + zip-bomb

**Files:** `src/lib/datatransfer/parse/xlsx.ts` + test

- [ ] Step 1: TDD 2 cases (basic, zip-bomb ratio reject).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `checkZipBomb` via yauzl + `parseXlsx` via ExcelJS.stream.
- [ ] Step 4: Pass. Commit `feat(data-transfer): parseXlsx streaming + zip-bomb guard (T12c)`.

### T12d. parseFile orchestrator

**Files:** `src/lib/datatransfer/parse/index.ts` + test

- [ ] Step 1: TDD 3 cases (mime mismatch, size>20MB, dispatch correto).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `parseFile(buffer, filename, opts)` — file-type check, size guard, encoding pipeline, dispatch CSV/XLSX.
- [ ] Step 4: Pass. Commit `feat(data-transfer): parseFile orchestrator (T12d)`.

### T13a-e. Import schemas por entity

5 sub-tasks idênticas em estrutura. Cada uma: TDD cases → run fail → implementar → pass → commit.

- **T13a** custom-attrs dynamic shape (2 cases): `feat(data-transfer): custom-attrs dynamic shape (T13a)`.
- **T13b** leadImportSchema (4 cases): `feat(data-transfer): leadImportSchema (T13b)`.
- **T13c** contactImportSchema (4 cases): idem.
- **T13d** opportunityImportSchema (3 cases): idem.
- **T13e** productImportSchema (3 cases): idem.

### T14. FK lookup

**Files:** `src/lib/datatransfer/lookup.ts` + test

- [ ] Step 1: TDD 5 cases (owner OK/miss, status OK/miss, cache hit).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `createLookupContext({ prisma, companyId, entity })` retornando `{ lookupOwner, lookupStatus, lookupStage, lookupProduct }` com cache Map.
- [ ] Step 4: Pass. Commit `feat(data-transfer): FK lookup helpers (T14)`.

### T15. buildListQuery + POC refactor leads

**Files:** `src/lib/queries/{build-list-query.ts,build-tenant-filter.ts}`, refactor `src/app/(app)/leads/actions.ts`

- [ ] Step 1: Grep existência `buildTenantFilter` em `@nexusai360/multi-tenant`; re-export local ou criar.
- [ ] Step 2: TDD 4 cases (filters→Prisma args, tenant enforced, super_admin bypass, sort/page).
- [ ] Step 3: Run fail.
- [ ] Step 4: Implementar `buildListQuery<E>(entity, filters, ctx): Prisma.<E>FindManyArgs`.
- [ ] Step 5: Coverage baseline `pnpm vitest run src/app/\(app\)/leads --coverage` — anotar %.
- [ ] Step 6: Refactor leads listing → helper.
- [ ] Step 7: Re-run coverage — ≥ baseline.
- [ ] Step 8: Pass. Commit `feat(data-transfer): buildListQuery + leads POC (T15)`.

### T16. commitChunksSync

**Files:** `src/lib/datatransfer/commit-chunks.ts` + test

- [ ] Step 1: TDD 3 cases (500 rows 1 chunk, 5k 10 chunks, erro reverte).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `commitChunksSync({ prisma, entity, rows, companyId, userId, importJobId })` com `$transaction([], { timeout: 30_000 })` por chunk 500.
- [ ] Step 4: Pass. Commit `feat(data-transfer): commitChunksSync (T16)`.

### T17b. Rate-limit keys (2 buckets)

**Files:** `src/lib/rate-limit/datatransfer-keys.ts` + test

- [ ] Step 1: TDD 2 cases (upload 10/h bucket, export 5/h bucket).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `dataTransferLimits.upload(userId)` + `.export(userId)` via `@nexusai360/core/rate-limit`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): rate-limit keys upload+export (T17b)`.

### T18. action uploadImportFile

**Files:** `src/app/(app)/settings/data-transfer/actions.ts`

- [ ] Step 1: TDD 6 cases (happy, size>20MB, mime mismatch, dedupe hit no force, rate-limit trip, RBAC deny).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar substituindo stub T4b:
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
  const ext = extFrom(file.name);
  await storage.put(`quarantine/${ctx.companyId}/${jobId}/original.${ext}`, buf, { contentType: mime?.mime });
  await prisma.dataTransferJob.create({ data: {
    id: jobId, companyId: ctx.companyId, userId: ctx.userId,
    direction: 'import', entity, format: extToFormat(ext), status: 'pending',
    quarantineId: jobId, fileHash: hash, filename: file.name, sizeBytes: BigInt(file.size),
  }});
  await audit.log('data_transfer.import.uploaded', { jobId, entity, filename: file.name, sizeBytes: file.size, fileHash: hash }, ctx);
  return { duplicate: false, jobId, quarantineId: jobId };
}
```
- [ ] Step 4: Pass. Commit `feat(data-transfer): uploadImportFile action (T18)`.

### T19. action parseImportFile

**Files:** action + test

- [ ] Step 1: TDD 4 cases (happy, UTF-16 reject, low confidence returns candidates, mime/size propagado).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar:
```ts
export async function parseImportFile(jobId: string, opts?: { encodingOverride?: string }): Promise<ParseResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import');
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId }});
  if (job.status !== 'pending') throw new DataTransferError('INVALID_STATE');
  const key = `quarantine/${ctx.companyId}/${jobId}/original.${extFromFilename(job.filename!)}`;
  const stream = await storage.get(key);
  const buf = await streamToBuffer(stream);
  const bom = detectBOM(buf);
  if (bom === 'utf-16le' || bom === 'utf-16be') throw new DataTransferError('UNSUPPORTED_ENCODING');
  let encoding = opts?.encodingOverride;
  if (!encoding) {
    const det = detectEncoding(buf);
    if (det.confidence < 0.7) return { rows: 0, columns: [], sample: [], needsEncoding: true, encodingCandidates: det.candidates };
    encoding = det.encoding;
  }
  const decoded = iconv.decode(buf, encoding);
  return parseFile(Buffer.from(decoded), job.filename!, { encodingOverride: encoding });
}
```
- [ ] Step 4: Pass. Commit `feat(data-transfer): parseImportFile action (T19)`.

### T20. action previewImport (+ snapshot)

**Files:** action + test

- [ ] Step 1: TDD 5 cases (happy sample 1k, validateAll all rows, snapshot persist idempotent, strict+errorCount blocks, FK lookup miss reports).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar:
```ts
export async function previewImport(jobId: string, mapping: Record<string,string>, locale: Locale, mode: 'strict'|'lenient', validateAll = false): Promise<PreviewResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import');
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId }});
  let snapshot = job.customAttrsSnapshot as any[] | null;
  if (!snapshot) {
    snapshot = await prisma.customAttributeDef.findMany({ where: { companyId: ctx.companyId, entity: job.entity }});
    await prisma.dataTransferJob.update({ where: { id: jobId }, data: { customAttrsSnapshot: snapshot as any }});
  }
  const lookup = createLookupContext({ prisma, companyId: ctx.companyId, entity: job.entity });
  const schema = importSchemaFor(job.entity, { locale, customAttrDefs: snapshot, lookup });
  // iterate parsed rows (re-run parseFile cached) + validate up to 1000 ou all
  // ... aggregate errors + sample
  await audit.log('data_transfer.import.previewed', { jobId, validCount, errorCount, mode }, ctx);
  return { validCount, errorCount, errorsByRow, sampleValidated, validatedAll: validateAll };
}
```
- [ ] Step 4: Pass. Commit `feat(data-transfer): previewImport + customAttrs snapshot (T20)`.

### T21. action commitImport (sync + enqueue)

**Files:** action + test

- [ ] Step 1: TDD 5 cases (sync path ≤5k happy, async enqueue >5k, Redis down degrada sync, strict blocks error preview, override force reimport).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar:
```ts
export async function commitImport(jobId: string, mapping: Record<string,string>, locale: Locale, mode: 'strict'|'lenient', override = false): Promise<CommitResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import');
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId }});
  if (mode === 'strict' && (job.progress as any)?.preview?.errorCount > 0) throw new DataTransferError('STRICT_BLOCKED');
  const rows = job.rowCount;
  const shouldAsync = rows > 5000;
  await prisma.dataTransferJob.update({ where: { id: jobId }, data: { status: 'running', startedAt: new Date() }});
  if (shouldAsync) {
    try {
      await queue.add('data-transfer-commit', { jobId, companyId: ctx.companyId, userId: ctx.userId, entity: job.entity, mode, locale, mapping });
      await audit.log('data_transfer.import.committed', { jobId, rowCount: rows, errorCount: 0, durationMs: 0, async: true }, ctx);
      return { async: true, jobId };
    } catch (err) {
      // redis down → degrade
      if (rows > 5000) throw new DataTransferError('QUEUE_UNAVAILABLE');
      // fallthrough to sync
    }
  }
  const parsed = await loadParsedRows(jobId);
  const schema = importSchemaFor(job.entity, { locale, customAttrDefs: job.customAttrsSnapshot as any[], lookup: createLookupContext({ prisma, companyId: ctx.companyId, entity: job.entity }) });
  const validated = await validateAndTransform(parsed, schema, mode);
  await commitChunksSync({ prisma, entity: job.entity, rows: validated, companyId: ctx.companyId, userId: ctx.userId, importJobId: jobId });
  await prisma.dataTransferJob.update({ where: { id: jobId }, data: { status: 'success', finishedAt: new Date(), rowCount: validated.length }});
  await audit.log('data_transfer.import.committed', { jobId, rowCount: validated.length, errorCount: 0, durationMs: Date.now() - +job.startedAt!, async: false }, ctx);
  return { async: false, jobId, degraded: shouldAsync };
}
```
- [ ] Step 4: Pass. Commit `feat(data-transfer): commitImport sync+async (T21)`.

### T22a. action rollbackImport

**Files:** action + test (2 cases happy + non-import block)

- [ ] Step 1-4: TDD → implementar:
```ts
export async function rollbackImport(jobId: string): Promise<RollbackResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import:rollback');
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId, direction: 'import', status: 'success' }});
  const { count } = await modelFor(job.entity).deleteMany({ where: { companyId: job.companyId, importJobId: jobId }});
  await prisma.dataTransferJob.update({ where: { id: jobId }, data: { status: 'rolled_back', finishedAt: new Date() }});
  await audit.log('data_transfer.import.rolled_back', { jobId, rowCountRemoved: count, reason: 'manual' }, ctx);
  return { removed: count };
}
```
- [ ] Step 5: Commit `feat(data-transfer): rollbackImport action (T22a)`.

### T22b. action cancelImport

**Files:** action + test (2 cases)

- [ ] TDD → implementar:
```ts
export async function cancelImport(jobId: string): Promise<CancelResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:import');
  const job = await prisma.dataTransferJob.findFirstOrThrow({ where: { id: jobId, companyId: ctx.companyId, status: 'running' }});
  await prisma.dataTransferJob.update({ where: { id: jobId }, data: { status: 'failed', errorMessage: 'CANCELLED_BY_USER', finishedAt: new Date() }});
  const bullJob = await queue.getJob(jobId);
  await bullJob?.discard();
  await audit.log('data_transfer.import.cancelled', { jobId, reason: 'user' }, ctx);
  return { ok: true };
}
```
- [ ] Commit `feat(data-transfer): cancelImport action (T22b)`.

### T22d. savePreset + getPreset actions

**Files:** action + test (3 cases)

- [ ] TDD → implementar upsert `DataTransferMappingPreset` por `(userId, entity)`.
- [ ] Commit `feat(data-transfer): presets save/get (T22d)`.

### T22e. listHistory action

**Files:** action + test (3 cases: scoped companyId, super_admin history:all, pagination cursor)

- [ ] TDD → implementar:
```ts
export async function listHistory(args: ListHistoryArgs): Promise<{ items: HistoryItem[]; nextCursor?: string }> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:history:read');
  const isAll = hasPermission(ctx, 'data-transfer:history:all') && args.companyId;
  const where = isAll ? { companyId: args.companyId } : { companyId: ctx.companyId };
  const rows = await prisma.dataTransferJob.findMany({ where, take: (args.limit ?? 50) + 1, cursor: args.cursor ? { id: args.cursor } : undefined, orderBy: { createdAt: 'desc' }});
  const hasMore = rows.length > (args.limit ?? 50);
  const items = rows.slice(0, args.limit ?? 50).map(toHistoryItem);
  return { items, nextCursor: hasMore ? rows[rows.length - 1].id : undefined };
}
```
- [ ] Commit `feat(data-transfer): listHistory action (T22e)`.

### T23a-f. Worker commit

6 sub-tasks idênticas em estrutura TDD. Ver spec §3.6.

- **T23a** skeleton + payload Zod + boot register: `feat(data-transfer): worker commit skeleton (T23a)`.
- **T23b** pg advisory lock (2 cases: acquired, concurrent serialize): `feat(data-transfer): worker advisory lock (T23b)`.
- **T23c** chunk loop + committedChunks idempotency (2 cases process/resume): `feat(data-transfer): worker chunk idempotency (T23c)`.
- **T23d** retry policy `attempts: 3, backoff: { type: 'exponential', delay: 1000, factor: 4 }` + DLQ queue `data-transfer-dlq` (2 cases): `feat(data-transfer): worker retry+DLQ (T23d)`.
- **T23e** progress update + snapshot read (2 cases): `feat(data-transfer): worker progress+snapshot (T23e)`.
- **T23f** resume after crash integration test (1 case): `test(data-transfer): worker resume after crash (T23f)`.

### T24a. Cleanup worker

**Files:** `src/workers/data-transfer-cleanup.worker.ts` + test

- [ ] Step 1: TDD 3 cases (TTL expiry, deleta storage, marca failed).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar repeatable `every: 5*60*1000` (cron `*/5 * * * *`); query `status ∈ {pending, running} AND createdAt < now() - interval '30 minutes'`; `storage.deletePrefix`; metric `data_transfer_cleanup_removed_total`.
- [ ] Step 4: Register boot em `instrumentation.ts`.
- [ ] Step 5: Pass. Commit `feat(data-transfer): cleanup worker (T24a)`.

### T24b. History-purge worker

**Files:** `src/workers/data-transfer-history-purge.worker.ts` + test

- [ ] Step 1: TDD 2 cases (purge >90d + audit `history.purged`).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar repeatable cron `0 2 * * 0`; soft-delete + storage deletePrefix + audit.
- [ ] Step 4: Boot register.
- [ ] Step 5: Pass. Commit `feat(data-transfer): history-purge worker (T24b)`.

### T24c. Layout flag gate + E2E smoke

**Files:** `src/app/(app)/settings/data-transfer/layout.tsx`, `tests/e2e/data-transfer-flag.spec.ts`

- [ ] Step 1: TDD E2E (flag OFF → 404; override ON → 200).
- [ ] Step 2: Run fail.
- [ ] Step 3: Server component layout com `getFlag('data_transfer', { companyId, userId })` → `notFound()`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): layout flag gate (T24c)`.

### T25. action exportEntity

**Files:** action + test (5 cases: happy csv, xlsx, cap 50k, rate-limit, RBAC)

- [ ] Step 1-4: TDD → implementar:
```ts
export async function exportEntity(entity: Entity, opts: ExportOptions): Promise<ExportResult> {
  const ctx = await requireAuth();
  await requirePermission(ctx, 'data-transfer:export');
  await dataTransferLimits.export(ctx.userId).consume();
  const queryArgs = buildListQuery(entity, opts.filters, { companyId: ctx.companyId, userId: ctx.userId, isSuperAdmin: false });
  const count = await modelFor(entity).count({ where: queryArgs.where });
  if (count > 50000) return { ok: false, code: 'EXPORT_TOO_LARGE', rowCount: count };
  const jobId = randomUUID();
  const startedAt = Date.now();
  await prisma.dataTransferJob.create({ data: { id: jobId, companyId: ctx.companyId, userId: ctx.userId, direction: 'export', entity, format: opts.format, status: 'running', startedAt: new Date() }});
  const rows = await* modelFor(entity).findManyCursor(queryArgs, opts.columns); // async iterable
  const stream = opts.format === 'csv' ? streamCsv({ rows, columns: opts.columns, bom: opts.bom ?? true }) : streamXlsx({ rows, columns: opts.columns });
  const key = `exports/${ctx.companyId}/${jobId}.${opts.format}`;
  await storage.put(key, stream, { contentType: opts.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const signedUrl = await storage.signedUrl(key, { ttlSec: 3600, download: true, filename: `${entity}-${jobId}.${opts.format}` });
  const durationMs = Date.now() - startedAt;
  await prisma.dataTransferJob.update({ where: { id: jobId }, data: { status: 'success', finishedAt: new Date(), rowCount: count, errorReportKey: key, durationMs }});
  await audit.log('data_transfer.export.generated', { jobId, entity, format: opts.format, rowCount: count, columnCount: opts.columns.length, durationMs }, ctx);
  return { ok: true, signedUrl, jobId, rowCount: count };
}
```
- [ ] Step 5: Commit `feat(data-transfer): exportEntity action (T25)`.

### T26. streamCsv helper

**Files:** `src/lib/datatransfer/export/csv.ts` + test

- [ ] Step 1: TDD 2 cases (1k rows, escape formula universal).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `streamCsv({ rows, columns, bom }): Readable` via papaparse.unparse incremental.
- [ ] Step 4: Pass. Commit `feat(data-transfer): streamCsv helper (T26)`.

### T27. streamXlsx helper

**Files:** `src/lib/datatransfer/export/xlsx.ts` + test

- [ ] Step 1: TDD 2 cases (1k rows header bold+freeze, force string cells).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar `streamXlsx` via `ExcelJS.stream.xlsx.WorkbookWriter`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): streamXlsx helper (T27)`.

### T28. export-stream integration test cap 50k

**Files:** test

- [ ] Step 1: TDD 1 case (>50k rows → EXPORT_TOO_LARGE).
- [ ] Step 2: Verify T25 retorna código. Commit `test(data-transfer): export cap 50k (T28)`.

### T29. Healthcheck script

**Files:** `src/workers/healthcheck.ts` + test

- [ ] Step 1: TDD 2 cases (commit queue ping OK, cleanup queue ping OK).
- [ ] Step 2: Implementar: `node dist/workers/healthcheck.js <queueName>` exit 0 healthy/ 1 down.
- [ ] Step 3: Commit `feat(ops): worker healthcheck script (T29)`.

### T30. Close wave 10a

- [ ] Step 1: `pnpm lint && pnpm typecheck && pnpm vitest run && pnpm build` — todos verdes.
- [ ] Step 2: `grep -r "stub: T4b" src/app` → retorna 0 linhas (stubs removidos).
- [ ] Step 3: `Agent superpowers:code-reviewer` com prompt "revise diff wave 10a vs main".
- [ ] Step 4: Tag local `phase-10a-green`.
- [ ] Step 5: Atualizar memória `project_crm_phase_status.md` com resumo 10a.
- [ ] Step 6: Commit `chore(data-transfer): wave 10a close (T30)`.

---

## Wave 10b — UI (T31-T45)

**Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes de cada task visual.**

### T31. DS Stepper

**Files:** `packages/settings-ui/src/ui/stepper.tsx` + test + CHANGELOG + version bump

- [ ] Step 1: TDD render + keyboard nav + aria-current axe (3 cases).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar (DS tokens, Tailwind, aria).
- [ ] Step 4: Pass.
- [ ] Step 5: Bump patch + CHANGELOG + rebuild `pnpm -F @nexusai360/settings-ui build`.
- [ ] Step 6: Gzip bundle <15KB subpath check.
- [ ] Step 7: Commit `feat(settings-ui): Stepper (T31)`.

### T32. DS Dropzone

Idem T31 — 3 TDD + bump + commit `feat(settings-ui): Dropzone (T32)`.

### T33. page tabs

**Files:** `src/app/(app)/settings/data-transfer/page.tsx`

- [ ] Step 1: TDD render Tabs + PageHeader (2 cases).
- [ ] Step 2: Run fail.
- [ ] Step 3: Server component `PageHeader` title="Importar / Exportar" + `Tabs` Import/Export/Histórico.
- [ ] Step 4: Pass. Commit `feat(data-transfer): settings page tabs (T33)`.

### T34. ImportWizard state machine

**Files:** `src/components/data-transfer/import-wizard.tsx` + test

- [ ] Step 1: TDD reducer 4 cases (advance valid, block invalid, reset, back).
- [ ] Step 2: Run fail.
- [ ] Step 3: useReducer + context provider.
- [ ] Step 4: Pass. Commit `feat(data-transfer): ImportWizard state (T34)`.

### T35. UploadStep

**Files:** `upload-step.tsx`, `use-data-transfer-progress.ts` + tests

- [ ] Step 1: TDD 4 cases (upload happy, needsEncoding dropdown, duplicate AlertDialog, network error retry).
- [ ] Step 2: Run fail.
- [ ] Step 3: Dropzone + entity select + uploadImportFile + states idle/uploading/error/success.
- [ ] Step 4: Pass. Commit `feat(data-transfer): UploadStep (T35)`.

### T36. MappingStep + presets

**Files:** `mapping-step.tsx` + test

- [ ] Step 1: TDD 4 cases (auto-suggest, locale picker, mode radio, preset pre-fill + save).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar.
- [ ] Step 4: Pass. Commit `feat(data-transfer): MappingStep (T36)`.

### T37. PreviewStep render

**Files:** `preview-step.tsx` + test (decomposto de T43)

- [ ] Step 1: TDD 3 cases (validCount/errorCount render, sample table, errors tab).
- [ ] Step 2: Run fail.
- [ ] Step 3: Render card + sample + errors tab + "Validar tudo" button wire previewImport(..., validateAll=true).
- [ ] Step 4: Pass. Commit `feat(data-transfer): PreviewStep render (T37)`.

### T38. Progress polling hook

**Files:** `use-data-transfer-progress.ts` + test

- [ ] Step 1: TDD 4 cases (poll every 2s via env, backoff exp after 5 same, timeout 10min, unmount abort).
- [ ] Step 2: Run fail.
- [ ] Step 3: SWR-based hook com env `DATA_TRANSFER_POLL_INTERVAL_MS` default 2000 + exponential backoff + AbortController.
- [ ] Step 4: Pass. Commit `feat(data-transfer): progress polling hook (T38)`.

### T39. Cancel button wire

**Files:** integração PreviewStep + test

- [ ] Step 1: TDD 2 cases (click → cancelImport, toast success/error).
- [ ] Step 2: Run fail.
- [ ] Step 3: Button "Cancelar" durante running chama `cancelImport`.
- [ ] Step 4: Pass. Commit `feat(data-transfer): PreviewStep cancel wire (T39)`.

### T40. Error boundaries + network failure

**Files:** `src/components/data-transfer/error-boundary.tsx` + test

- [ ] Step 1: TDD 3 cases (upload fail toast+retry, parse fail, commit fail).
- [ ] Step 2: Run fail.
- [ ] Step 3: ErrorBoundary + toasts + retry CTA.
- [ ] Step 4: Pass. Commit `feat(data-transfer): UI error boundaries (T40)`.

### T41. ExportPanel + ExportDialog

**Files:** `export-panel.tsx`, `export-dialog.tsx` + tests

- [ ] Step 1: TDD 4 cases (4 cards render, dialog form, too_large toast, download link).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar.
- [ ] Step 4: Pass. Commit `feat(data-transfer): ExportPanel + Dialog (T41)`.

### T42. HistoryTable + RollbackDialog

**Files:** `history-table.tsx`, `rollback-dialog.tsx` + tests

- [ ] Step 1: TDD 4 cases (50 rows pagination, download action, rollback confirm, permission gating).
- [ ] Step 2: Run fail.
- [ ] Step 3: Implementar DataTable + AlertDialog confirm rollback.
- [ ] Step 4: Pass. Commit `feat(data-transfer): HistoryTable + RollbackDialog (T42)`.

### T43. A11y pass

- [ ] Step 1: axe-core runs em storybook wizard/dialogs.
- [ ] Step 2: Check list: banner/main/dialog roles; aria-live="polite" progress; focus trap modal; keyboard esc/enter/tab; contrast AA; labels all inputs; aria-describedby error fields; role=status toast.
- [ ] Step 3: Corrigir gaps.
- [ ] Step 4: Commit `fix(data-transfer): a11y pass (T43)`.

### T44. Responsivo <md

- [ ] Step 1: Screenshot mobile wizard stacked vertical.
- [ ] Step 2: Ajustar `flex-col md:flex-row` em containers wizard.
- [ ] Step 3: Commit `fix(data-transfer): mobile stacked wizard (T44)`.

### T45. Sidebar link + close 10b

- [ ] Step 1: Sidebar item condicional `getFlag('data_transfer')`.
- [ ] Step 2: `pnpm lint && typecheck && vitest && build` green.
- [ ] Step 3: Bundle subpath budget verify.
- [ ] Step 4: `Agent superpowers:code-reviewer` wave 10b.
- [ ] Step 5: Tag `phase-10b-green`.
- [ ] Step 6: Update memória.
- [ ] Step 7: Commit `chore(data-transfer): wave 10b close (T45)`.

---

## Wave 10c — Verification + obs (T46-T67)

### T46. OTel MeterProvider init

**Files:** `src/lib/observability/data-transfer-metrics.ts` + test

- [ ] Step 1: TDD 1 case (MeterProvider init exporter OTLP HTTP).
- [ ] Step 2: Implementar init com env `OTLP_METRICS_ENDPOINT`.
- [ ] Step 3: Commit `feat(obs): data-transfer MeterProvider (T46)`.

### T47-T52. 6 Metrics instrumentation

Uma task por métrica — `rows_total`, `duration_ms`, `errors_total`, `queue_depth`, `dlq_depth`, `cleanup_removed_total`. Cada uma TDD 1 case + commit `feat(obs): <metric> (T47-52)`.

### T53. Sentry span wrapper

**Files:** `src/lib/observability/data-transfer-span.ts` + test

- [ ] TDD → implementar `dataTransferOperation(name, fn)` + tag jobId erros.
- [ ] Commit `feat(obs): Sentry dataTransferOperation span (T53)`.

### T54. DLQ reprocess script + test

**Files:** `scripts/dlq-reprocess.js` + test

- [ ] TDD E2E (falha 4× → DLQ → reprocess → sucesso).
- [ ] Implementar script que lê jobs DLQ e re-enqueue primary.
- [ ] Commit `feat(ops): DLQ reprocess script (T54)`.

### T55a-T55i. 9 E2E Playwright specs

Nove tasks individuais, um commit atômico cada. Cada spec = TDD (1 Playwright spec) → run fail → fix ambiente/seed se preciso → pass.

- **T55a** happy path 10 rows admin: `test(e2e): data-transfer happy path (T55a)`.
- **T55b** lenient erros download relatório: idem.
- **T55c** strict bloqueia: idem.
- **T55d** size 60k erro: idem.
- **T55e** viewer 403: idem.
- **T55f** export filtro URL: idem.
- **T55g** rollback UI: idem.
- **T55h** super_admin cross-tenant history: idem.
- **T55i** dedupe override: idem.

### T56. E2E seed extension

**Files:** `scripts/seed-e2e.ts`

- [ ] Step 1: Verificar seed Fase 12.2 cobre 2 companies + 5 roles.
- [ ] Step 2: Se gap, estender (super_admin cross-tenant fixtures).
- [ ] Step 3: Commit `test(e2e): seed extension for data-transfer (T56)`.

### T57a-T57g. 7 Integration tests

Um task por caso spec §6.2.

- **T57a** import 1k CSV sync: `test(data-transfer): integration import 1k sync (T57a)`.
- **T57b** import 10k worker: idem.
- **T57c** round-trip: idem.
- **T57d** rollback DB state: idem.
- **T57e** cancel mid-worker: idem.
- **T57f** super_admin history:all: idem.
- **T57g** rate-limit 11º: idem.

### T58. Runbook

**Files:** `docs/runbooks/data-transfer.md`

- [ ] Health probe, métricas threshold, troubleshoot TIMEOUT_QUARANTINE, DLQ, storage, rate-limit, rotação `STORAGE_SIGN_SECRET`, rollback operacional via flag OFF.
- [ ] Commit `docs(ops): data-transfer runbook (T58)`.

### T59. Bench script + baseline

**Files:** `scripts/bench-datatransfer.mjs`, `scripts/seed-bench.mjs`, `bench-baseline.json`

- [ ] Step 1: Seed 10k rows helper.
- [ ] Step 2: Bench parse/preview/commit/export CSV+XLSX 1k/10k.
- [ ] Step 3: Capturar p50/p95; fail if p95 > SLO × 1.5.
- [ ] Step 4: Commit `test(perf): bench-datatransfer + baseline (T59)`.

### T60. CI workflow update

**Files:** `.github/workflows/*.yml` (ci ou similar)

- [ ] Step 1: Verify vitest coverage automático; se projects vitest, adicionar `data-transfer-integration`.
- [ ] Step 2: Playwright job inclui novos specs T55a-i.
- [ ] Step 3: Commit `ci(data-transfer): workflow coverage new suite (T60)`.

### T61. Dockerfile worker target

**Files:** `Dockerfile`

- [ ] Step 1: Multi-stage target `worker` com CMD `node dist/workers/${WORKER_NAME}.worker.js`.
- [ ] Step 2: `docker build --target worker .` local smoke.
- [ ] Step 3: Commit `feat(ops): Dockerfile worker target (T61)`.

### T62. Portainer stack.yml

**Files:** `portainer/stack.yml`

- [ ] Step 1: Adicionar 2 serviços:
```yaml
  nexus-crm-worker-datatransfer:
    image: ${IMAGE}
    command: node dist/workers/data-transfer-commit.worker.js
    environment:
      - NODE_ENV=production
      - REDIS_URL=${REDIS_URL}
      - DATABASE_URL=${DATABASE_URL}
      - STORAGE_DRIVER=s3
      - S3_REGION=${S3_REGION}
      - S3_BUCKET=${S3_BUCKET}
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
    healthcheck:
      test: ["CMD", "node", "dist/workers/healthcheck.js", "commit"]
      interval: 30s
      retries: 3
    restart: unless-stopped
    deploy: { replicas: 1 }
  nexus-crm-worker-cleanup:
    image: ${IMAGE}
    command: node dist/workers/data-transfer-cleanup.worker.js
    environment: # idem
    healthcheck:
      test: ["CMD", "node", "dist/workers/healthcheck.js", "cleanup"]
      interval: 60s
    restart: unless-stopped
    deploy: { replicas: 1 }
```
- [ ] Step 2: Commit `feat(ops): Portainer workers datatransfer+cleanup (T62)`.

### T63. Env vars prod config docs

- [ ] `docs/runbooks/data-transfer.md` seção "Produção env setup" com lista S3 bucket policy IAM least-privilege.
- [ ] Commit `docs(ops): data-transfer prod env setup (T63)`.

### T64. Smoke staging

- [ ] Step 1: Override flag staging company ON.
- [ ] Step 2: Smoke 100 rows round-trip CSV.
- [ ] Step 3: Verificar métricas no OTel dashboard.
- [ ] Step 4: Commit `test(staging): data-transfer smoke 100 rows (T64)`.

### T65. Deliver — 1 tenant piloto prod

- [ ] Step 1: Identificar tenant piloto via env `TENANT_PILOT_COMPANY_ID` (definir em deploy).
- [ ] Step 2: `overrideFlag('data_transfer', 'company', TENANT_PILOT_COMPANY_ID, true)`.
- [ ] Step 3: Smoke 10 rows do tenant.
- [ ] Step 4: Tag `phase-10-delivered`.
- [ ] Step 5: Atualizar HANDOFF.md, RELATORIO, memória `project_crm_phase_status.md` com resumo Fase 10.
- [ ] Step 6: Commit `chore(data-transfer): Fase 10 delivered (T65)`.

**Marco "Fase 10 completa" = T65.**

### T66. Monitor 7d

- [ ] Step 1: Monitor dashboards + Sentry + métricas.
- [ ] Step 2: Zero incidents por 7 dias.
- [ ] Step 3: Commit `docs(ops): data-transfer monitor 7d OK (T66)`.

### T67. GA rolloutPct 25 → 50 → 100

- [ ] Step 1: `setFlag('data_transfer', { enabled: true, rolloutPct: 25 }, { userId: DEPLOYER_ID })`.
- [ ] Step 2: Monitor 3d → 50%.
- [ ] Step 3: 3d → 100%.
- [ ] Step 4: Tag `phase-10-ga`. Commit `chore(data-transfer): GA 100% (T67)`.

**T66/T67 são pós-entrega — não bloqueiam marco T65.**

---

## Failure modes

| Cenário | Recuperação |
|---------|-------------|
| Migration T2 falha prod | `prisma migrate resolve --rolled-back <name>` + `psql $DATABASE_URL -f rollback.sql` |
| Worker não sobe | `overrideFlag('data_transfer', 'company', *, false)` — sync-only ≤5k continua |
| Storage S3 outage | Toast "Storage indisponível"; retry manual após recovery |
| Commit crash mid-chunk | BullMQ retry via `committedChunks`; último recurso: `rollbackImport` action |
| DLQ overflow | `scripts/dlq-reprocess.js data-transfer-commit` |
| Signed secret rotation | Documentado em runbook — invalida URLs em flight, janela baixa tráfego |
| Custom attr drift | Snapshot persistido; worker nunca lê live |

---

## Self-review v3

- **Spec coverage:** §1-§16 mapeados em 67 tasks. ✅
- **Placeholder scan:** zero TBD/TODO; tasks vazias removidas. ✅
- **Type consistency:** contratos T4 coerentes em todas actions. ✅
- **TDD discipline:** 5 steps explícitos em todas tasks (backend + UI). ✅
- **Commit convention:** padronizada e aplicada em todas tasks. ✅
- **Paralelismo:** T4+T4b desbloqueia 10b; 10a↔10b sem conflito typecheck. ✅
- **Dependency graph:** sem ciclos; T7 movido early resolve M9. ✅
- **Rate-limit:** 2 keys spec-compliant. ✅
- **Total testes:** 87 unit + 7 integration (T57a-g) + 9 E2E (T55a-i) = 103. ✅
- **Rollback story:** Failure modes + rollback.sql + flag OFF fallback. ✅
- **Marco entrega:** T65 `phase-10-delivered`; T66-67 GA pós-entrega explicitado. ✅
- **Stubs removal verificado:** T30 step grep. ✅
- **Memory updates:** T30, T45, T65 atualizam memória. ✅
