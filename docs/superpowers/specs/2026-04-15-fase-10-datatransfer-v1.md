# Spec v1 — Fase 10: DataTransfer (import/export CSV/XLSX)

**Status:** v1 (primeira redação — sujeito a Review 1)
**Data:** 2026-04-15
**Fase:** 10 — DataTransfer
**Roadmap mestre:** linha 57
**Dependências:** Fase 5 (Custom Attributes) — para import/export incluir custom attrs
**Bloqueia:** nada crítico

## 1. Contexto

Usuários precisam trazer dados legados (Excel/CSV de outros CRMs) e exportar para análise externa. Hoje o CRM não tem ferramenta de import/export — o usuário precisa digitar tudo.

## 2. Escopo

### Incluído
- **Import** CSV e XLSX para Lead/Contact/Opportunity/Product.
- **Mapeamento de colunas** via UI (wizard 3 passos: upload → mapeamento → preview+confirm).
- **Validação por row** com relatório de erros (download do relatório).
- **Modo dry-run** (preview sem salvar).
- **Export** CSV e XLSX do mesmo conjunto com filtros da listagem ativos.
- **Inclui custom attributes** (Fase 5).
- **Defesas do roadmap:**
  - Limite tamanho: 20MB.
  - Limite linhas: 50k.
  - Zip-bomb: detecção via ratio compressed/uncompressed > 100.
  - CSV formula-injection: prefixar `=/+/-/@` com `'`.
  - Encoding: forçar UTF-8 (BOM ok); rejeitar se detectar binário.
  - Timeout parsing: 60s hard.
  - Mime real (magic bytes) vs ext claimed.
  - Quarentena: upload em dir `/tmp/crm-import-quarantine/<uuid>` + scanner antes de commit.

### Fora de escopo (YAGNI)
- Google Sheets integration (v2).
- Import incremental com "match existing by email" + update (v2).
- JSON/XML format (MVP = CSV/XLSX).
- Import de Activity/Mailbox/Workflow.
- Agendamento recorrente de import (cron).
- Webhook notificando fim do import (Fase 11b).

## 3. Arquitetura

### 3.1. Fluxo import

1. **Upload** (multipart/form-data) → server action `uploadImportFile(entity, file)`.
2. **Parse** server-side em `src/lib/datatransfer/parse.ts`:
   - CSV via `papaparse` (com limite linhas/size).
   - XLSX via `exceljs` (streaming; rejeita zip-bomb).
   - Detecta encoding (chardet) e mime real (file-type).
3. **Retorna** estatísticas: rows, colunas detectadas, sample (primeiras 5 rows).
4. **Wizard passo 2:** usuário mapeia colunas → campo do modelo. Auto-suggest por similaridade (Levenshtein) nome coluna ↔ field name.
5. **Preview dry-run:** server action `previewImport(quarantineId, mapping)` valida cada row com Zod (reusando schemas existentes) + custom attrs. Retorna `{ validCount, errorCount, errorsByRow: [{row, field, message}] }`.
6. **Confirm:** server action `commitImport(quarantineId, mapping, options)`. Transaction batched em chunks de 500 rows (transaction por chunk — evita lock).
7. **Cleanup:** deleta arquivo quarentena ao fim (success ou rollback).

### 3.2. Fluxo export

1. Botão "Exportar" nas listagens Lead/Contact/Opportunity/Product.
2. Modal com opções: formato (CSV/XLSX), colunas (checkboxes incluindo custom attrs), incluir filtros atuais sim/não.
3. Server action `exportEntity(entity, format, columns, filters)` → gera arquivo em stream.
4. Response `Content-Disposition: attachment`.
5. **CSV formula-injection neutralizada:** prefixar `=/+/-/@` com `'` em qualquer string exportada.

### 3.3. Quarentena

```
/tmp/crm-import-quarantine/
  <uuid>/
    original.<ext>
    parsed.json  (normalized rows, post-validation)
    mapping.json (user-provided)
    meta.json    ({uploadedAt, uploadedBy, entity, status})
```

- TTL: 30 minutos. Cleanup job cron a cada 5min.
- Path resolvido via `path.resolve` + validação que fica dentro do root (anti-path-traversal).
- Permissões: modo 0600.

### 3.4. UI

**Rota:** `/settings/data-transfer`.
- Tabs: Import | Export | Histórico.
- Histórico: últimas 50 operações com status, user, rowCount, download de relatório.
- Persistência histórico: nova tabela `DataTransferJob`.

**Schema Prisma nova tabela:**
```prisma
model DataTransferJob {
  id           String    @id @default(uuid()) @db.Uuid
  companyId    String    @map("company_id") @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  direction    DataTransferDirection  // import | export
  entity       DataTransferEntity     // lead | contact | opportunity | product
  format       DataTransferFormat     // csv | xlsx
  status       DataTransferStatus     // pending | running | success | failed | rolled_back
  rowCount     Int?
  errorCount   Int       @default(0)
  errorReportUrl String? @db.Text  // signed URL quando gerado
  filename     String?   @db.VarChar(255)
  sizeBytes    BigInt?
  startedAt    DateTime?
  finishedAt   DateTime?
  durationMs   Int?
  createdAt    DateTime  @default(now())

  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([companyId, createdAt(sort: Desc)], name: "idx_dtj_company_recent")
  @@index([status, startedAt], name: "idx_dtj_queue")
  @@map("data_transfer_jobs")
}
```

### 3.5. Worker vs server action

Para rows ≤5k → processamento síncrono na action (pode esperar até 10s).
Para rows >5k → enqueue em `@nexusai360/queue` com job `data-transfer-commit`. Worker roda em background; UI polla status via `useSWR` no jobId.

## 4. RBAC

Nova permission: `data-transfer:execute` (admin/manager/super_admin).
- Viewer/seller: não vê tab de import, só export das próprias listas (reusa RBAC do módulo).

## 5. Segurança

- **Mime real obrigatório:** usa `file-type` package; ext `.csv` mas magic bytes ZIP → rejeita.
- **Zip-bomb:** para XLSX (zip container), checar ratio `uncompressed/compressed` via `yauzl` ou `exceljs`; se >100 → rejeita.
- **Encoding:** detecta via `chardet`; rejeita se não for UTF-8/Latin-1/Windows-1252. Converter p/ UTF-8 sempre.
- **Formula-injection (OWASP CSV injection):** escapar qualquer célula começando com `=`, `+`, `-`, `@`.
- **Path traversal:** normalizar path e verificar está em root quarentena; nunca concat raw.
- **DoS memory:** streaming (papaparse streaming, exceljs stream API); nunca `readFileSync` em >20MB.
- **SSRF:** nada de URL remoto no MVP (arquivo só do upload direto).
- **Audit-log:** toda operação via `withAudit` com userId, entity, format, rowCount.

## 6. Validação de row

Reutiliza Zod schemas existentes em `src/lib/validations/<entity>.ts`. Para campos custom attr, consulta definições + valida tipo.

**Comportamento em erro:**
- Modo `strict` (default): qualquer row inválida aborta todo import.
- Modo `lenient`: pula rows inválidas, comita válidas, anexa relatório CSV com erros.
Usuário escolhe no wizard.

## 7. Export

- CSV: delimiter `,`, quote `"`, linha CRLF, UTF-8 BOM opcional.
- XLSX: planilha única, header bold + freeze top row, coluna `auto-width`.
- Custom attrs em colunas dinâmicas ao fim.
- Sempre escape formula-injection.
- Signed URL p/ download (S3 em prod; filesystem local em dev) válida 1h.

## 8. Testes

### 8.1. Unit
- `parse.test.ts` — CSV basic, XLSX basic, zip-bomb rejeitado, mime mismatch rejeitado, encoding latin1 convertido.
- `mapping.test.ts` — auto-suggest Levenshtein retorna top 3 matches por coluna.
- `validator.test.ts` — Zod por entity, custom attrs typed, erro aggregation.
- `formula-injection.test.ts` — `=1+1` vira `'=1+1`.
- `query-builder-export.test.ts` — filtros da lista aplicados no export.

### 8.2. Integration
- Import 1000 leads CSV → commit → 1000 rows no DB com companyId correto.
- Export 1000 leads → CSV válido re-importável (round-trip).

### 8.3. E2E
- admin: upload CSV 10 rows → mapeia → preview (10 valid 0 error) → confirm → /leads mostra 10 novos.
- admin: upload CSV malformado → preview mostra 5 error → download relatório.
- viewer: /settings/data-transfer → 403.
- export admin: filtro `?status=new` → arquivo CSV só com status=new.

## 9. Performance

- Batch commit 500 rows/transaction.
- Worker usa BullMQ existente (Fase 8).
- Budget: 10k rows import em <30s; export 10k em <5s.

## 10. Observabilidade

- Métrica: `data_transfer.rows_processed`, `data_transfer.duration_ms`, `data_transfer.errors_total`.
- Log por job: JSON structured com jobId/direction/entity/format.
- Sentry: erros de parsing e commit.

## 11. Feature flag

`FEATURE_DATA_TRANSFER` via `src/lib/flags`. OFF default; flip per tenant allowlist após staging.

## 12. Riscos

| Risco | Mitigação |
|-------|-----------|
| Zip-bomb esgota RAM | streaming + ratio check |
| Formula-injection no CSV gerado | escape universal |
| Row duplicada (import 2x) | idempotency key opcional (futuro); MVP documenta que operador deve evitar |
| Memory OOM import grande | streaming + batch commits + cap 50k rows |
| Histórico vaza PII | errorReport URL expirada + hash filename |
| Lock longo no DB | chunks pequenos em transactions independentes |

## 13. Critérios de sucesso

- [ ] Admin importa 5k leads CSV com 3 custom attrs em <15s.
- [ ] Relatório de erro disponível download CSV.
- [ ] Export mantém filtros atuais da lista.
- [ ] Zip-bomb rejeitado com mensagem clara.
- [ ] Formula-injection escapado (teste unit).
- [ ] Viewer não acessa rota.
- [ ] Feature flag permite OFF.
- [ ] 25+ unit tests verdes.
- [ ] 3 E2E passando.
- [ ] `npm audit` 0 high/critical.
