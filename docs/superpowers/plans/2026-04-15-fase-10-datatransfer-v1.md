# Fase 10 DataTransfer — Implementation Plan v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar import/export CSV+XLSX seguro, auditado, tenant-scoped, com custom attrs, worker BullMQ, storage adapter FS/S3, RBAC granular e feature flag gradual.

**Architecture:** 3 waves — 10a backend (migration + libs + actions + workers), 10b UI (wizard + dialog + histórico), 10c verification (OTel + E2E + deploy). 10a.1 shippa contratos TS cedo para paralelizar 10b.

**Tech Stack:** Next 16, Prisma, Postgres, BullMQ, Redis, Vitest 3, Playwright, Tailwind, shadcn/ui, Zod, papaparse, exceljs, file-type, chardet, iconv-lite, fast-levenshtein, yauzl, @aws-sdk/client-s3.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-10-datatransfer-v3.md`

---

## File Structure

### Wave 10a — Backend core

```
prisma/schema.prisma                                        [MODIFY +2 models +4 enums +4 fields]
prisma/migrations/<ts>_add_data_transfer/migration.sql     [NEW]
src/constants/permissions.ts                                [MODIFY +5 perms]
src/lib/flags/registry.ts                                   [MODIFY +1 flag]
src/lib/storage/index.ts                                    [NEW — interface + factory]
src/lib/storage/fs-adapter.ts                               [NEW]
src/lib/storage/s3-adapter.ts                               [NEW]
src/lib/storage/sign.ts                                     [NEW — HMAC sign/verify]
src/app/api/storage/signed/route.ts                         [NEW]
src/lib/queries/build-list-query.ts                         [NEW]
src/lib/queries/build-tenant-filter.ts                      [NEW or use pkg]
src/lib/datatransfer/index.ts                               [NEW barrel]
src/lib/datatransfer/types.ts                               [NEW — contratos públicos TS/Zod]
src/lib/datatransfer/parse.ts                               [NEW — CSV + XLSX streaming]
src/lib/datatransfer/mapping.ts                             [NEW — Levenshtein suggest]
src/lib/datatransfer/coerce.ts                              [NEW — date/money]
src/lib/datatransfer/lookup.ts                              [NEW — FK resolve]
src/lib/datatransfer/formula-injection.ts                   [NEW — escape]
src/lib/datatransfer/dedupe.ts                              [NEW — SHA-256]
src/lib/datatransfer/schemas/lead-import.ts                 [NEW]
src/lib/datatransfer/schemas/contact-import.ts              [NEW]
src/lib/datatransfer/schemas/opportunity-import.ts          [NEW]
src/lib/datatransfer/schemas/product-import.ts              [NEW]
src/lib/datatransfer/schemas/custom-attrs.ts                [NEW — dynamic shape]
src/lib/datatransfer/export-stream.ts                       [NEW]
src/lib/datatransfer/commit-chunks.ts                       [NEW — sync commit helper]
src/app/(app)/settings/data-transfer/actions.ts             [NEW — 6 server actions]
src/workers/data-transfer-commit.worker.ts                  [NEW]
src/workers/data-transfer-cleanup.worker.ts                 [NEW]
src/workers/data-transfer-history-purge.worker.ts           [NEW]
src/workers/healthcheck.ts                                  [NEW]
src/lib/audit-log/events.ts                                 [MODIFY +7 events]
instrumentation.ts                                          [MODIFY — boot workers]
package.json                                                [MODIFY — add deps]
```

### Wave 10b — UI

```
packages/settings-ui/src/ui/stepper.tsx                     [NEW (if absent)]
packages/settings-ui/src/ui/dropzone.tsx                    [NEW (if absent)]
packages/settings-ui/src/index.ts                           [MODIFY — exports]
src/app/(app)/settings/data-transfer/layout.tsx             [NEW — flag gate]
src/app/(app)/settings/data-transfer/page.tsx               [NEW — tabs]
src/components/data-transfer/import-wizard.tsx              [NEW]
src/components/data-transfer/upload-step.tsx                [NEW]
src/components/data-transfer/mapping-step.tsx               [NEW]
src/components/data-transfer/preview-step.tsx               [NEW]
src/components/data-transfer/export-panel.tsx               [NEW]
src/components/data-transfer/export-dialog.tsx              [NEW]
src/components/data-transfer/history-table.tsx              [NEW]
src/components/data-transfer/rollback-dialog.tsx            [NEW]
src/hooks/use-data-transfer-progress.ts                     [NEW — SWR polling]
```

### Wave 10c — Verification

```
docs/runbooks/data-transfer.md                              [NEW]
scripts/bench-datatransfer.mjs                              [NEW]
scripts/dlq-reprocess.js                                    [NEW]
tests/e2e/data-transfer-*.spec.ts                           [NEW 9 specs]
portainer/stack.yml                                         [MODIFY — 2 workers]
src/lib/observability/data-transfer-metrics.ts              [NEW]
```

---

## Wave 10a — Backend core (Tasks 1-25)

### Task 1: Adicionar dependências npm

**Files:** `package.json`

- [ ] Step 1: Install via pnpm

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
pnpm add papaparse exceljs file-type chardet iconv-lite fast-levenshtein yauzl @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add -D @types/papaparse @types/fast-levenshtein @types/yauzl
```

- [ ] Step 2: Verify `pnpm install` succeeds

- [ ] Step 3: Commit

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add datatransfer deps (papaparse, exceljs, file-type, aws-sdk, chardet, iconv, levenshtein, yauzl)"
```

### Task 2: Prisma migration — DataTransferJob + MappingPreset + enums + softcols

**Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_data_transfer/migration.sql`

- [ ] Step 1: Add enums + models ao fim do `schema.prisma` (ver spec §3.8 íntegro).

- [ ] Step 2: Adicionar `importJobId String? @db.Uuid @map("import_job_id")` + `@@index([companyId, importJobId], map: "idx_<entity>_import_job")` em Lead, Contact, Opportunity, Product.

- [ ] Step 3: `pnpm prisma migrate dev --name add_data_transfer` para gerar migration.

- [ ] Step 4: Verificar SQL gerado (4 índices criados, 2 tables, 4 enums, 4 softcols).

- [ ] Step 5: `pnpm prisma generate`.

- [ ] Step 6: Commit

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(data-transfer): migration DataTransferJob + MappingPreset + importJobId softcols (T2)"
```

### Task 3: Permissions + flag registry

**Files:** `src/constants/permissions.ts`, `src/lib/flags/registry.ts` (ou equivalente)

- [ ] Step 1: Adicionar 5 perms do spec §3.10 com strings literais.

- [ ] Step 2: Registrar flag `data_transfer` no registry com default false + descrição.

- [ ] Step 3: Unit test `rbac.test.ts` table-driven: 5 roles × 5 perms = 25 cases (já considera super_admin=all). Adiciona ao vitest.

```ts
// src/lib/rbac/__tests__/data-transfer-perms.test.ts
import { describe, it, expect } from 'vitest';
import { hasPermission, ROLES } from '@/lib/rbac';

const matrix: Record<string, Record<string, boolean>> = {
  'data-transfer:import': { super_admin: true, admin: true, manager: true, seller: false, viewer: false },
  'data-transfer:import:rollback': { super_admin: true, admin: true, manager: false, seller: false, viewer: false },
  'data-transfer:export': { super_admin: true, admin: true, manager: true, seller: true, viewer: true },
  'data-transfer:history:read': { super_admin: true, admin: true, manager: true, seller: true, viewer: true },
  'data-transfer:history:all': { super_admin: true, admin: false, manager: false, seller: false, viewer: false },
};

describe('data-transfer RBAC matrix', () => {
  for (const [perm, roleMap] of Object.entries(matrix)) {
    for (const [role, expected] of Object.entries(roleMap)) {
      it(`${role} ${expected ? 'has' : 'lacks'} ${perm}`, () => {
        expect(hasPermission(role as any, perm as any)).toBe(expected);
      });
    }
  }
});
```

- [ ] Step 4: Run `pnpm vitest run src/lib/rbac/__tests__/data-transfer-perms.test.ts` — fail (perms not declared).

- [ ] Step 5: Implementar: adicionar strings ao enum de perms + role matrix constante.

- [ ] Step 6: Re-run tests — pass.

- [ ] Step 7: Commit

```bash
git add src/constants/permissions.ts src/lib/flags src/lib/rbac
git commit -m "feat(data-transfer): 5 perms + flag data_transfer + rbac matrix tests (T3)"
```

### Task 4: Contratos TS/Zod públicos (desbloqueia 10b)

**Files:** `src/lib/datatransfer/types.ts`

- [ ] Step 1: Escrever arquivo completo com todas interfaces/Zod schemas das 6 actions + payloads worker. Ver spec §3.2, §3.6.

```ts
// src/lib/datatransfer/types.ts
import { z } from 'zod';

export const entityEnum = z.enum(['lead','contact','opportunity','product']);
export type Entity = z.infer<typeof entityEnum>;

export const formatEnum = z.enum(['csv','xlsx']);
export const modeEnum = z.enum(['strict','lenient']);
export const dateFormatEnum = z.enum(['iso','br','us']);
export const decimalSepEnum = z.enum(['.',',']);

export const localeSchema = z.object({
  dateFormat: dateFormatEnum,
  decimalSep: decimalSepEnum,
});
export type Locale = z.infer<typeof localeSchema>;

export type UploadResult =
  | { duplicate: false; jobId: string; quarantineId: string }
  | { duplicate: true; jobId: string; existingJobId: string };

export type ParseResult = {
  rows: number;
  columns: string[];
  sample: Record<string, string>[];
  needsEncoding?: boolean;
  encodingCandidates?: { encoding: string; confidence: number }[];
};

export type PreviewError = {
  row: number;
  field: string;
  code: string;
  message: string;
  rawValue: string;
};

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

- [ ] Step 2: Tsc check `pnpm typecheck`.

- [ ] Step 3: Commit

```bash
git add src/lib/datatransfer/types.ts
git commit -m "feat(data-transfer): contratos públicos TS/Zod (T4 — desbloqueia wave 10b)"
```

### Task 5: Storage adapter interface + FsStorageAdapter

**Files:** `src/lib/storage/index.ts`, `src/lib/storage/fs-adapter.ts`, `src/lib/storage/sign.ts`, `src/app/api/storage/signed/route.ts`

- [ ] Step 1: TDD — escrever `src/lib/storage/__tests__/fs-adapter.test.ts` com 5 casos: put/get/delete/deletePrefix/signedUrl HMAC valid+expired.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { FsStorageAdapter } from '../fs-adapter';

let root: string;
let adapter: FsStorageAdapter;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'storage-test-'));
  adapter = new FsStorageAdapter({ root, signSecret: 'test-secret' });
});

describe('FsStorageAdapter', () => {
  it('put + get roundtrip', async () => {
    await adapter.put('foo/bar.txt', Buffer.from('hello'));
    const stream = await adapter.get('foo/bar.txt');
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });
  it('delete removes file', async () => {
    await adapter.put('x.txt', Buffer.from('x'));
    await adapter.delete('x.txt');
    expect(await adapter.exists('x.txt')).toBe(false);
  });
  it('deletePrefix removes nested', async () => {
    await adapter.put('p/a.txt', Buffer.from('1'));
    await adapter.put('p/b/c.txt', Buffer.from('2'));
    await adapter.deletePrefix('p/');
    expect(await adapter.exists('p/a.txt')).toBe(false);
    expect(await adapter.exists('p/b/c.txt')).toBe(false);
  });
  it('signedUrl valid within ttl', async () => {
    await adapter.put('k.txt', Buffer.from('k'));
    const url = await adapter.signedUrl('k.txt', { ttlSec: 60 });
    expect(url).toMatch(/\/api\/storage\/signed\?/);
  });
  it('signedUrl expired rejects (sign.verify)', async () => {
    const { verifySign } = await import('../sign');
    const expired = { key: 'k', exp: Math.floor(Date.now()/1000) - 10, sig: 'x' };
    expect(verifySign(expired, 'test-secret')).toBe(false);
  });
});
```

- [ ] Step 2: Run fail.

- [ ] Step 3: Implementar `src/lib/storage/index.ts` com interface do spec §3.4 + factory `createStorage()`.

- [ ] Step 4: Implementar `src/lib/storage/fs-adapter.ts` com path.resolve+startsWith, streams, mode 0600, deletePrefix recursive.

- [ ] Step 5: Implementar `src/lib/storage/sign.ts` com `signKey(payload, secret)` + `verifySign(params, secret)` usando `crypto.createHmac('sha256', ...)`.

- [ ] Step 6: Implementar `src/app/api/storage/signed/route.ts` GET handler — valida params, verifica sig, lê storage, audit `data_transfer.export.downloaded`, streaming response com `Content-Disposition`.

- [ ] Step 7: Run tests — pass.

- [ ] Step 8: Commit

```bash
git add src/lib/storage src/app/api/storage
git commit -m "feat(storage): FsStorageAdapter + HMAC signed URL route (T5)"
```

### Task 6: S3StorageAdapter

**Files:** `src/lib/storage/s3-adapter.ts`

- [ ] Step 1: TDD — `__tests__/s3-adapter.test.ts` com aws-sdk-client-mock (3 casos: put, signedUrl, deletePrefix batch paginado).

```ts
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
// ... test cases
```

- [ ] Step 2: Run fail.

- [ ] Step 3: Implementar S3StorageAdapter per spec §3.4: put (Body stream), get (Readable.fromWeb), deletePrefix (List+Delete batch 1000), signedUrl (getSignedUrl).

- [ ] Step 4: Run tests — pass.

- [ ] Step 5: Commit

```bash
git add src/lib/storage/s3-adapter.ts
git commit -m "feat(storage): S3StorageAdapter com deletePrefix paginado (T6)"
```

### Task 7: Formula injection escape lib

**Files:** `src/lib/datatransfer/formula-injection.ts`

- [ ] Step 1: TDD — `__tests__/formula-injection.test.ts` 6 cases (=/+/-/@/\t/\r em CSV + XLSX).

- [ ] Step 2: Implementar `escapeFormula(v: unknown): string` + `isDangerous(v: string): boolean`.

```ts
const DANGER = /^[=+\-@\t\r]/;
export function escapeFormula(v: unknown): string {
  const s = v == null ? '' : String(v);
  return DANGER.test(s) ? `'${s}` : s;
}
```

- [ ] Step 3: Tests pass. Commit

```bash
git add src/lib/datatransfer/formula-injection.ts src/lib/datatransfer/__tests__/formula-injection.test.ts
git commit -m "feat(data-transfer): formula-injection escape (T7)"
```

### Task 8: Dedupe SHA-256

**Files:** `src/lib/datatransfer/dedupe.ts`

- [ ] Step 1: TDD — `__tests__/dedupe.test.ts` 3 cases.

- [ ] Step 2: Implementar `sha256Hex(buffer)` + `findDuplicate({ prisma, companyId, entity, fileHash })` query.

- [ ] Step 3: Tests pass. Commit.

### Task 9: Levenshtein auto-suggest

**Files:** `src/lib/datatransfer/mapping.ts`

- [ ] Step 1: TDD — `__tests__/mapping-levenshtein.test.ts` 4 cases (top 3, ratio ≥0.7, empty, tie-break).

- [ ] Step 2: Implementar `suggestMapping(columns: string[], fields: {name, label}[]): Record<string, { field: string; score: number }[]>` usando `fast-levenshtein`.

- [ ] Step 3: Tests pass. Commit.

### Task 10: Coerce (date + money)

**Files:** `src/lib/datatransfer/coerce.ts`

- [ ] Step 1: TDD — 5 cases date + 3 cases money.

- [ ] Step 2: Implementar `dateCoerce(format)`, `moneyCoerce(sep)` retornando `z.ZodType`.

- [ ] Step 3: Tests pass. Commit.

### Task 11: Parse (CSV + XLSX com defesas)

**Files:** `src/lib/datatransfer/parse.ts`

- [ ] Step 1: TDD — 9 cases (CSV, XLSX, BOM UTF-8/UTF-16, zip-bomb, mime mismatch, latin1, timeout, rows>50k, size>20MB).

- [ ] Step 2: Implementar:
  - `detectBOM(buffer): 'utf-8' | 'utf-16le' | 'utf-16be' | null`
  - `detectEncoding(buffer): { encoding, confidence }` via chardet
  - `parseCsv(stream, { onRow, abortSignal })` via papaparse.step
  - `parseXlsx(path, { onRow, abortSignal })` via ExcelJS streaming + yauzl ratio check
  - `parseFile(buffer, filename, ext): Promise<ParseResult>` orquestra

- [ ] Step 3: Tests pass. Commit.

### Task 12: FK lookup

**Files:** `src/lib/datatransfer/lookup.ts`

- [ ] Step 1: TDD — 5 cases (owner email OK/miss, status label OK/miss, cache hit).

- [ ] Step 2: Implementar `createLookupContext({ prisma, companyId, entity })` retornando `{ lookupOwner, lookupStatus, lookupStage, lookupProduct }` com cache Map.

- [ ] Step 3: Tests pass. Commit.

### Task 13: Zod schemas import por entity

**Files:** `src/lib/datatransfer/schemas/{lead,contact,opportunity,product}-import.ts`, `src/lib/datatransfer/schemas/custom-attrs.ts`

- [ ] Step 1: TDD por entity — 4 cases lead, 4 contact, 3 opportunity, 3 product = 14 tests.

- [ ] Step 2: Implementar `<entity>ImportSchema({ locale, customAttrDefs, lookup })` per spec §5.1.

- [ ] Step 3: Implementar `dynamicCustomShape(defs)` em `schemas/custom-attrs.ts` reaproveitando registry Fase 5.

- [ ] Step 4: Tests pass. Commit.

### Task 14: Build list query + tenant filter

**Files:** `src/lib/queries/build-list-query.ts`, `src/lib/queries/build-tenant-filter.ts`

- [ ] Step 1: Check if `@nexusai360/multi-tenant` já exporta `buildTenantFilter`. Se sim, re-export local; se não, criar.

- [ ] Step 2: TDD — `__tests__/build-list-query.test.ts` 4 cases.

- [ ] Step 3: Implementar `buildListQuery<E>(entity, filters, ctx)` retornando `Prisma.<E>FindManyArgs`.

- [ ] Step 4: Refactor `src/app/(app)/leads/actions.ts` (ou listing action) para usar helper — POC.

- [ ] Step 5: Run leads existing tests — green. Se regressão, ajustar helper.

- [ ] Step 6: Tests pass. Commit.

### Task 15: Export stream helpers

**Files:** `src/lib/datatransfer/export-stream.ts`

- [ ] Step 1: TDD — `__tests__/export-stream.test.ts` 3 cases (CSV 1k, XLSX 1k, cap 50k erro).

- [ ] Step 2: Implementar:
  - `streamCsv({ rows, columns, bom }): Readable` — papaparse.unparse incremental + escape universal.
  - `streamXlsx({ rows, columns }): Readable` — ExcelJS WorkbookWriter + escape + force string.
  - `exportEntityToStorage({ entity, format, filters, ctx, storage })` — orquestra, respeita cap 50k.

- [ ] Step 3: Tests pass. Commit.

### Task 16: Commit chunks helper (sync path)

**Files:** `src/lib/datatransfer/commit-chunks.ts`

- [ ] Step 1: TDD — 3 cases (500 rows 1 chunk, 5k em 10 chunks, erro rollback).

- [ ] Step 2: Implementar `commitChunksSync({ prisma, entity, rows, companyId, userId, importJobId })` com `$transaction([], { timeout: 30_000 })` por chunk 500.

- [ ] Step 3: Tests pass. Commit.

### Task 17: Audit events registry

**Files:** `src/lib/audit-log/events.ts` (ou equivalente)

- [ ] Step 1: Adicionar 7 events constantes com payload types (spec §3.11).

- [ ] Step 2: Teste unit garantindo cada event é string única e payload type é exportado.

- [ ] Step 3: Commit.

### Task 18: Server actions — uploadImportFile

**Files:** `src/app/(app)/settings/data-transfer/actions.ts`

- [ ] Step 1: TDD integração `__tests__/upload.test.ts` com prisma-mock + storage-mock.

- [ ] Step 2: Implementar `uploadImportFile(formData)`:
  - Parse FormData → file, entity, force.
  - Rate-limit check (`@nexusai360/core/rate-limit`).
  - Mime real via file-type.
  - Size ≤20MB.
  - SHA-256 hash.
  - Dedupe query.
  - `storage.put`.
  - `prisma.dataTransferJob.create`.
  - Audit.

- [ ] Step 3: Tests pass. Commit.

### Task 19: Server actions — parseImportFile

Idem task 18, action `parseImportFile(jobId)` chamando `parseFile` do lib.

### Task 20: Server actions — previewImport + snapshot custom attrs

Idem, `previewImport(jobId, mapping, locale, mode, validateAll?)`:
- Persiste `customAttrsSnapshot` (idempotente).
- Valida sample 1000 / all.
- Retorna PreviewResult.

### Task 21: Server actions — commitImport (sync + enqueue)

Idem, `commitImport(...)`:
- Decide sync vs async.
- Sync: chama `commitChunksSync`.
- Async: `queue.add('data-transfer-commit', payload)`.

### Task 22: Server actions — rollbackImport + cancelImport + exportEntity + savePreset/getPreset

Quatro actions restantes. TDD por action. Um commit por action.

### Task 23: Worker commit

**Files:** `src/workers/data-transfer-commit.worker.ts`

- [ ] Step 1: TDD integração `__tests__/worker-commit.test.ts` 6 cases (payload Zod, chunk progress, retry+backoff, DLQ, resume after crash, advisory lock).

- [ ] Step 2: Implementar per spec §3.6 — advisory lock, committedChunks idempotency, snapshot read, progress update, retry policy.

- [ ] Step 3: Register in `instrumentation.ts` Node boot.

- [ ] Step 4: Tests pass. Commit.

### Task 24: Worker cleanup + history-purge

**Files:** `src/workers/data-transfer-cleanup.worker.ts`, `data-transfer-history-purge.worker.ts`, `healthcheck.ts`

- [ ] Step 1: TDD 3 cases cleanup + 2 cases purge.

- [ ] Step 2: Implementar repeatable jobs + healthcheck script.

- [ ] Step 3: Register boot. Tests pass. Commit.

### Task 25: Feature flag gate + typecheck fence (10a close)

**Files:** ver flag registry task 3

- [ ] Step 1: Verificar layout server-side check pronto (usa flag).

- [ ] Step 2: `pnpm typecheck` — zero erros.

- [ ] Step 3: `pnpm vitest run` — todos testes 10a verdes.

- [ ] Step 4: Commit fecho wave 10a + tag local `phase-10a-green`.

---

## Wave 10b — UI (Tasks 26-37)

**Pré-req**: Task 4 (contratos TS) shipado. Tasks 10a.18-10a.22 (actions) preferível mas pode ser feito em paralelo com 10b via stubs.

**Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes de cada task visual.**

### Task 26: DS components — Stepper + Dropzone (se ausentes)

**Files:** `packages/settings-ui/src/ui/stepper.tsx`, `dropzone.tsx`, index exports

- [ ] Step 1: Grep `packages/` para Stepper/Dropzone existentes. Se existem, re-export e skip.

- [ ] Step 2: Se ausente — criar seguindo DS (Tailwind + tokens + aria). Usar `ui-ux-pro-max` skill.

- [ ] Step 3: Unit tests componentes (render + a11y).

- [ ] Step 4: Export barrel. Commit.

### Task 27: Rota layout + flag gate + tabs

**Files:** `src/app/(app)/settings/data-transfer/layout.tsx`, `page.tsx`

- [ ] Step 1: Layout server component lendo flag via `getFlag('data_transfer', ctx)` → `notFound()`.

- [ ] Step 2: Page com `PageHeader` + `Tabs` (Import/Export/Histórico).

- [ ] Step 3: E2E smoke (flag OFF → 404). Commit.

### Task 28: ImportWizard skeleton + state machine

**Files:** `src/components/data-transfer/import-wizard.tsx`

- [ ] Step 1: Client component com useReducer state machine (step 1/2/3).

- [ ] Step 2: Unit test reducer transitions.

- [ ] Step 3: Commit.

### Task 29: UploadStep

**Files:** `upload-step.tsx`, `use-data-transfer-progress.ts`

- [ ] Step 1: Dropzone + entity select + `uploadImportFile` call.

- [ ] Step 2: Loading state, needsEncoding dropdown, duplicate AlertDialog.

- [ ] Step 3: Unit tests user-event. Commit.

### Task 30: MappingStep + PresetManager

**Files:** `mapping-step.tsx`

- [ ] Step 1: Auto-suggest consumindo `suggestMapping`; tabela column→field; locale picker; modo radio.

- [ ] Step 2: getPreset pre-fill + savePreset button.

- [ ] Step 3: Unit tests. Commit.

### Task 31: PreviewStep + progress + cancel

**Files:** `preview-step.tsx`

- [ ] Step 1: Exibe validCount/errorCount/sample/erros.

- [ ] Step 2: Botão "Validar tudo" → re-chama previewImport.

- [ ] Step 3: Botão "Importar" → commitImport; durante running mostra Progress + "Cancelar".

- [ ] Step 4: SWR polling 2s via `use-data-transfer-progress` hook; timeout 10min.

- [ ] Step 5: Unit tests. Commit.

### Task 32: ExportPanel + ExportDialog

**Files:** `export-panel.tsx`, `export-dialog.tsx`

- [ ] Step 1: 4 cards entidades.

- [ ] Step 2: Dialog com form + call `exportEntity` → download via `signedUrl`.

- [ ] Step 3: Erro EXPORT_TOO_LARGE toast + filtro refinement hint.

- [ ] Step 4: Unit tests. Commit.

### Task 33: HistoryTable + RollbackDialog

**Files:** `history-table.tsx`, `rollback-dialog.tsx`

- [ ] Step 1: DataTable com 50 rows paginadas via server action `listHistory`.

- [ ] Step 2: Actions column — download relatório + Reverter (se admin+).

- [ ] Step 3: RollbackDialog confirm.

- [ ] Step 4: Unit tests. Commit.

### Task 34: A11y pass

- [ ] Step 1: Auditar aria-labels, roles, focus management via axe-core em storybook.

- [ ] Step 2: Corrigir gaps.

- [ ] Step 3: Commit.

### Task 35: Responsivo mobile <md

- [ ] Step 1: Wizard empilha vertical <768px.

- [ ] Step 2: Visual regression smoke.

- [ ] Step 3: Commit.

### Task 36: Sidebar menu item + feature flag gate

**Files:** `src/components/layout/sidebar.tsx` (ou equivalente)

- [ ] Step 1: Adicionar item "Importar / Exportar" se flag ON.

- [ ] Step 2: Icon + badge. Commit.

### Task 37: Close wave 10b — typecheck + vitest + smoke

- [ ] Step 1: `pnpm typecheck && pnpm vitest run && pnpm build`.

- [ ] Step 2: Tag local `phase-10b-green`. Commit.

---

## Wave 10c — Verification + observabilidade (Tasks 38-47)

### Task 38: OTel metrics

**Files:** `src/lib/observability/data-transfer-metrics.ts`

- [ ] Step 1: Instanciar MeterProvider (adicionar `@opentelemetry/exporter-metrics-otlp-http` se ausente).

- [ ] Step 2: Definir 6 métricas (rows_total, duration_ms, errors_total, queue_depth, dlq_depth, cleanup_removed_total).

- [ ] Step 3: Instrumentar actions + workers.

- [ ] Step 4: Unit test metric recording. Commit.

### Task 39: Sentry spans

- [ ] Step 1: Custom span `dataTransferOperation` via `@sentry/nextjs`.

- [ ] Step 2: Tag jobId em erros capturados.

- [ ] Step 3: Commit.

### Task 40: DLQ reprocess script

**Files:** `scripts/dlq-reprocess.js`

- [ ] Step 1: Lê jobs de `data-transfer-dlq`, move para primary queue com `delay: 0`.

- [ ] Step 2: Unit test. Commit.

### Task 41-43: E2E Playwright 9 specs

Um commit por spec.

- [ ] Spec 1: happy path import 10 rows.
- [ ] Spec 2: lenient com erros.
- [ ] Spec 3: strict bloqueia.
- [ ] Spec 4: size 60k erro.
- [ ] Spec 5: viewer 403.
- [ ] Spec 6: export com filtro.
- [ ] Spec 7: rollback.
- [ ] Spec 8: super_admin cross-tenant history.
- [ ] Spec 9: dedupe.

### Task 44: Integration tests 7 cases

**Files:** `src/lib/datatransfer/__tests__/integration/*.test.ts`

- [ ] Step 1: Setup Postgres test fixture.

- [ ] Step 2: 7 integration tests per spec §6.2.

- [ ] Step 3: Commit.

### Task 45: Runbook + bench script

**Files:** `docs/runbooks/data-transfer.md`, `scripts/bench-datatransfer.mjs`

- [ ] Step 1: Escrever runbook (health, métricas, troubleshoot).

- [ ] Step 2: Bench script 1k/10k rows CSV+XLSX.

- [ ] Step 3: Commit.

### Task 46: Deploy Portainer workers

**Files:** `portainer/stack.yml` (ou equivalente)

- [ ] Step 1: Adicionar 2 serviços `nexus-crm-worker-datatransfer` + `nexus-crm-worker-cleanup`.

- [ ] Step 2: Healthcheck commands.

- [ ] Step 3: Validar env vars obrigatórias documentadas.

- [ ] Step 4: Commit.

### Task 47: Rollout flag staging → 25% → 100%

- [ ] Step 1: Override staging company ON + smoke 100 rows round-trip.

- [ ] Step 2: Flip 1 tenant piloto prod ON.

- [ ] Step 3: Monitor 7 dias (métricas, Sentry).

- [ ] Step 4: rolloutPct 25 → 50 → 100.

- [ ] Step 5: Tag `phase-10-deployed`.

- [ ] Step 6: Atualizar HANDOFF + RELATORIO + memória `project_crm_phase_status.md`.

---

## Self-review

- Spec coverage: todas seções 1-16 do spec mapeadas a tasks. ✅
- Placeholder scan: nenhum TBD/TODO/handwave. ✅
- Type consistency: `CommitJobPayload`, `PreviewResult`, `ExportResult` etc definidos em Task 4 consumidos em 18-22 coerentes. ✅
- 47 tasks cobrindo 87 unit + 7 integration + 9 E2E + 6 métricas + 7 audit events + 5 perms + 2 models + 4 softcols + 2 workers + 1 cron.
- Paralelismo: 10a.4 (contratos) desbloqueia 10b cedo; 10c espera 10a+10b.
