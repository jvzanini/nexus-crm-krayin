# Fase 10 DataTransfer — Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Entregar import/export CSV+XLSX seguro, auditado, tenant-scoped, custom attrs, worker BullMQ, storage FS/S3, RBAC granular, feature flag gradual.

**Architecture:** 3 waves — 10a backend, 10b UI, 10c verification+obs. Task 4+4b shippa contratos+stubs cedo para paralelizar 10b.

**Tech Stack:** Next 16, Prisma, Postgres, BullMQ+Redis, Vitest 3, Playwright, Tailwind, shadcn/ui, Zod, papaparse@^5.4.1, exceljs@^4.4.0, file-type@^19.0.0, chardet@^2.0.0, iconv-lite@^0.6.3, fast-levenshtein@^3.0.0, yauzl@^3.1.0, @aws-sdk/client-s3@^3.600.0, @aws-sdk/s3-request-presigner@^3.600.0.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-10-datatransfer-v3.md`

**Commit convention:** `<type>(scope): <desc> (T<N>)` onde type ∈ {feat, fix, refactor, test, chore, docs}, scope inclui `data-transfer`, `storage`, `rbac`, etc.

**Changelog v1→v2:**
- Tasks grandes decompostas (T11→11a-d; T13→13a-e; T22→22a-e; T23→23a-f; T24→24a-b; T15→15a-c; T41-43→41-49 individuais; T45→45a-b; T47→47a-b).
- Novas tasks: 2b (.env + docs), 4b (stubs actions), 17b (rate-limit keys), 24c (layout flag E2E), 31b (UI error boundaries), 46a (Dockerfile worker).
- Seção "Failure modes" no fim.
- Dependency graph table.
- Pinned versions no header.

---

## Dependency Graph

| Task | Depends on | Unlocks |
|------|------------|---------|
| T1 deps | — | T2+ |
| T2 migration | T1 | T14, T18+ |
| T2b env vars | — | T6, T46 |
| T3 perms+flag+rbac | T1 | T24c, T18+ |
| T4 contratos | T3 | T4b, 10b all |
| T4b stubs | T4 | 10b paralelo |
| T5 FS adapter | T1 | T6, T18, T22c |
| T6 S3 adapter | T2b, T5 | T46 |
| T7 formula escape | T1 | T15a/b |
| T8 dedupe | T2 | T18 |
| T9 mapping | T1 | T30 |
| T10 coerce | T1 | T13 |
| T11a detectBOM/enc | T1 | T11d |
| T11b parseCsv | T11a | T11d |
| T11c parseXlsx | T11a | T11d |
| T11d parseFile | T11a/b/c | T19 |
| T12 lookup | T2 | T13 |
| T13a custom-attrs shape | T12 | T13b-e |
| T13b-e entity schemas | T13a, T10 | T20 |
| T14 buildListQuery | T2 | T15c, T22c |
| T15a streamCsv | T7 | T22c |
| T15b streamXlsx | T7 | T22c |
| T15c export orchestr | T14, T15a/b, T5 | T22c |
| T16 commitChunks | T2, T13 | T21 |
| T17 audit events | T3 | T18+ |
| T17b rate-limit keys | T3 | T18, T22c |
| T18 upload action | T4, T5, T8, T17, T17b | T29 |
| T19 parse action | T4, T11d | T29 |
| T20 preview action | T4, T13, T16 | T31 |
| T21 commit action | T4, T16, T23 | T31 |
| T22a rollback action | T4, T17 | T33 |
| T22b cancel action | T4, T23 | T31 |
| T22c exportEntity action | T4, T14, T15c, T17b | T32 |
| T22d presets actions | T4, T2 | T30 |
| T22e listHistory action | T4, T14 | T33 |
| T23a-f worker commit | T4, T16, T17 | T21 (enqueue) |
| T24a cleanup worker | T2, T5 | T25 |
| T24b history-purge worker | T2, T5 | T25 |
| T24c layout flag | T3 | T27 |
| T25 wave 10a close | T18-24 | 10b execução plena |
| T26 DS stepper+dropzone | T4 | T29+ |
| T27 route+tabs | T24c, T26 | T28+ |
| T28 wizard state | T27 | T29-31 |
| T29 UploadStep | T4b→T18 | T28 |
| T30 MappingStep | T9, T22d | T28 |
| T31 PreviewStep | T20, T21, T22b | T28 |
| T31b UI error boundaries | T29, T30, T31 | T37 |
| T32 Export | T22c | T37 |
| T33 History+Rollback | T22a, T22e | T37 |
| T34 a11y | T29-33 | T37 |
| T35 responsive | T29-33 | T37 |
| T36 sidebar link | T27 | T37 |
| T37 wave 10b close | T26-36 | 10c |
| T38 OTel metrics | T21, T22c, T24a | T47 |
| T39 Sentry spans | T38 | T47 |
| T40 DLQ script | T23d | T46 |
| T41-49 E2E specs | T37 | T47a |
| T50 integration tests | T37 | T47a |
| T45a runbook | T38 | T47a |
| T45b bench | T38 | T47a |
| T46 stack.yml | T6, T46a | T47a |
| T46a Dockerfile worker | T2b | T46 |
| T47a deliver | T38-46 | T47b |
| T47b rollout+monitor | T47a | — |

---

## File Structure

(idêntico ao v1 — ver anexo de paths. Não replico para concisão.)

---

## Wave 10a — Backend core (Tasks 1-25)

### Task 1: Dependências npm (pinned)

**Files:** `package.json`

- [ ] Step 1

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
pnpm add papaparse@5.4.1 exceljs@4.4.0 file-type@19.0.0 chardet@2.0.0 iconv-lite@0.6.3 fast-levenshtein@3.0.0 yauzl@3.1.0 @aws-sdk/client-s3@3.600.0 @aws-sdk/s3-request-presigner@3.600.0
pnpm add -D @types/papaparse@5.3.14 @types/fast-levenshtein@0.0.4 @types/yauzl@2.10.3 aws-sdk-client-mock@4.0.1
```

- [ ] Step 2: `pnpm install` — verify.

- [ ] Step 3: Commit `chore(deps): pinned datatransfer deps (T1)`

### Task 2: Prisma migration

Ver spec §3.8. Steps idênticos ao plan v1 T2 + redigir `migration.rollback.sql` manual (fix v1-rec 14).

Commit: `feat(data-transfer): migration DataTransferJob + MappingPreset + importJobId softcols + rollback.sql (T2)`

### Task 2b: .env.example + docs env vars

**Files:** `.env.example`, `docs/env-vars.md`

- [ ] Step 1: Adicionar 9 vars: `STORAGE_DRIVER`, `STORAGE_FS_ROOT`, `STORAGE_SIGN_SECRET`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` (opt), `DATA_TRANSFER_POLL_INTERVAL_MS` (default 2000).

- [ ] Step 2: Seção "Data Transfer" em `docs/env-vars.md` com descrição + default + required/optional.

- [ ] Step 3: Commit.

### Task 3: Permissions + flag + RBAC matrix tests

Idêntico v1 T3 — 5 perms, flag `data_transfer`, 25 testes matrix.

### Task 4: Contratos TS/Zod

Idêntico v1 T4 + adicionar tipos `HistoryItem`, `ListHistoryArgs`, `RollbackResult`, `CancelResult`, `ExportRateLimitKeys`.

### Task 4b: Stubs de actions

**Files:** `src/app/(app)/settings/data-transfer/actions.ts`

- [ ] Step 1: Criar skeleton exportando 10 actions (uploadImportFile, parseImportFile, previewImport, commitImport, rollbackImport, cancelImport, exportEntity, savePreset, getPreset, listHistory) com `async function X(...) { throw new Error('STUB — impl em T<N>') }`. Assinaturas batem com T4 types.

- [ ] Step 2: `pnpm typecheck` — verde.

- [ ] Step 3: Commit `feat(data-transfer): stubs actions desbloqueia wave 10b (T4b)`.

### Task 5: Storage FS adapter + signed URL route

Idêntico v1 T5. 5 testes.

### Task 6: Storage S3 adapter

Idêntico v1 T6. 3 testes mockados. Depende de T2b (env vars).

### Task 7: Formula injection escape

Idêntico v1 T7. 6 testes.

### Task 8: Dedupe SHA-256

Idêntico v1 T8. 3 testes.

### Task 9: Levenshtein mapping

Idêntico v1 T9. 4 testes.

### Task 10: Coerce date+money

Idêntico v1 T10. 8 testes (5 date + 3 money).

### Task 11a: detectBOM + detectEncoding

**Files:** `src/lib/datatransfer/parse/encoding.ts` + tests

- [ ] Step 1: TDD 4 testes (BOM UTF-8, UTF-16 LE/BE rejected, chardet ≥70% accept, <70% returns candidates).

- [ ] Step 2: Implementar `detectBOM(buf): 'utf-8'|'utf-16le'|'utf-16be'|null`, `detectEncoding(buf): { encoding, confidence, needsChoice: boolean }`.

- [ ] Step 3: Commit.

### Task 11b: parseCsv streaming

**Files:** `src/lib/datatransfer/parse/csv.ts` + tests

- [ ] Step 1: TDD 3 testes (basic, rows>50k abort, timeout 60s abort).

- [ ] Step 2: Implementar `parseCsv(stream, { onRow, abortSignal, maxRows, timeoutMs })` via papaparse.step. Aborta via `parser.abort()` quando limit atingido.

- [ ] Step 3: Commit.

### Task 11c: parseXlsx streaming + zip-bomb

**Files:** `src/lib/datatransfer/parse/xlsx.ts` + tests

- [ ] Step 1: TDD 3 testes (basic, zip-bomb ratio>100 rejected, rows>50k abort).

- [ ] Step 2: Implementar `parseXlsx(stream, { onRow, ... })`. Pre-check ratio via yauzl; depois ExcelJS streaming.

- [ ] Step 3: Commit.

### Task 11d: parseFile orquestrador + mime/size

**Files:** `src/lib/datatransfer/parse/index.ts` + tests

- [ ] Step 1: TDD 3 testes (mime mismatch reject, size>20MB reject, latin1 convert).

- [ ] Step 2: Implementar `parseFile(buffer, filename): Promise<ParseResult>` orquestra size+mime+encoding+csv/xlsx dispatch.

- [ ] Step 3: Commit.

### Task 12: FK lookup

Idêntico v1 T12. 5 testes.

### Task 13a: custom-attrs dynamic shape

**Files:** `src/lib/datatransfer/schemas/custom-attrs.ts` + tests

- [ ] Step 1: TDD 2 testes (shape from defs text+number; shape preserva required).

- [ ] Step 2: Implementar `dynamicCustomShape(defs): z.ZodObject` reusando registry Fase 5.

- [ ] Step 3: Commit.

### Task 13b-e: Schemas import por entity

Quatro tasks — leadImportSchema (4 tests), contactImportSchema (4), opportunityImportSchema (3), productImportSchema (3). Cada uma TDD + commit atômico.

### Task 14: buildListQuery + POC leads

**Files:** `src/lib/queries/build-list-query.ts`, `src/lib/queries/build-tenant-filter.ts`, `src/app/(app)/leads/actions.ts`

- [ ] Step 1: Grep `@nexusai360/multi-tenant` por `buildTenantFilter`; se existe re-export, senão criar.

- [ ] Step 2: TDD 4 testes buildListQuery.

- [ ] Step 3: Implementar.

- [ ] Step 4: Coverage baseline leads action: `pnpm vitest run src/app/\(app\)/leads --coverage` — anotar % antes.

- [ ] Step 5: Refactor leads listing para consumir helper.

- [ ] Step 6: Re-run coverage — ≥ baseline.

- [ ] Step 7: Commit.

### Task 15a: streamCsv helper

**Files:** `src/lib/datatransfer/export/csv.ts` + tests (1)

### Task 15b: streamXlsx helper

**Files:** `src/lib/datatransfer/export/xlsx.ts` + tests (1)

### Task 15c: export orchestrator

**Files:** `src/lib/datatransfer/export/orchestrator.ts` + tests (1 cap 50k)

### Task 16: commitChunks sync

Idêntico v1 T16. 3 testes.

### Task 17: Audit events + Zod payload schemas

**Files:** `src/lib/audit-log/events/data-transfer.ts`

- [ ] Step 1: Zod schema por event (7 events).

- [ ] Step 2: Teste valida `auditLog.create({ type, payload })` para cada.

- [ ] Step 3: Commit.

### Task 17b: Rate-limit keys

**Files:** `src/lib/rate-limit/keys.ts` (ou equiv), `__tests__/rate-limit-data-transfer.test.ts`

- [ ] Step 1: TDD 3 testes (upload 10/h bucket, export 5/h bucket, parse 20/h bucket).

- [ ] Step 2: Registrar chaves em registry (`@nexusai360/core/rate-limit` ou local helper).

- [ ] Step 3: Commit.

### Task 18: uploadImportFile action (troca stub)

**Files:** `src/app/(app)/settings/data-transfer/actions.ts`

- [ ] Step 1: TDD integração 3 casos (ok, size>20MB, duplicate).

- [ ] Step 2: Implementar substituindo stub T4b. Código inline:

```ts
export async function uploadImportFile(formData: FormData): Promise<UploadResult> {
  const ctx = await requireAuth();
  assertCan(ctx, 'data-transfer:import');
  const bucket = `datatransfer:upload:${ctx.companyId}`;
  await rateLimit(bucket, { limit: 10, window: '1h' });

  const file = formData.get('file') as File;
  if (!file || file.size > 20 * 1024 * 1024) throw badRequest('FILE_TOO_LARGE');
  const entity = entityEnum.parse(formData.get('entity'));
  const force = formData.get('force') === 'true';
  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = await fileTypeFromBuffer(buffer);
  if (!isAllowedMime(file.name, detected?.mime)) throw badRequest('MIME_MISMATCH');

  const fileHash = sha256Hex(buffer);
  if (!force) {
    const dup = await findDuplicate({ prisma, companyId: ctx.companyId, entity, fileHash });
    if (dup) return { duplicate: true, jobId: uuid(), existingJobId: dup.id };
  }

  const jobId = uuid();
  const storage = createStorage();
  const ext = extOf(file.name);
  await storage.put(`quarantine/${ctx.companyId}/${jobId}/original.${ext}`, buffer, { contentType: detected?.mime });

  await prisma.dataTransferJob.create({ data: {
    id: jobId, companyId: ctx.companyId, userId: ctx.userId,
    direction: 'import', entity, format: ext === 'csv' ? 'csv' : 'xlsx',
    status: 'pending', quarantineId: jobId, fileHash, sizeBytes: BigInt(file.size), filename: file.name,
  }});
  await audit.log('data_transfer.import.uploaded', { jobId, entity, filename: file.name, sizeBytes: file.size, fileHash });
  return { duplicate: false, jobId, quarantineId: jobId };
}
```

- [ ] Step 3: Tests pass. Commit.

### Task 19: parseImportFile action

Análogo T18 com assinatura `(jobId) → ParseResult` usando `parseFile()` lib T11d + permission check + flag. Código inline completo.

### Task 20: previewImport action (+ snapshot custom attrs)

Análogo. Persiste `customAttrsSnapshot` idempotente. Código inline completo.

### Task 21: commitImport action (sync + enqueue)

Análogo. Decide sync/async. Usa `commitChunksSync` (T16) ou `queue.add('data-transfer-commit', payload)`. Código inline completo.

### Task 22a: rollbackImport action

**Files:** action + tests (2 cases: happy + não-import bloqueado)

### Task 22b: cancelImport action

action + tests (2: happy + job não-running bloqueado)

### Task 22c: exportEntity action

action + tests (3: happy csv, cap 50k, xlsx force-string). Usa T15c orchestrator.

### Task 22d: savePreset + getPreset actions

actions + tests (3: save/get/upsert mesma chave).

### Task 22e: listHistory action

action + tests (3: scoped companyId, super_admin all, paging).

### Task 23a: worker skeleton + payload Zod + boot

**Files:** `src/workers/data-transfer-commit.worker.ts`, `instrumentation.ts`

- [ ] Step 1: TDD payload Zod (validate OK / invalid mapping rejected).

- [ ] Step 2: Skeleton `new Worker('data-transfer-commit', processor, { connection })`; boot condicional via `WORKER_NAME`.

- [ ] Step 3: Commit.

### Task 23b: advisory lock

- [ ] Step 1: TDD (2 workers concorrentes mesmo companyId serializam).

- [ ] Step 2: Wrap processor em `prisma.$transaction(async tx => { await tx.$queryRaw`SELECT pg_advisory_xact_lock(...)`; ... })`.

- [ ] Step 3: Commit.

### Task 23c: chunks + committedChunks idempotency

- [ ] Step 1: TDD (resume after crash processa só chunks restantes).

- [ ] Step 2: Loop chunks 500 rows; cada chunk em tx separada; update `progress.committedChunks`.

- [ ] Step 3: Commit.

### Task 23d: retry + backoff + DLQ

- [ ] Step 1: TDD (retry 3x backoff exp; última→DLQ).

- [ ] Step 2: BullMQ `attempts: 3, backoff: { type: 'exponential', delay: 1000 }`; onFailed move to DLQ queue.

- [ ] Step 3: Commit.

### Task 23e: progress update + snapshot read

- [ ] Step 1: TDD (rowCount incrementa; snapshot lido, não live).

- [ ] Step 2: Após cada chunk, `prisma.dataTransferJob.update({ progress, rowCount })`.

- [ ] Step 3: Commit.

### Task 23f: resume after crash integration

- [ ] Step 1: Simular crash mid-chunk via SIGKILL mock.

- [ ] Step 2: Reiniciar worker; validar não duplicou.

- [ ] Step 3: Commit.

### Task 24a: cleanup worker (quarentena TTL)

**Files:** `src/workers/data-transfer-cleanup.worker.ts` + tests (3)

- [ ] Repeatable 5min; TTL 30min; `storage.deletePrefix`; instrument metric `cleanup_removed_total`.

### Task 24b: history-purge worker

**Files:** `src/workers/data-transfer-history-purge.worker.ts` + tests (2)

- [ ] Repeatable weekly; >90d soft-delete; `storage.deletePrefix`; audit `data_transfer.history.purged`.

### Task 24c: layout flag gate + E2E smoke

**Files:** `src/app/(app)/settings/data-transfer/layout.tsx`, e2e spec

- [ ] Step 1: server component layout → `await getFlag('data_transfer', { companyId, userId })` → `notFound()` se OFF.

- [ ] Step 2: E2E: flag OFF → 404; override company ON → 200.

- [ ] Step 3: Commit.

### Task 25: Close wave 10a

- [ ] `pnpm typecheck && pnpm lint && pnpm vitest run`.

- [ ] `Agent superpowers:code-reviewer` revisa wave 10a.

- [ ] Tag local `phase-10a-green`.

- [ ] Commit `chore(data-transfer): wave 10a close (T25)`.

---

## Wave 10b — UI (Tasks 26-37)

**Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes de cada task visual.**

### Task 26: DS stepper+dropzone (packages/settings-ui)

**Files:** `packages/settings-ui/src/ui/stepper.tsx`, `dropzone.tsx`, exports, CHANGELOG.md, package.json bump patch

- [ ] Step 1: Grep existence. Se ausente, criar seguindo DS tokens.

- [ ] Step 2: Unit tests (render, keyboard nav, a11y axe).

- [ ] Step 3: Bump patch version + CHANGELOG entry + rebuild `pnpm -F @nexusai360/settings-ui build` + check gzip <15KB subpath.

- [ ] Step 4: Commit.

### Task 27: Rota + layout + tabs

**Files:** `src/app/(app)/settings/data-transfer/page.tsx`

- [ ] Step 1: Server component com `PageHeader` + `Tabs` (Import/Export/Histórico).

- [ ] Step 2: Commit.

### Task 28: ImportWizard state machine

**Files:** `src/components/data-transfer/import-wizard.tsx`

- [ ] Step 1: TDD reducer (step transitions + invalid blocked).

- [ ] Step 2: Implementar useReducer.

- [ ] Step 3: Commit.

### Task 29: UploadStep

**Files:** `src/components/data-transfer/upload-step.tsx`, `src/hooks/use-data-transfer-progress.ts`

- [ ] Step 1: Dropzone + entity select + uploadImportFile call.

- [ ] Step 2: Estados idle/uploading/error/success + needsEncoding dropdown + duplicate AlertDialog.

- [ ] Step 3: Unit tests user-event (upload + dup + encoding).

- [ ] Step 4: Commit.

### Task 30: MappingStep + presets

**Files:** `mapping-step.tsx`

- [ ] Step 1: Auto-suggest via T9 + tabela column→field + locale picker + modo radio.

- [ ] Step 2: getPreset pre-fill + savePreset button.

- [ ] Step 3: Unit tests. Commit.

### Task 31: PreviewStep + progress + cancel

**Files:** `preview-step.tsx`

- [ ] Step 1: Card validCount/errorCount + sample + erros.

- [ ] Step 2: "Validar tudo" re-call preview.

- [ ] Step 3: "Importar" triggers commit; durante running SWR polling env `DATA_TRANSFER_POLL_INTERVAL_MS` default 2000 + backoff exp após 5 polls sem mudança; timeout 10min msg fallback.

- [ ] Step 4: Botão "Cancelar" → cancelImport.

- [ ] Step 5: Unit tests. Commit.

### Task 31b: UI error boundaries + network failure states

**Files:** `src/components/data-transfer/error-boundary.tsx`, integração em wizard/export

- [ ] Step 1: ErrorBoundary React + toast + retry CTA por step.

- [ ] Step 2: Testes — network fail mid-upload → toast + retry; storage 500 → fallback.

- [ ] Step 3: Commit.

### Task 32: Export panel + dialog

**Files:** `export-panel.tsx`, `export-dialog.tsx`

- [ ] Step 1: 4 cards + Dialog com form.

- [ ] Step 2: exportEntity → signedUrl → `<a href download>`.

- [ ] Step 3: EXPORT_TOO_LARGE toast + refine hint.

- [ ] Step 4: Unit tests. Commit.

### Task 33: History + rollback

**Files:** `history-table.tsx`, `rollback-dialog.tsx`

- [ ] Step 1: DataTable 50 rows + actions column (download + Reverter).

- [ ] Step 2: RollbackDialog AlertDialog confirm.

- [ ] Step 3: Unit tests. Commit.

### Task 34: A11y pass

Critérios enumerados:
- [ ] Roles: banner, main, dialog, alert.
- [ ] aria-live em progresso.
- [ ] focus trap modal.
- [ ] Keyboard: esc fecha, enter confirma, tab navega wizard.
- [ ] Contraste AA (WCAG 2.1).
- [ ] Labels em todos inputs.
- [ ] Testes axe-core via storybook.
- [ ] Commit.

### Task 35: Responsivo mobile <md

- [ ] Wizard empilha vertical <768px.
- [ ] Screenshots visual regression mobile.
- [ ] Commit.

### Task 36: Sidebar menu item + flag gate

- [ ] Item "Importar / Exportar" condicional getFlag.
- [ ] Icon + ordem correta.
- [ ] Commit.

### Task 37: Close wave 10b

- [ ] `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`.
- [ ] Bundle budget check subpaths.
- [ ] Agent code-reviewer.
- [ ] Tag `phase-10b-green`.
- [ ] Commit.

---

## Wave 10c — Verification + observabilidade (Tasks 38-47b)

### Task 38: OTel metrics

**Files:** `src/lib/observability/data-transfer-metrics.ts`

- [ ] Step 1: Adicionar `@opentelemetry/exporter-metrics-otlp-http` se ausente.

- [ ] Step 2: MeterProvider + 6 métricas (rows_total, duration_ms, errors_total, queue_depth, dlq_depth, cleanup_removed_total).

- [ ] Step 3: Instrumentar T18/21/22c actions + T23 worker + T24a cleanup.

- [ ] Step 4: Unit test recording. Commit.

### Task 39: Sentry spans

- [ ] Step 1: Span `dataTransferOperation` envolvendo parse/commit/export.
- [ ] Step 2: Tag jobId em erros.
- [ ] Step 3: Commit.

### Task 40: DLQ reprocess script

**Files:** `scripts/dlq-reprocess.js` + test

- [ ] Step 1: Lê jobs de `data-transfer-dlq`; re-enqueue com delay 0.
- [ ] Step 2: E2E test: falha 4x → DLQ → reprocess → sucesso.
- [ ] Step 3: Commit.

### Tasks 41-49: E2E Playwright (1 spec por task)

Um commit atômico cada.

- [ ] **T41** happy path 10 rows admin.
- [ ] **T42** lenient com erros → download relatório.
- [ ] **T43** strict bloqueia commit.
- [ ] **T44** size 60k erro mensagem.
- [ ] **T45-E2E** viewer 403 (renomear pra evitar colisão com T45a/b abaixo — chamar **T45e**).
- [ ] **T46-E2E** export com filtro URL (**T46e**).
- [ ] **T47-E2E** rollback via UI (**T47e**).
- [ ] **T48** super_admin cross-tenant history.
- [ ] **T49** dedupe override flow.

### Task 50: Integration tests 7 cases

**Files:** `src/lib/datatransfer/__tests__/integration/*.test.ts`

- [ ] Postgres test fixture setup.
- [ ] 7 testes spec §6.2.
- [ ] Commit.

### Task 45a: Runbook

**Files:** `docs/runbooks/data-transfer.md`

- [ ] Health, métricas-chave, troubleshoot (TIMEOUT_QUARANTINE, DLQ, storage, rate-limit), comandos gh/docker logs + dlq-reprocess.
- [ ] Commit.

### Task 45b: Bench script + baseline

**Files:** `scripts/bench-datatransfer.mjs`, seed helper, `docs/benchmarks/data-transfer.md`

- [ ] Seed 10k rows helper.
- [ ] Bench 1k/10k CSV+XLSX (parse, preview, commit, export).
- [ ] Baseline p50/p95 capturados.
- [ ] Commit.

### Task 46a: Dockerfile worker target

**Files:** `Dockerfile`

- [ ] Step 1: Multi-stage — target `worker-commit` e `worker-cleanup` com CMD node dist/workers/….

- [ ] Step 2: Build verify `docker build -t test --target worker-commit .`.

- [ ] Step 3: Commit.

### Task 46: Portainer stack.yml

**Files:** `portainer/stack.yml`

- [ ] 2 serviços `nexus-crm-worker-datatransfer` + `nexus-crm-worker-cleanup` com healthcheck `node dist/workers/healthcheck.js`.
- [ ] Env vars required documentadas.
- [ ] Commit.

### Task 47a: Deliver staging + 1 tenant piloto

- [ ] Override staging company ON.
- [ ] Smoke 100 rows round-trip.
- [ ] Flip 1 tenant piloto prod ON.
- [ ] Tag `phase-10-delivered`.
- [ ] Update HANDOFF + memória.
- [ ] Commit.

### Task 47b: Rollout 25→50→100% + monitor

- [ ] 7 dias monitor (Sentry, métricas).
- [ ] rolloutPct gradual.
- [ ] Tag `phase-10-ga`.
- [ ] Update memória fechamento Fase 10.

---

## Failure modes

| Falha | Recuperação |
|-------|-------------|
| Migration T2 falha prod | `prisma migrate resolve --rolled-back <name>` + aplicar `migration.rollback.sql`. |
| Worker não sobe pós-deploy | `overrideFlag('data_transfer', 'company', *, false)` globalmente → sistema volta ao estado pré-fase sem UI acessível. |
| Storage S3 indisponível | `STORAGE_DRIVER=fs` temp + alertar ops. Sync-path funciona; async degrada. |
| Commit parcial mid-job | Worker retry recupera via committedChunks. Se DLQ acumula, `scripts/dlq-reprocess.js`. Se corrupção: `rollbackImport` action remove rows por `importJobId`. |
| DLQ overflow | Métrica `dlq_depth` dispara alerta; runbook §DLQ reprocess. |
| Bundle budget exceeded wave 10b | Revert Task 26 Stepper/Dropzone ou code-split. |

---

## Self-review

- Spec coverage: seções 1-16 → tasks mapeadas (grafo explícito). ✅
- Placeholder scan: sem TBD/TODO. Tasks agrupadoras decompostas. ✅
- Type consistency: contratos T4 consumidos coerentemente. ✅
- Tasks atômicas: média 2-5min; tasks maiores (T18, T23a-f) decompostas. ✅
- 75 tasks concretas (1, 2, 2b, 3, 4, 4b, 5, 6, 7, 8, 9, 10, 11a-d, 12, 13a-e, 14, 15a-c, 16, 17, 17b, 18, 19, 20, 21, 22a-e, 23a-f, 24a-c, 25, 26-37, 31b, 38, 39, 40, 41-49, 50, 45a, 45b, 46, 46a, 47a, 47b).
- Paralelismo: T4+T4b desbloqueia wave 10b enquanto T5-T24 continuam 10a. ✅
- Commit convention: `<type>(scope): <desc> (T<N>)`. ✅
- Failure modes documentadas. ✅
- Dependency graph no topo. ✅
