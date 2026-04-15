# Spec v3 FINAL — Fase 10: DataTransfer (import/export CSV/XLSX)

**Status:** v3 FINAL (pós Review 1 + Review 2 pente fino — aprovada para plan)
**Data:** 2026-04-15
**Fase:** 10 — DataTransfer
**Dependências:** Fase 5 Custom Attributes (deployed), @nexusai360/{core, multi-tenant, audit-log, queue}, DS nexus-blueprint, `src/lib/flags` (Fase 1c).
**Bloqueia:** nada crítico.
**Deps npm novas:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `papaparse`, `exceljs`, `file-type`, `chardet`, `iconv-lite`, `fast-levenshtein`, `yauzl`.

---

## 0. Changelog v2 → v3

Review 2 aplicada:

**Bloqueadores v2:**
- **V2-B1** query builder — decisão firme: criar `buildListQuery` novo (seção 3.9); plan força task.
- **V2-B2** custom attrs snapshot — campo `DataTransferJob.customAttrsSnapshot` persistido no preview; worker lê do snapshot.
- **V2-B3** idempotência worker — ordem explícita lock→read progress→process→release (seção 3.6).
- **V2-B4** rollback UI + perm — nova perm `data-transfer:import:rollback`, botão UI histórico, E2E.
- **V2-B5** flag mecanismo — `src/lib/flags/index.ts` existe (Fase 1c). Chave canônica: `data_transfer`. `getFlag('data_transfer', { companyId, userId })`.
- **V2-B6** DLQ — métrica + runbook seção dedicada.

**Melhorias v3:**
- **V3-M1** deploy worker — seção 16 nova (container Portainer).
- **V3-M2** número de testes — target 87 unit enumerados (não 35).
- **V3-M3** cancelImport action + botão UI + timeout polling 10min.
- **V3-M4** índices `importJobId` em Lead/Contact/Opportunity/Product explícitos.
- **V3-M5** `deletePrefix` S3 com paginação `ListObjectsV2`+`DeleteObjects` 1000.
- **V3-M6** OpenTelemetry — verificado: `@opentelemetry/{api,sdk-node,exporter-trace-otlp-http,instrumentation-http,instrumentation-pg}` já instalados. Usa API existente + adiciona MeterProvider via `@opentelemetry/exporter-metrics-otlp-http`.
- **V3-M7** export super_admin escopa `companyId` ativo; switch de tenant via impersonation explícita (não auto).
- **V3-M8** último mapping — tabela nova `DataTransferMappingPreset(userId, entity, mapping Json)`.
- **V3-M9** mapping payload Zod — refine validando campos da entity.
- **V3-M10** contratos de TS/Zod públicos como task 10a.1 desbloqueando 10b paralelo.
- **V3-M11** E2E +3 (rollback, super_admin history, export com filtro) → total 9.

**Nits:** N2 export rate-limit key explicitada, N6 limite sync unificado 5k, N9 actions assinatura FormData, N11 server-side flag check no layout, N12 transaction timeout 30s.

---

## 1. Contexto

Usuários importam CSV/XLSX de outros CRMs e exportam para análise externa. MVP entrega I/O seguro, auditado, tenant-scoped, com custom attrs (Fase 5), storage adapter (FS dev / S3 prod), worker BullMQ p/ jobs grandes, RBAC granular e feature flag gradual.

## 2. Escopo

### Incluído
- Import CSV/XLSX (Lead, Contact, Opportunity, Product).
- Wizard 3 passos: upload → mapeamento+locale → preview+confirm.
- Auto-suggest mapping (Levenshtein ratio ≥ 0.7).
- Locale picker por coluna data/número.
- Custom attrs dinâmicos via snapshot do job.
- Preview dry-run 1000 rows sample + "validar tudo" opcional.
- Modos strict/lenient.
- Commit sync ≤5k rows, worker >5k.
- Rollback completo via UI.
- Cancel job running.
- Export CSV/XLSX com filtros da listagem + custom attrs.
- Storage adapter FS (dev) + S3 (prod).
- Signed URL 1h.
- Dedupe SHA-256 24h + override.
- Histórico 50 últimos com download relatório.
- Quarentena cron 5min, TTL 30min.
- History retention 90 dias.
- RBAC 5 permissions granulares.
- Audit 7 eventos canônicos.
- Feature flag `data_transfer` (default OFF, rollout gradual).
- Defesas roadmap: 20MB/50k/zip-bomb/formula-injection/encoding/mime-real/timeout-60s/path-traversal/DoS-streaming.
- Observabilidade OTel (traces + metrics) + Sentry spans + logs JSON.
- Runbook `docs/runbooks/data-transfer.md`.

### Fora de escopo (YAGNI)
- Google Sheets.
- Import incremental match-by-key (update-or-create).
- JSON/XML.
- Activity/Mailbox/Workflow/Task/Segment/Campaign import.
- Scheduler recorrente.
- Webhook conclusão.
- ClamAV AV.
- Template mapping nomeado (salvamos só último).
- SSE/WebSocket progress (SWR polling).
- Paginação multi-arquivo export >50k.
- Remote URL import (SSRF).

---

## 3. Arquitetura

### 3.1. Decomposição em waves

| Wave | Entregáveis | Depende de |
|------|-------------|------------|
| **10a — Backend core** | migration + enums + storage adapter + contratos TS/Zod públicos + parse/validate/commit/export libs + BullMQ worker commit + cleanup worker + audit events + RBAC + rate-limit + feature flag gate | — |
| **10b — UI** | `/settings/data-transfer` + Wizard 3 passos + ExportDialog + Histórico + SWR progress + cancel/rollback UI | 10a.1 (contratos) apenas |
| **10c — Verification+obs** | OTel metrics + Sentry spans + E2E Playwright + round-trip integration + docs runbook + deploy Portainer worker + rollout staging→25%→100% | 10a + 10b completos |

10a.1 (contratos stub + tipos) shippa **primeiro** desbloqueando 10b.

### 3.2. Fluxo import

**3.2.1. `uploadImportFile(formData: FormData)` (server action)**
- Extrai `file: File`, `entity: Entity`, `force?: boolean`.
- Valida tamanho ≤20MB.
- Valida mime real via `file-type` (magic bytes); rejeita mismatch ext↔mime.
- CSRF: Next 16 built-in.
- Rate-limit: `@nexusai360/core/rate-limit` key `data-transfer:upload:<userId>`, 10/hora.
- Lê buffer; calcula SHA-256 hex.
- Dedupe: consulta `DataTransferJob WHERE companyId=? AND entity=? AND fileHash=? AND direction=import AND createdAt > now()-interval '24 hours' AND status != 'failed'`. Se match e `!force` → retorna `{ duplicate: true, jobId, existingJobId }`.
- Persiste: `storage.put("quarantine/<companyId>/<jobId>/original.<ext>", buffer, { contentType })`.
- Cria `DataTransferJob` status=`pending`, `quarantineId=jobId`, `fileHash`, `sizeBytes`, `filename`.
- Audit `data_transfer.import.uploaded`.
- Retorna `{ jobId, quarantineId, duplicate: false }`.

**3.2.2. `parseImportFile(jobId: string)` (server action)**
- Busca job (tenant-scoped). Valida `status=pending` + ownership.
- Lê via `storage.get(path)` → Node `Readable`.
- Detecta BOM: UTF-8 (EF BB BF) accept; UTF-16 LE/BE (FF FE / FE FF) → reject `{ code: 'UNSUPPORTED_ENCODING', detail: 'UTF-16' }`.
- `chardet.detect(sampleBuffer)` com confidence threshold 70%. <70% → `{ needsEncoding: true, candidates: [{encoding, confidence}] }`. UI apresenta dropdown; repete call com `encodingOverride`.
- Converte via `iconv-lite.decode(buffer, encoding)` para UTF-8.
- **CSV**: `papaparse.parse(stream, { worker: false, step: callback, complete, error })`. Aborta se rows>50_000 ou walltime>60s (controlled via `setTimeout` flag).
- **XLSX**: `yauzl.open(path)` p/ checar ratio `uncompressed/compressed > 100` → reject. Depois `ExcelJS.stream.xlsx.WorkbookReader` itera rows.
- Retorna `{ rows: number, columns: string[], sample: Record<string, string>[] (5 rows), needsEncoding?: boolean }`.

**3.2.3. `previewImport(jobId, mapping, locale, mode, validateAll?)` (server action)**
- Carrega `CustomAttributeDef[]` por entity+companyId → **persiste em `DataTransferJob.customAttrsSnapshot Json`** (idempotente; só grava se null).
- Constrói `importSchemaForEntity(entity, { locale, customAttrDefs: snapshot })`:
  - Base `<entity>Schema.pick({mappedFields}).partial()`.
  - Transforms: `dateCoerce`, `moneyCoerce`, enum labels.
  - FK lookup: pre-fetcha Users/Statuses/Stages/Products por companyId → Map; transform converte.
  - Custom attrs: `dynamicCustomShape(snapshot)`.
- Se `validateAll !== true`: valida até 1000 rows.
- Se `validateAll === true`: valida todas em batches 500, progress via mesma tabela.
- Agrega: `{ validCount, errorCount, errorsByRow: [{row, field, code, message, rawValue}], sampleValidated: first 20 }`.
- Persist `job.progress.preview = { validCount, errorCount, validatedAll: bool }`.
- Audit `data_transfer.import.previewed`.
- Retorna preview payload.

**3.2.4. `commitImport(jobId, mapping, locale, mode, override?)` (server action)**
- Validate job state (preview ran; mode strict + errorCount>0 → bloqueia).
- Decide sync vs async:
  - rows ≤ 5_000 E Redis alive → sync.
  - rows > 5_000 OU `async=true` → enqueue.
  - Redis down: retorna `{ async: false, degraded: true }` e processa sync até cap 5_000 (não 10k — contradição v2 resolvida).
- Seta `status=running, startedAt=now()`.
- Sync path: processa chunks 500 rows em `prisma.$transaction([...], { timeout: 30_000 })`. Grava `importJobId = jobId` em cada row.
- Async path: enqueue `data-transfer-commit` payload.
- Audit `data_transfer.import.committed` (ou enqueued).
- Retorna `{ async: bool, jobId }`.

**3.2.5. `rollbackImport(jobId: string)` (server action)**
- RBAC: `data-transfer:import:rollback` (admin/super_admin).
- Job deve ser `direction=import, status=success`.
- `prisma.<entity>.deleteMany({ where: { companyId, importJobId: jobId } })` (tenant-scoped — `companyId` do job).
- Set `status=rolled_back, finishedAt=now()`.
- Audit `data_transfer.import.rolled_back` com `rowCountRemoved`.
- Retorna `{ removed: number }`.

**3.2.6. `cancelImport(jobId: string)` (server action)**
- Job deve estar `status=running`.
- Seta `status=failed, errorMessage='CANCELLED_BY_USER', finishedAt=now()`.
- Envia sinal BullMQ `job.discard()` via Queue API.
- Rows parciais commitadas ficam (operador pode rodar rollback na sequência se quiser).
- Audit `data_transfer.import.cancelled`.
- Retorna `{ ok: true }`.

### 3.3. Fluxo export

**`exportEntity(entity, format, columns, filters, options)` (server action)**
- RBAC: `data-transfer:export`.
- Rate-limit: key `data-transfer:export:<userId>`, 5/hora.
- Usa `buildListQuery(entity, filters, { companyId: ctx.companyId, userId: ctx.userId, isSuperAdmin: false })` — **super_admin exporta no escopo do `companyId` ativo**, não cross-tenant (para cross-tenant precisa impersonate).
- Count: se >50_000 → `{ code: 'EXPORT_TOO_LARGE', rowCount }`.
- Stream:
  - **CSV**: `papaparse.unparse` incremental (chunks de 1000 rows) com delimiter `,`, quote `"`, CRLF, UTF-8 + BOM opcional (default `true`). Escape formula-injection universal.
  - **XLSX**: `ExcelJS.stream.xlsx.WorkbookWriter`. Header bold + freeze pane row 1. **Largura fixa heurística** (15ch default; 40ch se campo `description/notes`). Force `cell.value = String(v)` (nunca Object/Formula).
- Upload via `storage.put("exports/<companyId>/<jobId>.<ext>", stream)`.
- Cria `DataTransferJob` direction=export, status=success, `errorReportKey=path`, rowCount.
- Audit `data_transfer.export.generated`.
- Retorna `{ signedUrl: await storage.signedUrl(path, { ttlSec: 3600 }), jobId, rowCount }`.

Download da URL → route handler `/api/storage/signed` valida HMAC+exp e audit `data_transfer.export.downloaded` com IP/UA.

### 3.4. Storage adapter

`src/lib/storage/index.ts`:

```ts
export interface StorageAdapter {
  put(key: string, data: Buffer | Readable, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  signedUrl(key: string, opts: { ttlSec: number; download?: boolean; filename?: string }): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export function createStorage(): StorageAdapter {
  return process.env.STORAGE_DRIVER === 's3'
    ? new S3StorageAdapter()
    : new FsStorageAdapter({ root: process.env.STORAGE_FS_ROOT ?? '/tmp/crm-storage' });
}
```

**FsStorageAdapter** (`src/lib/storage/fs-adapter.ts`):
- `path.resolve(root, key)` + check startsWith root.
- `fs.promises.mkdir({recursive: true})` + `fs.createWriteStream(..., { mode: 0o600 })`.
- `deletePrefix(prefix)`: `fs.readdir(path, { recursive: true })` → unlink each.
- `signedUrl(key, {ttlSec})`: gera path `/api/storage/signed?key=<b64>&sig=<hmac>&exp=<ts>`. HMAC SHA-256 com `STORAGE_SIGN_SECRET`. Route handler `src/app/api/storage/signed/route.ts` valida.

**S3StorageAdapter** (`src/lib/storage/s3-adapter.ts`):
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
- Env: `S3_ENDPOINT` (opc MinIO), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- `put`: `PutObjectCommand` com `Body: stream`.
- `get`: `GetObjectCommand` retorna `{Body: ReadableStream}`; converter via `Readable.fromWeb(Body.transformToWebStream())`.
- `delete`: `DeleteObjectCommand`.
- `deletePrefix`: loop `ListObjectsV2Command` (1000/page) → `DeleteObjectsCommand` batch.
- `signedUrl`: `getSignedUrl(client, cmd, { expiresIn })`.

Path layout: `<direction>/<companyId>/<jobId>/<file>`. Quarentena: `quarantine/<companyId>/<jobId>/original.<ext>`. Export: `exports/<companyId>/<jobId>.<ext>`. Error reports: `reports/<companyId>/<jobId>.csv`.

### 3.5. Quarentena TTL cron

`src/workers/data-transfer-cleanup.worker.ts`:

- BullMQ repeatable `data-transfer-cleanup` interval 5min (registrado via `instrumentation.ts` Node boot; idempotente — BullMQ dedup via `jobId`).
- Query: `DataTransferJob WHERE status IN ('pending','running') AND createdAt < now() - interval '30 minutes'`.
- Para cada: set `status=failed, errorMessage='TIMEOUT_QUARANTINE'`; `storage.deletePrefix("quarantine/<companyId>/<jobId>/")`.
- Log JSON + metric `data_transfer_cleanup_removed_total`.

### 3.6. Worker commit

`src/workers/data-transfer-commit.worker.ts`:

Queue `data-transfer-commit`.

**Payload Zod** com refine de mapping:
```ts
const dataTransferCommitJobSchema = z.object({
  jobId: z.string().uuid(),
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  entity: z.enum(['lead','contact','opportunity','product']),
  mode: z.enum(['strict','lenient']),
  locale: z.object({
    dateFormat: z.enum(['iso','br','us']),
    decimalSep: z.enum(['.',',']),
  }),
  mapping: z.record(z.string(), z.string()).refine(
    (m) => Object.values(m).every(field => isValidFieldForEntity(field, entity)),
    { message: 'mapping contém campo inválido' }
  ),
});
```

**Retry**: 3 tentativas, backoff exp (1s, 4s, 16s). Última falha → DLQ `data-transfer-dlq`.

**Concurrency**: 1 por `companyId`. Sequência obrigatória por job (fix V2-B3):
1. Consumer recebe job.
2. **Lock**: `SELECT pg_advisory_xact_lock(hashtext('dt:' || companyId))` dentro de transaction curta.
3. **Dentro do lock**: lê `DataTransferJob.progress.committedChunks`.
4. Processa próximo chunk em transaction separada `{ timeout: 30_000 }`.
5. Atualiza `progress.committedChunks.push(idx), rowCount += n`.
6. **Libera lock** (tx commit).
7. Loop próximo chunk.

Isso garante: nenhum chunk processado 2x mesmo em crash+retry.

**Progress**: após cada chunk, UI SWR (2s) vê `rowCount` incremental.

**Snapshot custom attrs (fix V2-B2)**: worker lê `DataTransferJob.customAttrsSnapshot` persistido no preview; **nunca** consulta `CustomAttributeDef` live durante o commit.

### 3.7. UI (wave 10b)

Rota `/settings/data-transfer` — server component com server-side flag check:

```ts
// src/app/(app)/settings/data-transfer/layout.tsx
const enabled = await getFlag('data_transfer', { companyId, userId });
if (!enabled) return notFound();
```

Componentes (invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes de cada task UI):

- `PageHeader` title="Importar / Exportar" subtitle="Migre dados em CSV ou XLSX".
- `Tabs`: Import | Export | Histórico.
- **Import tab** `ImportWizard` client:
  - `Stepper` (criar no `packages/settings-ui/src/ui/stepper.tsx` se ausente — task 10b.0).
  - **Step 1** `UploadStep`:
    - `Dropzone` (criar `packages/settings-ui/src/ui/dropzone.tsx` wrapping `react-dropzone` — task 10b.0).
    - Entity `Select`.
    - Força upload → `uploadImportFile` → progress → sample.
    - Se `needsEncoding` → encoding dropdown.
    - Se `duplicate` → `AlertDialog` "Já importado há X min. Continuar?".
  - **Step 2** `MappingStep`:
    - Tabela columns × fields com auto-suggest highlighted (Badge secondary).
    - Locale picker por coluna data/número.
    - Modo strict/lenient `RadioGroup`.
    - "Salvar como preferência" → chama `savePreset(entity, mapping)` action.
    - Pre-fill com preset existente (`getPreset(userId, entity)`).
  - **Step 3** `PreviewStep`:
    - Card validCount/errorCount + botão "Validar tudo".
    - Tabela sample (20 rows) + aba erros.
    - `Button` "Importar" disabled se strict+errorCount>0.
    - Durante running: `Progress` % + botão "Cancelar" (`cancelImport`); polling 2s; timeout UI 10min → mostra msg "cheque histórico".
- **Export tab** `ExportPanel`:
  - 4 cards Lead/Contact/Opportunity/Product cada com "Abrir export".
  - `ExportDialog`: format CSV/XLSX (RadioGroup), columns (Checkbox list incl custom), toggle "Usar filtros atuais", BOM (CSV only).
  - Abre `signedUrl` em `<a href download>`.
- **Histórico tab** `HistoryTable`:
  - `DataTable` cols: timestamp, direction, entity, format, rows, status (`IconTile` data-color), user, actions.
  - Actions: download relatório (se há), Reverter (se import success, requer `data-transfer:import:rollback`).
  - Confirm rollback via `AlertDialog`.
  - Paginação 50.
- `EmptyState` em cada tab zerada. `Sonner`/toast feedback. A11y: aria-labels, `role=progressbar`, `role=alert`.
- Responsivo: `<md (<768px)` wizard empilha vertical.

### 3.8. Schema Prisma

```prisma
enum DataTransferDirection { import  export }
enum DataTransferEntity    { lead    contact    opportunity    product }
enum DataTransferFormat    { csv     xlsx }
enum DataTransferStatus    { pending running success failed rolled_back }

model DataTransferJob {
  id                    String   @id @default(uuid()) @db.Uuid
  companyId             String   @map("company_id") @db.Uuid
  userId                String   @map("user_id") @db.Uuid
  direction             DataTransferDirection
  entity                DataTransferEntity
  format                DataTransferFormat
  status                DataTransferStatus   @default(pending)
  quarantineId          String?  @map("quarantine_id") @db.Uuid
  fileHash              String?  @map("file_hash") @db.VarChar(64)
  filename              String?  @db.VarChar(255)
  sizeBytes             BigInt?  @map("size_bytes")
  rowCount              Int      @default(0)
  errorCount            Int      @default(0)
  errorReportKey        String?  @map("error_report_key") @db.Text
  customAttrsSnapshot   Json?    @map("custom_attrs_snapshot")
  progress              Json     @default("{}")
  errorMessage          String?  @map("error_message") @db.Text
  startedAt             DateTime? @map("started_at")
  finishedAt            DateTime? @map("finished_at")
  durationMs            Int?     @map("duration_ms")
  createdAt             DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([companyId, createdAt(sort: Desc)], map: "idx_dtj_company_recent")
  @@index([status, startedAt], map: "idx_dtj_queue")
  @@index([companyId, entity, fileHash, createdAt(sort: Desc)], map: "idx_dtj_dedupe")
  @@map("data_transfer_jobs")
}

model DataTransferMappingPreset {
  userId    String             @map("user_id") @db.Uuid
  entity    DataTransferEntity
  mapping   Json
  updatedAt DateTime           @default(now()) @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, entity])
  @@map("data_transfer_mapping_presets")
}
```

Alterações adicionais em `Lead`, `Contact`, `Opportunity`, `Product`:

```prisma
  importJobId String? @map("import_job_id") @db.Uuid
  @@index([companyId, importJobId], map: "idx_<entity>_import_job")
```

### 3.9. Query builder compartilhado — decisão firme

Cria `src/lib/queries/build-list-query.ts`:

```ts
export function buildListQuery<E extends SupportedEntity>(
  entity: E,
  filters: ListFiltersFor<E>,
  ctx: { companyId: string; userId: string; isSuperAdmin: boolean }
): Prisma.EntityFindManyArgs<E> { ... }
```

Refactor plan-task: 1 listagem (leads) primeiro como POC → se OK, refactor contacts/opportunities/products. Export consome desde task 10a.

**Decisão firme**: criar helper. Sem fallback de "reusar existentes ambiguous".

### 3.10. RBAC matriz

Permissions (em `src/constants/permissions.ts`):

```
data-transfer:import              — upload + commit
data-transfer:import:rollback     — reverter import (admin+)
data-transfer:export              — gerar export
data-transfer:history:read        — histórico própria company
data-transfer:history:all         — histórico cross-tenant (super_admin only)
```

Matriz:

| Permission                         | super_admin | admin | manager | seller | viewer |
|------------------------------------|:-----------:|:-----:|:-------:|:------:|:------:|
| `data-transfer:import`             | ✅          | ✅    | ✅      | ❌     | ❌     |
| `data-transfer:import:rollback`    | ✅          | ✅    | ❌      | ❌     | ❌     |
| `data-transfer:export`             | ✅          | ✅    | ✅      | ✅     | ✅     |
| `data-transfer:history:read`       | ✅          | ✅    | ✅      | ✅     | ✅     |
| `data-transfer:history:all`        | ✅          | ❌    | ❌      | ❌     | ❌     |

Tenant scoping: `buildTenantFilter({ userId, isSuperAdmin })` aplicado a queries `DataTransferJob`. Super_admin com `history:all` pode filtrar por `companyId` arbitrário.

### 3.11. Audit events

```
data_transfer.import.uploaded       — { jobId, entity, filename, sizeBytes, fileHash }
data_transfer.import.previewed      — { jobId, validCount, errorCount, mode }
data_transfer.import.committed      — { jobId, rowCount, errorCount, durationMs, async }
data_transfer.import.rolled_back    — { jobId, rowCountRemoved, reason }
data_transfer.import.cancelled      — { jobId, reason }
data_transfer.export.generated      — { jobId, entity, format, rowCount, columnCount, durationMs }
data_transfer.export.downloaded     — { jobId, actorIp, userAgent }
```

Via `withAudit`/`audit.log` existentes. PII mascarada conforme logger.

### 3.12. Feature flag

Chave canônica: **`data_transfer`**.

Consulta: `await getFlag('data_transfer', { companyId, userId })` — helper `src/lib/flags/index.ts` (Fase 1c, já existe).

Layout `/settings/data-transfer/layout.tsx` → `notFound()` se flag OFF. Sidebar item condicional.

Rollout:
1. Deploy flag global OFF.
2. Staging tenant: override company ON via `overrideFlag('data_transfer', 'company', STAGING_ID, true)`.
3. 1 tenant piloto prod ON.
4. Monitor 7 dias.
5. rolloutPct 25% → 50% → 100%.

---

## 4. Segurança consolidada

| Defesa | Mecanismo |
|--------|-----------|
| Tamanho | `file.size > 20*1024*1024` → reject |
| Rows cap | papaparse/exceljs abort em 50_000 |
| Mime real | `file-type` magic bytes |
| Zip-bomb | yauzl ratio uncompressed/compressed>100 → reject |
| Formula-injection | regex `^[=+\-@\t\r]` prefix `'` em CSV+XLSX |
| Encoding | BOM + chardet ≥70% + fallback dropdown + iconv-lite UTF-8 |
| Timeout | setTimeout walltime 60s parse |
| Path traversal | `path.resolve` + startsWith root |
| DoS memory | streaming APIs only |
| SSRF | no remote URL |
| CSRF | Next 16 server actions |
| Rate-limit upload | 10/hora/user key `data-transfer:upload:<userId>` |
| Rate-limit export | 5/hora/user key `data-transfer:export:<userId>` |
| Audit | 7 eventos, PII mascarada |
| RBAC | 5 perms granulares |
| Tenant scoping | `buildTenantFilter` |
| Storage perms | S3 bucket least-privilege; FS 0600 |
| Signed URL | TTL 1h, HMAC+exp FS |
| Dedupe | SHA-256 24h + override explícito |
| ClamAV | **fora de escopo MVP** |

---

## 5. Validação, locale, FK lookup, custom attrs snapshot

### 5.1. Schemas por entity

`src/lib/datatransfer/schemas/<entity>-import.ts` com `<entity>ImportSchema(ctx)`. Ver 3.2.3 pipeline.

### 5.2. FK lookup

`src/lib/datatransfer/lookup.ts` — `lookupOwner`, `lookupStatus`, `lookupStage`, `lookupProduct`. Pre-fetch + cache Map por job (1 query por FK type).

### 5.3. Locale coerce

`src/lib/datatransfer/coerce.ts`:
- `dateCoerce('iso'|'br'|'us')` — rejeita se ambíguo fora do formato (ex: valor `2026-04-15` com locale BR → reject; valor `15/04/2026` com locale US → reject).
- `moneyCoerce('.'|',')` — troca separador, parse Number, valida finite e positive (se campo price/value).

### 5.4. Custom attrs snapshot

- Preview grava `DataTransferJob.customAttrsSnapshot = defs[]` (uma vez, idempotente).
- Commit (sync ou worker) lê snapshot — nunca query live.

---

## 6. Testes

### 6.1. Unit (target 87 enumerados — mínimo 80)

Por módulo:

- `parse.test.ts` (9): CSV basic, XLSX basic, BOM UTF-8/UTF-16, zip-bomb, mime mismatch, encoding latin1, timeout, rows>50k, size>20MB.
- `mapping-levenshtein.test.ts` (4): auto-suggest top 3, ratio ≥0.7, empty columns, tie-break.
- `schemas/lead-import.test.ts` (4), `contact-import` (4), `opportunity-import` (3), `product-import` (3).
- `lookup.test.ts` (5): owner/status OK+miss + cache hit.
- `date-coerce.test.ts` (5): iso/br/us happy + 2 ambiguous reject.
- `money-coerce.test.ts` (3): vírgula/ponto + edge exponent reject.
- `formula-injection.test.ts` (6): =/+/-/@/\t/\r em CSV+XLSX.
- `storage-fs-adapter.test.ts` (5): put/get/delete/deletePrefix/signedUrl HMAC valid+expired.
- `storage-s3-adapter.test.ts` (3): mock sdk put/signedUrl/deletePrefix batch.
- `query-builder-export.test.ts` (4): filters→Prisma args, tenant enforced, super_admin bypass.
- `worker-commit.test.ts` (6): payload Zod, chunk progress, retry+backoff, DLQ, resume after crash, advisory lock.
- `worker-cleanup.test.ts` (3): TTL expiry, deleta storage, marca failed.
- `rbac.test.ts` (20 table-driven): 5 roles × 4 perms + edge super_admin.
- `dedupe.test.ts` (3): match <24h bloqueia, override libera, >24h libera.
- `feature-flag.test.ts` (2): ON/OFF gate + layout notFound.
- `export-stream.test.ts` (3): CSV 1k/XLSX 1k/cap 50k erro.

Total: **87 tests**.

### 6.2. Integration (target 7)

- Import 1000 leads CSV sync → 1000 rows DB companyId correto.
- Import 10k contacts CSV worker → polling status → success.
- Round-trip: export 500 opportunities → re-import → dados equivalentes (excl id/createdAt/updatedAt/importJobId).
- Rollback completo: import 100 rows → rollback → 0 rows com importJobId.
- Cancel durante worker: cancelImport mid-chunk → status=failed → rows parciais preservados.
- Super_admin `history:all` lista jobs cross-tenant.
- Rate-limit: 11º upload em 1h → reject.

### 6.3. E2E Playwright (target 9)

1. admin: upload CSV 10 rows happy path.
2. admin: upload CSV malformado lenient → preview erros → commit válidas → download relatório.
3. admin: strict com erro → preview bloqueia commit.
4. admin: upload 60k rows → erro "máximo 50.000".
5. viewer: `/settings/data-transfer` com flag ON → 403 (sem `data-transfer:import`).
6. admin: export leads com filtro `?status=new` → CSV só status=new.
7. admin: rollback job → confirma AlertDialog → 0 rows com importJobId.
8. super_admin: aba Histórico com filtro company → vê jobs de outros tenants.
9. admin: dedupe — 2º upload mesmo arquivo em <24h → AlertDialog "Já importado".

---

## 7. Performance SLO

- Parse 10k rows: ≤3s CSV / ≤8s XLSX.
- Preview 1k sample: ≤1s.
- Commit sync 5k: ≤15s.
- Commit worker 10k: ≤30s.
- Export 10k rows: ≤5s CSV / ≤12s XLSX.

Benchmark `scripts/bench-datatransfer.mjs` — roda em CI weekly.

---

## 8. Observabilidade (wave 10c)

OTel já instalado (verificado: `@opentelemetry/{api,sdk-node,exporter-trace-otlp-http,instrumentation-http,instrumentation-pg}`). Adicionar `@opentelemetry/exporter-metrics-otlp-http` e MeterProvider.

**Métricas**:
- `data_transfer_rows_total{direction, entity, status}` counter
- `data_transfer_duration_ms{direction, entity}` histogram
- `data_transfer_errors_total{direction, entity, code}` counter
- `data_transfer_queue_depth{queue}` gauge (commit + cleanup)
- `data_transfer_dlq_depth` gauge
- `data_transfer_cleanup_removed_total` counter

**Sentry**: custom span `dataTransferOperation` via `@sentry/nextjs` startSpan envolvendo parse/commit/export. Erros com tag `jobId`.

**Logs JSON**: pino estruturado — `jobId, direction, entity, companyId, userId, stage, duration_ms`.

**Runbook `docs/runbooks/data-transfer.md`**: health, métricas-chave, troubleshoot (TIMEOUT_QUARANTINE, DLQ inspect/reprocess, storage errors, rate-limit errors).

---

## 9. Histórico retention

Cron `data-transfer-history-purge` semanal (domingos 02:00):
- Soft-delete `DataTransferJob WHERE createdAt < now() - interval '90 days'`.
- `storage.deletePrefix` para cada.
- Audit `data_transfer.history.purged` count.

---

## 10. Fallback e recuperação

| Cenário | Comportamento |
|---------|---------------|
| Redis down | Sync ≤5k degrada com warning; async >5k retorna 503 claro |
| S3 down prod | Upload 503 toast "Storage indisponível" |
| Postgres lock timeout 30s | Release via advisory; próximo tenant entra; worker backoff |
| Worker crash mid-chunk | Retry BullMQ; `committedChunks` skip idempotência |
| Arquivo corrompido pós-upload | parseImportFile erro; status=failed; cleanup cron remove |
| DLQ acumulado | Alertar via métrica; runbook reprocess manual |

---

## 11. Feature flag rollout

Ver 3.12. Duração total 14 dias staging→100% prod.

---

## 12. Riscos

| Risco | P | Imp | Mitigação |
|-------|:-:|:---:|-----------|
| Zip-bomb RAM | M | A | Streaming + ratio |
| Formula injection CSV/XLSX | M | A | Escape universal + force string |
| Import duplicado | M | M | SHA-256 dedupe 24h |
| OOM import grande | B | A | Streaming + cap 50k + batch |
| Signed URL vaza PII | B | M | TTL 1h + HMAC + audit |
| Lock longo DB | M | M | Advisory + tx independentes |
| Worker crash mid-commit | M | M | Retry + committedChunks |
| Encoding mal detectado | M | M | Confidence ≥70% + dropdown |
| Date ambíguo | A | M | Locale obrigatório |
| FK miss | A | B | Erro claro + lenient continua |
| S3 creds commit | B | A | Gitleaks CI + env-only |
| Rate-limit bypass | B | B | Key por user+hora |
| Custom attr drift mid-job | B | B | Snapshot persistido |
| Container UID perm | M | B | mkdirp + log warning |
| DLQ acumulado | M | M | Métrica + runbook |
| Cancel race (worker já committeu) | M | B | Sequência lock→read→process; cancel apenas marca status |

---

## 13. Critérios de sucesso

- [ ] Admin importa 5k leads CSV + 3 custom attrs em <15s sync.
- [ ] Admin importa 10k contacts XLSX via worker; progress SWR atualiza; <30s.
- [ ] Relatório erro CSV: `row_number, field, error_code, error_message, raw_value`.
- [ ] Export com filtro URL.
- [ ] Zip-bomb rejeitado msg clara.
- [ ] Formula-injection escapado CSV+XLSX (unit + E2E).
- [ ] Viewer sem `data-transfer:import` bloqueado.
- [ ] Super_admin com `history:all` cross-tenant.
- [ ] Feature flag ON/OFF sem redeploy.
- [ ] SHA-256 dedupe 24h + override funciona.
- [ ] Rollback UI remove 100% rows.
- [ ] Cancel mid-worker funciona.
- [ ] Round-trip byte-equivalente (excl id/createdAt/updatedAt/importJobId).
- [ ] ≥80 unit tests verdes (target 87).
- [ ] 7 integration verdes.
- [ ] 9 E2E verdes.
- [ ] `pnpm audit` 0 high/critical.
- [ ] OTel metrics + Sentry + logs JSON emitem.
- [ ] Runbook publicado.

---

## 14. Referências DS obrigatório

`PageHeader`, `Tabs`, `Dropzone*`, `Stepper*`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Input`, `Dialog`, `AlertDialog`, `DataTable`, `Badge`, `IconTile` (data-color canônico), `EmptyState`, `Progress`, `Sonner/toast`.

`*` = criar no DS (`packages/settings-ui/src/ui/`) se ausente — task 10b.0.

Invocar **`Skill ui-ux-pro-max:ui-ux-pro-max`** antes de cada task visual.

---

## 15. Não-metas

Ver seção 2 "Fora de escopo".

---

## 16. Deploy worker Portainer

Stack Portainer atual tem `nexus-crm-web`. Adicionar serviço:

```yaml
services:
  nexus-crm-worker-datatransfer:
    image: ${IMAGE}
    command: node dist/workers/data-transfer-commit.worker.js
    environment:
      - NODE_ENV=production
      - REDIS_URL=${REDIS_URL}
      - DATABASE_URL=${DATABASE_URL}
      - STORAGE_DRIVER=s3
      # ... S3 vars
    healthcheck:
      test: ["CMD", "node", "dist/workers/healthcheck.js", "commit"]
      interval: 30s
      retries: 3
    restart: unless-stopped
    deploy:
      replicas: 1 # advisory lock já serializa por tenant

  nexus-crm-worker-cleanup:
    image: ${IMAGE}
    command: node dist/workers/data-transfer-cleanup.worker.js
    # ... idem, replicas 1
```

Dockerfile reuso — CMD definido via serviço. Health check script `src/workers/healthcheck.ts` pinga BullMQ queue.

Runbook documenta comandos:
```sh
docker logs nexus-crm-worker-datatransfer --tail 100 -f
# Reprocess DLQ:
docker exec nexus-crm-worker-datatransfer node dist/scripts/dlq-reprocess.js data-transfer-commit
```
