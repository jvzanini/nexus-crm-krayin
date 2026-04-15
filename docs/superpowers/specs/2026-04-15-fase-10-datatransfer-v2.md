# Spec v2 — Fase 10: DataTransfer (import/export CSV/XLSX)

**Status:** v2 (pós Review 1 — sujeito a Review 2 pente fino)
**Data:** 2026-04-15
**Fase:** 10 — DataTransfer
**Dependências:** Fase 5 Custom Attributes (deployed), @nexusai360/{core, multi-tenant, audit-log, queue}, DS nexus-blueprint.
**Bloqueia:** nada crítico.

---

## 0. Changelog v1 → v2

Incorporou Review 1 (ver `docs/superpowers/reviews/2026-04-15-fase-10-v1-review-1.md` quando commitado):

- **B1** storage adapter explícito (interface + impl dev/prod).
- **B2** DS components do nexus-blueprint referenciados por nome.
- **B3** Zod schemas de import derivados + FK lookup definidos.
- **B4** query-builder compartilhado export ↔ listagem.
- **B5** RBAC matriz completa (4 perms).
- **B6** worker BullMQ contrato completo (payload Zod, retry, idempotência, progress).
- **B7** audit events enumerados.
- **B8** migration com enums + campos extras.
- **B9** CSRF + rate-limit + AV decidido.
- **B10** encoding fallback manual + BOM explícito.
- **M1** decomposição em 3 ondas (10a backend, 10b UI, 10c obs/flag) — **mesma spec, mesmo plan, mas tasks agrupadas em waves**.
- **M3** último mapping persistido por (userId, entity).
- **M7** locale picker (date/number format) no wizard.
- **M11** SHA-256 dedupe com override.
- Demais M/nits incorporados ao longo.

---

## 1. Contexto

Usuários trazem dados legados (CSV/XLSX de outros CRMs) e exportam para análise externa. CRM hoje não tem I/O em massa — digitação manual. Fase 10 entrega import/export seguro, auditado, com suporte a custom attrs (Fase 5).

## 2. Escopo

### Incluído
- **Import CSV/XLSX** para Lead, Contact, Opportunity, Product.
- **Wizard 3 passos** (upload → mapeamento+locale → preview+confirm).
- **Mapeamento manual + auto-suggest** (Levenshtein threshold ratio ≥ 0.7).
- **Locale picker por coluna data/número** (ISO/BR/US; decimal vírgula/ponto).
- **Custom attrs** — lê defs e injeta schema dinâmico.
- **Preview dry-run** com sample 1000 rows + botão "validar tudo".
- **Modos strict / lenient** (escolha no wizard).
- **Commit batch** 500 rows/tx, sync ≤5k, worker >5k.
- **Export CSV/XLSX** das mesmas 4 entidades com filtros da listagem ativos.
- **Defesas roadmap**: 20MB/50k rows/zip-bomb/formula-injection/encoding/mime-real/timeout-60s/path-traversal/DoS-streaming/quarentena-TTL.
- **Dedupe idempotência**: SHA-256 do arquivo; bloqueio 24h mesmo (companyId, entity) com override.
- **Histórico** 50 últimos em `/settings/data-transfer` → aba Histórico com download relatório.
- **Storage adapter** interface + S3 prod + filesystem dev.
- **RBAC** 4 permissions granulares.
- **Audit events** 6 eventos canônicos.
- **Feature flag** `FEATURE_DATA_TRANSFER` default OFF, flip per tenant.

### Fora de escopo (YAGNI)
- Google Sheets integration.
- Import incremental (update existing by email) — v2 futuro.
- JSON/XML format.
- Import de Activity, Mailbox, Workflow, Task, Segment, Campaign.
- Scheduler recorrente (cron).
- Webhook de conclusão (Fase 11b).
- Antivirus ClamAV (adiado; escopo explícito só de mime real + zip-bomb).
- Template de mapping nomeado (salvamos apenas último — v2 feature é template named).
- SSE/WebSocket progress (SWR polling 2s suficiente).

---

## 3. Arquitetura

### 3.1. Decomposição em ondas

A spec é **uma única fase** mas a implementação se divide em 3 ondas no plan (ver plan v3). Waves podem sobrepor via subagent-driven-development:

| Wave | Entregáveis |
|------|-------------|
| **10a — Backend core** | migration Prisma + enums + storage adapter + Zod import schemas + FK lookup + parse/validate/commit/export libs + BullMQ worker + quarentena cron + audit events + RBAC + rate-limit + feature flag |
| **10b — UI** | `/settings/data-transfer` + Wizard 3 passos + Export Dialog + Histórico table + progress SWR |
| **10c — Verification+obs** | observability (métricas + Sentry) + E2E Playwright + round-trip integration + docs runbook + deploy flag |

Subagents trabalham em paralelo onde possível.

### 3.2. Fluxo import

1. **Upload** via server action `uploadImportFile(entity, fileBuffer, filename)`:
   - Valida tamanho ≤20MB.
   - Valida **mime real** via `file-type` (magic bytes) vs ext (rejeita mismatch).
   - Valida **CSRF**: server action (Next 16 built-in) + rate-limit (`@nexusai360/core/rate-limit` key `data-transfer:upload:<userId>`, 10/hora).
   - **Dedupe SHA-256**: calcula hash; consulta `DataTransferJob` por `(companyId, entity, fileHash, createdAt > now-24h, direction=import)`. Se match → retorna `{ duplicate: true, jobId }` + exige override `?force=true`.
   - Persiste via `StorageAdapter.put("quarantine/<companyId>/<jobId>/original.<ext>", buffer)`.
   - Cria `DataTransferJob` status=`pending`, `quarantineId=jobId`, `fileHash`, `sizeBytes`, `filename`.
   - Retorna `{ jobId, quarantineId }`.

2. **Parse** server action `parseImportFile(jobId)`:
   - Lê via `StorageAdapter.get(path)` → stream.
   - **Detecta BOM** (UTF-8 EF BB BF, UTF-16 LE/BE FF FE / FE FF) — se UTF-16, rejeita com mensagem clara (exige conversão prévia).
   - **Chardet**: confidence ≥70% → aceita; <70% → retorna `{ needsEncoding: true, candidates: [...] }` — UI oferece dropdown no wizard passo 1.
   - Converte via `iconv-lite` para UTF-8 sempre.
   - **CSV**: `papaparse` com `worker: false, chunk: ...` streaming; aborta se rows > 50_000 ou ≥60s wall clock.
   - **XLSX**: `exceljs.stream.xlsx.WorkbookReader` — checa ratio `uncompressed/compressed > 100` via `yauzl` pré-read; aborta.
   - Extrai headers (row 1) + sample 5 rows.
   - Retorna `{ rows, columns: string[], sample: Record<string, string>[] }`. Rows não persistidas ainda.

3. **Mapping UI** (wave 10b) — frontend monta UI Wizard; usuário mapeia colunas → campos do modelo. Auto-suggest: `fast-levenshtein` compara `column ↔ fieldName` e `column ↔ fieldLabel`; retorna top 3 com score, UI pre-preenche se ratio ≥ 0.7.

4. **Preview dry-run** server action `previewImport(jobId, mapping, locale, mode)`:
   - Aplica `importSchemaForEntity(entity, customAttrDefs)` — derivação de Zod:
     - Base schema `leadSchema.pick(...).partial()`.
     - Coerções por coluna mapeada: `dateBR → transform`, `moneyBRL → transform`, enum labels → values.
     - FK lookup: pre-fetcha Users (por email), Statuses (por name), etc; mapping converte string → FK id ou erro.
     - Custom attrs: injeta `z.object({ custom: z.object(dynamicShape) })` a partir de defs (reaproveita Fase 5 registry).
   - Roda validação em até **1000 rows sample** (ou todas se <1000); UI oferece "validar tudo" que processa em batches.
   - Retorna `{ validCount, errorCount, errorsByRow: [{row, field, code, message, rawValue}] }` + `sampleValidated` (primeiras 20 rows pós-transform).
   - Modo `strict`: primeira row inválida já flagada como bloqueante.
   - Modo `lenient`: continua contagem.

5. **Commit** server action `commitImport(jobId, mapping, locale, mode, override?)`:
   - Se rows ≤5k: processa sync em chunks de 500 rows via `prisma.$transaction([...])`; entre chunks não faz tx global (chunks são independentes, rollback total requer logical undo — ver item 6).
   - Se rows >5k OU opção `async=true` sempre: enqueue job `data-transfer-commit`.
   - Atualiza `status = running`, `startedAt = now()`.

6. **Commit lógico — idempotência e rollback**:
   - Cada chunk grava rows com `importJobId = jobId` (nova coluna soft em Lead/Contact/Opportunity/Product).
   - Se worker crashar mid-job: retry BullMQ descarta chunks já commitados (identifica por `committedChunks` em `DataTransferJob.progress.committedChunks`) e reinicia do próximo.
   - **Rollback on-demand** (modo strict falhou mid-processing): action `rollbackImport(jobId)` deleta rows `WHERE importJobId = jobId`. Seta `status = rolled_back`.
   - Audit de rollback obrigatório.

7. **Cleanup**:
   - `StorageAdapter.delete(quarantineDir)` chamado ao marcar status final (success/failed/rolled_back).
   - Cron independente (ver 3.5) remove quarentenas órfãs >30min.

### 3.3. Fluxo export

1. Botão "Exportar" na listagem (reusa `DataTableToolbar` do DS).
2. `Dialog` com:
   - Format: `RadioGroup` CSV / XLSX.
   - Columns: `Checkbox` list (core fields + custom attrs).
   - Include filters: `Switch` (se ON, usa filtros atuais da URL).
   - Encoding (CSV only): BOM sim/não (default ON para Excel Windows).
3. Server action `exportEntity(entity, format, columns, filters, options)`:
   - **Reusa `buildListQuery(entity, filters, { tenant })`** (helper compartilhado — se não existir, criar como Task 10a.6; Spec condiciona sua existência).
   - Cap: 50_000 rows. Se exceder → retorna erro `{ code: 'EXPORT_TOO_LARGE', rowCount }`; UI sugere refinar filtros.
   - Gera stream:
     - CSV: `papaparse.unparse` com delimiter `,`, quote `"`, CRLF, UTF-8 + BOM opcional. **Formula-injection escape**: qualquer cell string iniciando com `=/+/-/@/\t/\r` prefixa `'`.
     - XLSX: `exceljs.stream.xlsx.WorkbookWriter` — header bold + freeze top row. Auto-width desligado (custo O(n·c)); larguras fixas heurísticas (15ch default, 40ch campos text long). **Todas cells forçadas `type: 'string'` via `cell.value = { richText: [...] }`** — previne fórmula.
   - Upload arquivo para `StorageAdapter.put("exports/<companyId>/<jobId>.<ext>")`.
   - Cria `DataTransferJob` direction=export, status=success, `errorReportKey = path`.
   - Retorna `{ signedUrl }` válido 1h via `StorageAdapter.signedUrl(path, { ttlSec: 3600 })`.
4. UI redireciona download via `<a href={signedUrl} download>`.

### 3.4. Storage adapter

Interface nova em `src/lib/storage/index.ts`:

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
  if (process.env.STORAGE_DRIVER === 's3') return new S3StorageAdapter({ ... });
  return new FsStorageAdapter({ root: process.env.STORAGE_FS_ROOT ?? '/tmp/crm-storage' });
}
```

- **FsStorageAdapter**: `path.resolve` + check root; `fs.promises` com `mode: 0o600`; signedUrl é route handler `/api/storage/signed?key=...&sig=...&exp=...` (HMAC SHA-256 + TTL; secret = `STORAGE_SIGN_SECRET`).
- **S3StorageAdapter**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Env: `S3_ENDPOINT` (opcional p/ MinIO), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET`.
- Path layout: `<direction>/<companyId>/<jobId>/<file>`. Multi-tenant: `companyId` obrigatório no prefix.
- Não exportar server actions do adapter (actions-as-props lei de pacotes — aqui não é pacote, é módulo interno, mas manter contrato puro de dados).

### 3.5. Quarentena TTL cron

Novo worker `src/workers/data-transfer-cleanup.worker.ts`:

- Registra BullMQ repeatable job `data-transfer-cleanup` interval 5min.
- Lista `DataTransferJob` status∈{pending, running} + `createdAt < now-30min` → marca `status=failed` + `errorMessage="TIMEOUT_QUARANTINE"` + `StorageAdapter.deletePrefix("quarantine/<companyId>/<jobId>/")`.
- Idempotente (várias instâncias worker OK).

### 3.6. Worker commit

Novo worker `src/workers/data-transfer-commit.worker.ts`:

- Queue `data-transfer-commit` em Redis (@nexusai360/queue).
- **Payload Zod**:
  ```ts
  const dataTransferCommitJobSchema = z.object({
    jobId: z.string().uuid(),
    companyId: z.string().uuid(),
    userId: z.string().uuid(),
    entity: z.enum(['lead','contact','opportunity','product']),
    mode: z.enum(['strict','lenient']),
    locale: z.object({ dateFormat: z.enum(['iso','br','us']), decimalSep: z.enum(['.',',']) }),
    mapping: z.record(z.string(), z.string()), // column -> field
  });
  ```
- **Retry**: 3 tentativas, backoff exponencial (1s, 4s, 16s). Última falha → DLQ `data-transfer-dlq`.
- **Concurrency**: 1 por `companyId` (advisory lock Postgres `pg_advisory_lock(hashtext('dt:'+companyId))`) — evita 10 imports paralelos do mesmo tenant esgotarem pool Prisma.
- **Progress**: após cada chunk, atualiza `DataTransferJob.rowCount += chunk.length, progress.committedChunks.push(chunkIdx)`. UI polla via SWR 2s.
- **Idempotência**: ao iniciar, lê `progress.committedChunks`; pula chunks já feitos; continua do próximo.

### 3.7. UI (wave 10b)

Rota `/settings/data-transfer` (server component):

- **Layout**: `PageHeader` title="Importar / Exportar" subtitle="Migre dados em CSV ou XLSX".
- **`Tabs`** (DS variant padrão): Import | Export | Histórico.
- **Import tab** — `ImportWizard` client component:
  - Steps via `Stepper` (se não existir no DS, criar `packages/settings-ui/src/ui/stepper.tsx` na wave 10b como primeira task).
  - Step 1 `UploadStep`:
    - `Dropzone` (criar se não existir — use `react-dropzone` interno ao DS).
    - Entity `Select` (Lead/Contact/Opportunity/Product).
    - On upload → chama `uploadImportFile` → mostra `Progress` + sample preview.
    - Se `needsEncoding` → `Select` encoding.
  - Step 2 `MappingStep`:
    - Tabela `column → field`. Auto-sugeridos em destaque visual (`Badge` variant=secondary).
    - Para colunas tipo data/número → `Select` locale (ISO/BR/US; vírgula/ponto).
    - Modo `RadioGroup` strict / lenient.
  - Step 3 `PreviewStep`:
    - Card com `validCount` / `errorCount` + `Button` "Validar tudo" se só sample.
    - Tabela primeiras 20 rows validadas + aba erros.
    - `Button` "Importar" (disabled se strict+errorCount>0).
- **Export tab** — `ExportPanel` com lista 4 entidades, cada uma com `Button` "Abrir diálogo". `ExportDialog` client: form como 3.3.
- **Histórico tab** — `DataTable` com colunas [timestamp, direction, entity, format, rows, status (`IconTile` colorido), user, actions]. Paginação 50 rows.
- **Empty states**: `EmptyState` do DS em cada tab quando zerado.
- **Feedback**: `Sonner`/`toast` para sucesso/erro.
- **Acessibilidade**: aria-labels, `role="progressbar"` no progress, `role="alert"` em erros.
- **Responsivo**: wizard empilha em <md (`flex-col`).

### 3.8. Schema Prisma

Novas enums + model:

```prisma
enum DataTransferDirection { import  export }
enum DataTransferEntity    { lead    contact    opportunity    product }
enum DataTransferFormat    { csv     xlsx }
enum DataTransferStatus    { pending running success failed rolled_back }

model DataTransferJob {
  id               String   @id @default(uuid()) @db.Uuid
  companyId        String   @map("company_id") @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  direction        DataTransferDirection
  entity           DataTransferEntity
  format           DataTransferFormat
  status           DataTransferStatus   @default(pending)
  quarantineId     String?  @map("quarantine_id") @db.Uuid
  fileHash         String?  @map("file_hash") @db.VarChar(64)
  filename         String?  @db.VarChar(255)
  sizeBytes        BigInt?  @map("size_bytes")
  rowCount         Int      @default(0)
  errorCount       Int      @default(0)
  errorReportKey   String?  @map("error_report_key") @db.Text
  progress         Json     @default("{}")
  errorMessage     String?  @map("error_message") @db.Text
  startedAt        DateTime? @map("started_at")
  finishedAt       DateTime? @map("finished_at")
  durationMs       Int?     @map("duration_ms")
  createdAt        DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([companyId, createdAt(sort: Desc)], map: "idx_dtj_company_recent")
  @@index([status, startedAt], map: "idx_dtj_queue")
  @@index([companyId, entity, fileHash, createdAt(sort: Desc)], map: "idx_dtj_dedupe")
  @@map("data_transfer_jobs")
}
```

Adiciona coluna soft `importJobId String? @db.Uuid` em `Lead`, `Contact`, `Opportunity`, `Product` (para rollback seletivo). Index `(companyId, importJobId)` em cada.

### 3.9. Reuso de query builder export

Cria/formaliza `src/lib/queries/build-list-query.ts`:

```ts
export function buildListQuery<E extends Entity>(
  entity: E,
  filters: ListFilters,
  ctx: { companyId: string; userId: string; isSuperAdmin: boolean }
): Prisma.<E>FindManyArgs {...}
```

Reusado por: (a) API/actions de listagem atuais (refactor consome helper), (b) export server action. Garantia: filtros da UI = filtros export.

Se refactor total das listagens for custo alto, alternativa viável: export serializa `filters` via querystring, action de export reusa os **schemas Zod** existentes de filter e **re-invoca** os MESMOS queries helpers já existentes (audit por diff de contrato durante plan review).

### 3.10. RBAC matriz

Novas permissions em `src/constants/permissions.ts`:

```
data-transfer:import        — fazer upload e commit de import
data-transfer:export        — gerar export
data-transfer:history:read  — ver histórico da própria company
data-transfer:history:all   — ver histórico de qualquer company (super_admin only)
```

Matriz:

| Permission                    | super_admin | admin | manager | seller | viewer |
|-------------------------------|:-----------:|:-----:|:-------:|:------:|:------:|
| `data-transfer:import`        | ✅          | ✅    | ✅      | ❌     | ❌     |
| `data-transfer:export`        | ✅          | ✅    | ✅      | ✅     | ✅     |
| `data-transfer:history:read`  | ✅          | ✅    | ✅      | ✅     | ✅     |
| `data-transfer:history:all`   | ✅          | ❌    | ❌      | ❌     | ❌     |

Tenant scoping: `buildTenantFilter({ userId, isSuperAdmin })` aplicado a `DataTransferJob` queries. Super_admin com `history:all` pode filtrar por companyId arbitrário.

### 3.11. Audit events

Em `src/lib/audit-log/events.ts` (canônico):

- `data_transfer.import.uploaded` — `{ jobId, entity, filename, sizeBytes, fileHash }`
- `data_transfer.import.previewed` — `{ jobId, validCount, errorCount, mode }`
- `data_transfer.import.committed` — `{ jobId, rowCount, errorCount, durationMs }`
- `data_transfer.import.rolled_back` — `{ jobId, rowCountRemoved, reason }`
- `data_transfer.export.generated` — `{ jobId, entity, format, rowCount, columnCount, durationMs }`
- `data_transfer.export.downloaded` — `{ jobId, actorIp, userAgent }` (via route handler da signed URL)

Todos via `withAudit` ou `audit.log(...)` wrappers existentes. PII mascarada conforme logger config (Fase 5 precedente).

### 3.12. Feature flag

Nome: `data_transfer` (snake). Registro em `src/lib/flags/registry.ts`.

Default OFF global. Flip per tenant via `Tenant.features` JSONB (mecanismo Fase 5).

UI: rota `/settings/data-transfer` retorna 404 se flag OFF para o tenant do user. Menu sidebar mostra item só se flag ON.

---

## 4. Segurança consolidada

- **Tamanho**: ≤20MB enforced no `uploadImportFile`.
- **Rows**: ≤50_000 enforced em parse (abort mid-stream).
- **Mime real**: `file-type` magic bytes; rejeita mismatch ext↔mime.
- **Zip-bomb**: ratio uncompressed/compressed >100 em XLSX → abort.
- **Formula-injection**: escape universal CSV+XLSX (`=`, `+`, `-`, `@`, `\t`, `\r` → prefixo `'`).
- **Encoding**: BOM detect → chardet (conf ≥70%) → iconv-lite para UTF-8. Fallback manual dropdown.
- **Timeout**: 60s wall clock em parse.
- **Path traversal**: `path.resolve` + check dentro root; nunca concat raw.
- **DoS memory**: streaming papaparse/exceljs; nunca `readFileSync`.
- **SSRF**: no remote URL no MVP.
- **CSRF**: Next 16 server actions (built-in token).
- **Rate-limit**: 10 uploads/hora/user + 5 exports/hora/user (`@nexusai360/core/rate-limit`).
- **Audit**: 6 eventos canônicos, PII mascarada.
- **RBAC**: 4 permissions granulares.
- **Tenant scoping**: `buildTenantFilter` em todas queries.
- **Storage perms**: S3 bucket policy least-privilege; FS 0600.
- **Signed URL**: TTL 1h, HMAC + exp em FsAdapter.
- **Dedupe SHA-256**: bloqueia reimport 24h sem override.
- **ClamAV**: explicitamente fora do MVP (nota: instalar em v2 se SOC2 exigir).

---

## 5. Validação, locale e FK lookup

### 5.1. Schemas de import por entity

Arquivo `src/lib/datatransfer/schemas/<entity>-import.ts`:

```ts
export function leadImportSchema(ctx: ImportSchemaCtx) {
  return z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    ownerEmail: z.string().email().optional().transform(async (v) => v ? await ctx.lookupOwner(v) : undefined),
    statusLabel: z.string().optional().transform(async (v) => v ? await ctx.lookupStatus(v) : undefined),
    createdAt: dateCoerce(ctx.locale.dateFormat).optional(),
    custom: dynamicCustomShape(ctx.customAttrDefs),
  });
}
```

Idem `contactImportSchema`, `opportunityImportSchema`, `productImportSchema`.

### 5.2. FK lookup helper

`src/lib/datatransfer/lookup.ts`:

- `lookupOwner(email, { companyId })`: cache Map pre-fetched once per job (`prisma.user.findMany({ where: { companyId }, select: { id, email } })`), returns id or throws `FK_NOT_FOUND`.
- `lookupStatus(label, { companyId, entity })`, `lookupStage(label, { companyId })`, `lookupProduct(sku, { companyId })` idem.

### 5.3. Locale coerce

- `dateCoerce('iso'|'br'|'us')`: parse `YYYY-MM-DD` / `DD/MM/YYYY` / `MM/DD/YYYY`. Lança se ambíguo e formato != escolhido (ex: valor `2026-04-15` com locale BR → rejeita).
- `moneyCoerce(decimalSep)`: troca `,`→`.` se BR; parse Number; valida finite.

### 5.4. Custom attrs

Lê `CustomAttributeDef` por entity do companyId. Gera `dynamicCustomShape`:

```ts
function dynamicCustomShape(defs: CustomAttributeDef[]) {
  const shape: ZodRawShape = {};
  for (const def of defs) {
    shape[def.slug] = buildZodForType(def.type, def);
  }
  return z.object(shape).partial();
}
```

---

## 6. Testes

### 6.1. Unit (target ≥35)

Por módulo:

- `parse.test.ts` — CSV basic, XLSX basic, BOM UTF-8/UTF-16 rejeitado, zip-bomb rejeitado, mime mismatch rejeitado, encoding latin1 converted, timeout 60s, rows>50k abort, size>20MB abort. (9)
- `mapping-levenshtein.test.ts` — auto-suggest top 3, ratio ≥0.7, empty columns, collision. (4)
- `schemas/lead-import.test.ts` — valid row, invalid email, FK not found, custom attr typed. (4)
- `schemas/contact-import.test.ts` — idem (4)
- `schemas/opportunity-import.test.ts` — idem (3)
- `schemas/product-import.test.ts` — idem (3)
- `lookup.test.ts` — owner email OK/missing, status label OK/missing, cache hit. (5)
- `date-coerce.test.ts` — iso/br/us happy + ambiguous rejeita. (5)
- `money-coerce.test.ts` — vírgula/ponto + edge cases (negative, exponent rejected). (3)
- `formula-injection.test.ts` — =/+/-/@/\t/\r → prefix; CSV+XLSX. (6)
- `storage-fs-adapter.test.ts` — put/get/delete/signedUrl HMAC valid + expired. (5)
- `storage-s3-adapter.test.ts` — mock aws-sdk v3, put/signedUrl. (3)
- `query-builder-export.test.ts` — filtros URL → Prisma args; tenant enforced. (4)
- `worker-commit.test.ts` — payload Zod, chunk progress, retry+backoff, DLQ, resume após crash. (6)
- `worker-cleanup.test.ts` — TTL expiry, deleta storage, marca failed. (3)
- `rbac.test.ts` — matriz 5 roles × 4 perms. (20 table-driven)
- `dedupe.test.ts` — SHA-256 match <24h bloqueia, override libera. (3)
- `feature-flag.test.ts` — ON/OFF gate. (2)
- `export-stream.test.ts` — CSV 1k rows, XLSX 1k rows, cap 50k erro. (3)

### 6.2. Integration (target 6)

- Import 1000 leads CSV → commit sync → 1000 rows DB com companyId correto.
- Import 10k contacts CSV → worker enqueue → polling status → success.
- Round-trip: export 500 opportunities → re-import → dados byte-equivalentes (excl. id/createdAt).
- Rollback: import strict mid-error → partialrows removed.
- Super_admin tenant A lista histórico de B (history:all).
- Rate-limit: 11 uploads/hora → 11º rejeitado.

### 6.3. E2E Playwright (target 6)

- admin: upload CSV 10 rows → mapeia → preview (10 valid 0 error) → confirm → `/leads` mostra 10 novos.
- admin: upload CSV malformado lenient → preview 5 error → commit 5 valid → download relatório.
- admin: upload CSV strict com erro → preview bloqueia commit.
- viewer: acessa `/settings/data-transfer` → 404 (flag on) ou 403 (sem perm).
- admin: export leads com filtro `?status=new` → baixa CSV → abre → verifica apenas rows status=new.
- admin: upload 60k rows → erro claro "máximo 50.000".

---

## 7. Performance e SLO

- Parse 10k rows ≤3s (CSV) / ≤8s (XLSX).
- Preview 1k sample ≤1s.
- Commit sync 5k rows ≤15s.
- Commit worker 10k rows ≤30s.
- Export 10k rows ≤5s (CSV) / ≤12s (XLSX).
- Budget atualizado vs v1: XLSX export elevado por auto-width removido → 12s real.

Benchmarks em `scripts/bench-datatransfer.mjs` — roda em CI weekly.

---

## 8. Observabilidade (wave 10c)

- **Métricas** (OpenTelemetry; stack projeto já tem — confirmar na wave 10c. Se não houver, usar Prom via `@opentelemetry/exporter-prometheus`):
  - `data_transfer_rows_total{direction, entity, status}` counter
  - `data_transfer_duration_ms{direction, entity}` histogram
  - `data_transfer_errors_total{direction, entity, code}` counter
  - `data_transfer_queue_depth` gauge
- **Sentry**: custom `dataTransferSpan` envolvendo parse/commit/export; erros capturados com `jobId` tag.
- **Logs structured JSON**: `jobId`, `direction`, `entity`, `companyId`, `userId`, `stage`, `duration_ms`.
- **Dashboard**: documentar no runbook (`docs/runbooks/data-transfer.md`).

---

## 9. Histórico retention

Cron `data-transfer-history-purge` semanal:

- Soft-delete rows `DataTransferJob WHERE createdAt < now() - 90 days`.
- `StorageAdapter.deletePrefix("<direction>/<companyId>/<jobId>/")` para cada.
- Audit event `data_transfer.history.purged` com count.

---

## 10. Fallback e recuperação

| Cenário | Comportamento |
|---------|---------------|
| Redis down (worker) | Sync path ainda funciona (≤5k). Import >5k retorna `{ async: false, reason: QUEUE_UNAVAILABLE }` e degrada para sync com warning (máx 10k). |
| Storage S3 down prod | Upload retorna 503; UI mostra toast "Storage indisponível". |
| Postgres lock longo | Advisory lock libera em 30s timeout → próximo tenant entra; worker atual recua com backoff. |
| Worker crash mid-chunk | Retry BullMQ; `committedChunks` skip idempotência. |
| Arquivo corrompido pós-upload | `parseImportFile` retorna erro; `status=failed`; quarentena removida pelo cleanup cron. |

---

## 11. Feature flag rollout

1. Deploy com flag OFF global.
2. Smoke test staging: flip ON tenant de staging; round-trip com 100 rows.
3. Flip ON 1 tenant piloto.
4. Monitorar 7 dias (logs, métricas, zero incidents).
5. Flip ON gradual 25% → 50% → 100% em 14 dias.

---

## 12. Riscos e mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|:----:|:-------:|-----------|
| Zip-bomb RAM exhaustion | M | Alto | Streaming + ratio check |
| Formula-injection em CSV/XLSX gerado | M | Alto | Escape universal + force string type |
| Import duplicado 2x | M | Médio | SHA-256 dedupe 24h |
| Memory OOM import grande | B | Alto | Streaming + 50k cap + batch commits |
| Histórico vaza PII via signed URL | B | Médio | URL TTL 1h + dedupe tenant path |
| Lock longo DB | M | Médio | Advisory lock + tx independentes por chunk |
| Worker crash mid-commit | M | Médio | Retry BullMQ + committedChunks idempotency |
| Encoding mal detectado | M | Médio | Confidence ≥70% + fallback dropdown |
| Date ambíguo (BR/US) | A | Médio | Locale picker obrigatório em coluna data |
| FK lookup miss | A | Baixo | Erro claro por row + modo lenient continua |
| Signed URL leak | B | Alto | TTL curto + HMAC + audit download |
| S3 credentials commitadas | B | Alto | Gitleaks CI (Fase 12.4) + env-only |
| Rate-limit bypass | B | Baixo | Key por user+hour |
| Custom attr schema drift mid-job | B | Baixo | Snapshot defs no job start |
| Container UID perm issue | M | Baixo | FsAdapter mkdirp com check; log warning |

---

## 13. Critérios de sucesso

- [ ] Admin importa 5k leads CSV com 3 custom attrs em <15s sync.
- [ ] Admin importa 10k contacts XLSX → worker, status polling atualiza progress, success em <30s.
- [ ] Relatório de erro CSV disponível download com colunas `row_number, field, error_code, error_message, raw_value`.
- [ ] Export mantém filtros atuais da lista (URL querystring).
- [ ] Zip-bomb rejeitado com mensagem "Arquivo suspeito (ratio de compressão anormal)".
- [ ] Formula-injection escapado em CSV+XLSX (test unit + E2E).
- [ ] Viewer não importa (falha permission); viewer exporta OK.
- [ ] Super_admin acessa histórico cross-tenant.
- [ ] Feature flag ON/OFF dinâmico sem redeploy.
- [ ] SHA-256 dedupe bloqueia reimport em <24h; override com `?force=true` funciona.
- [ ] Rollback remove 100% rows do job.
- [ ] Round-trip export→import byte-equivalente (excl id/createdAt).
- [ ] ≥35 unit tests verdes.
- [ ] 6 integration tests verdes.
- [ ] 6 E2E Playwright passando.
- [ ] `pnpm audit` 0 high/critical.
- [ ] Observabilidade: métricas emitidas + Sentry spans + logs structured.
- [ ] Runbook `docs/runbooks/data-transfer.md` publicado.

---

## 14. Referências DS (obrigatório)

Componentes **reusados** do nexus-blueprint / packages:

- `PageHeader` (settings-ui) — header rota.
- `Tabs` (base ui) — import/export/histórico.
- `Dropzone` ou novo `FileUpload` (DS) — upload.
- `Stepper` (novo no DS se ausente; checar `packages/settings-ui/src/ui` primeiro).
- `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Input` — forms.
- `Dialog` — export config + rollback confirm.
- `DataTable` — histórico (reuso do pattern users-ui/contacts).
- `Badge`, `IconTile` — status com data-color (`success`, `warning`, `error`, `info`).
- `EmptyState` — tabs zeradas.
- `Progress` — upload + worker progress.
- `Sonner`/toast — feedback.
- `AlertDialog` — rollback confirm.

**Palette/tipografia**: herdada do design system; sem override local. Invocar **`Skill ui-ux-pro-max:ui-ux-pro-max`** antes de cada task visual do wave 10b.

---

## 15. Não-metas

- Sync bidirecional ongoing com planilha externa.
- Mapping AI/ML.
- Import com merge dedupe (match-by-key update-or-create).
- Schedule recorrente.
- Export >50k em um único arquivo (paginar futuro).
- Import de arquivos em URL remota (SSRF-safe requer escopo maior).
