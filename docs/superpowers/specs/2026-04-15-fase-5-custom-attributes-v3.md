# Spec v3 FINAL — Fase 5: Custom Attributes

**Status:** v3 final (pós Review 1 + Review 2 profundo — todos os críticos endereçados)
**Changelog v2→v3:**
- **C8:** jobs unique index usam `prisma.$pool.$connect()` / `pg` client sem transação; `CREATE INDEX CONCURRENTLY IF NOT EXISTS` via query única; retry idempotente via `pg_indexes` check.
- **C9:** naming único por (entity, key, tenant) — index shared por (entity, key) com **refcount** em tabela `CustomAttributeUniqueRef`; primeiro tenant cria, último dropa.
- **C10:** schema Prisma **não** declara `@@index([custom], type: Gin)`; 100% via migration SQL manual.
- **C11:** purge usa `$executeRawUnsafe` com regex-validated key + `WHERE custom ? '${key}'`.
- **C12:** seed flag via `prisma.featureFlag.create({...})` direto (não `setFlag`).
- **I15:** matriz RBAC remove `seller` (inexistente em `PlatformRole` enum do DB).
- **I16:** server actions capturam `P2002`, mapeiam para "valor duplicado em <label>".
- **I17:** parser aceita ambos `cf[k][op]=v` e `cf_k_op=v`.
- **I18:** cap 32KB (não 64KB) por row; declarado como aproximação JSON-encoded.
- **I19:** testes adicionais para flag OFF/ON, CONCURRENTLY sem lock, CustomFieldsSection unit.
- **I20:** `piiMasked` pipeline: logger Pino redact + DSAR export redact + audit-log redact.
- **I21:** `contains` documentado como seq-scan; `eq/in/has_*` usam GIN.
- **I22:** listagem completa de arquivos a tocar (§4.3).
- **I23:** delete attr = **purge primeiro → DROP index depois** (job encadeado).
- **I24:** cap 256 chars por valor em `in`/`has_*`.
- **I25:** requer Postgres ≥ 12 para ADD COLUMN DEFAULT instant (projeto em PG16 — ok).
- **I26:** rollback declara perda de dados; flag OFF é rollback soft recomendado.
- **I27:** audit-log via `auditLog({...})` genérico (não há `src/lib/audit/` nem switch case).
- **I28:** invalidação de cache só server action (via `revalidateTag`); workers usam Redis pub/sub.
- **S1:** `options` tipado Zod: `Array<{value: string; label: string}>`.
- **S6:** campo Prisma `isUnique: Boolean` (não `unique`, evita choque com keyword TS).

## 1. Contexto e motivação
Ver v1. Mantido.

## 2. Escopo
Ver v2. Sem mudanças exceto caps (32KB/row, 256 chars/valor em in/has).

## 3. Arquitetura

### 3.1. Schema Prisma
```prisma
model CustomAttribute {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @map("company_id") @db.Uuid
  entity        CustomAttributeEntity
  key           String   @db.VarChar(80)
  label         String   @db.VarChar(120)
  type          CustomAttributeType
  required      Boolean  @default(false)
  isUnique      Boolean  @default(false) @map("is_unique")
  options       Json?    @default("[]")
  defaultValue  Json?    @map("default_value")
  placeholder   String?  @db.VarChar(200)
  helpText      String?  @map("help_text") @db.VarChar(500)
  minLength     Int?     @map("min_length")
  maxLength     Int?     @map("max_length")
  minValue      Decimal? @map("min_value") @db.Decimal(12, 4)
  maxValue      Decimal? @map("max_value") @db.Decimal(12, 4)
  position      Int      @default(0)
  visibleInList Boolean  @default(false) @map("visible_in_list")
  searchable    Boolean  @default(false)
  sortable      Boolean  @default(false)
  piiMasked     Boolean  @default(false) @map("pii_masked")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, entity, key])
  @@index([companyId, entity, position], name: "idx_custom_attr_form_order")
  @@map("custom_attributes")
}

model CustomAttributeUniqueRef {
  id         String   @id @default(uuid()) @db.Uuid
  entity     CustomAttributeEntity
  key        String   @db.VarChar(80)
  refCount   Int      @default(0) @map("ref_count")
  indexName  String   @map("index_name") @db.VarChar(128)
  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([entity, key])
  @@map("custom_attribute_unique_refs")
}

enum CustomAttributeEntity {
  lead
  contact
  opportunity
}

enum CustomAttributeType {
  text
  number
  date
  datetime
  boolean
  select
  multi_select
  url
}
```

Lead/Contact/Opportunity recebem `custom Json @default("{}")` — **sem** `@@index` no schema; GIN criado via SQL manual.

### 3.2. Migration SQL (1 arquivo)
`prisma/migrations/<ts>_custom_attributes/migration.sql`:
```sql
-- Enums
CREATE TYPE custom_attribute_entity AS ENUM ('lead','contact','opportunity');
CREATE TYPE custom_attribute_type AS ENUM ('text','number','date','datetime','boolean','select','multi_select','url');

-- Tabela principal + refcount
CREATE TABLE custom_attributes ( ... );  -- gerado pelo Prisma; spec aprova shape acima
CREATE TABLE custom_attribute_unique_refs ( ... );

-- JSONB columns + GIN
ALTER TABLE leads         ADD COLUMN custom jsonb NOT NULL DEFAULT '{}';
ALTER TABLE contacts      ADD COLUMN custom jsonb NOT NULL DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN custom jsonb NOT NULL DEFAULT '{}';

CREATE INDEX idx_lead_custom         ON leads         USING gin (custom jsonb_ops);
CREATE INDEX idx_contact_custom      ON contacts      USING gin (custom jsonb_ops);
CREATE INDEX idx_opportunity_custom  ON opportunities USING gin (custom jsonb_ops);
```
Rollback reverso documentado no mesmo diretório como comentário (Prisma não auto-gera).

### 3.3. Unique index shared por (entity, key) — refcount

Job `create-custom-attr-unique-index`:
1. `SELECT * FROM custom_attribute_unique_refs WHERE entity=? AND key=?` (via `prisma.customAttributeUniqueRef.findUnique`).
2. Se existe: `refCount++`, retorna (index já está criado, reuso).
3. Se não existe:
   - `indexName = 'idx_' + entity + '_custom_' + key + '_unique'` (80 chars max — PG limit é 63, trimar).
   - Criar via `pg` client dedicado (**sem tx**):
     ```typescript
     const client = new PgClient({ connectionString: process.env.DATABASE_URL });
     await client.connect();
     try {
       // idempotent via check
       const exists = await client.query(
         `SELECT 1 FROM pg_indexes WHERE indexname = $1`, [indexName]
       );
       if (exists.rowCount === 0) {
         await client.query(
           `CREATE UNIQUE INDEX CONCURRENTLY "${indexName}"
              ON ${entity}s ((custom->>$1), company_id)
              WHERE custom ? $1`,
           [key]
         );
       }
       await prisma.customAttributeUniqueRef.create({
         data: { entity, key, refCount: 1, indexName }
       });
     } finally {
       await client.end();
     }
     ```
   - **Key é regex-validated** (`^[a-z][a-z0-9_]{1,79}$`) antes do template literal — seguro contra SQL injection.

Job `drop-custom-attr-unique-index`:
1. `refCount--`.
2. Se `refCount === 0`:
   - `DROP INDEX CONCURRENTLY "idxname"` via `pg` client sem tx.
   - `prisma.customAttributeUniqueRef.delete(...)`.

### 3.4. Operadores allowlist
Ver v2 §3.4. Adicionado aviso: `contains` no op de `text`/`url` **faz seq scan** (ILIKE não usa GIN). Para queries frequentes, migrar para `eq`/`in` ou adicionar pg_trgm expression index em Fase 12.

### 3.5. RBAC (matriz v3)
| Role | view | manage |
|------|------|--------|
| super_admin | ✅ | ✅ |
| admin | ✅ | ✅ |
| manager | ✅ | ❌ |
| viewer | ✅ | ❌ |

(`seller` removido — não existe em `PlatformRole` DB enum.)

### 3.6. Filtros URL (aceita ambos)
- Preferido: `cf[<key>][<op>]=<value>`.
- Alternativo: `cf_<key>_<op>=<value>` com validação regex estrita `^cf_(?P<key>[a-z][a-z0-9_]{0,79})_(?P<op>eq|in|gt|gte|lt|lte|between|contains|starts|ends|has_any|has_all|has_none|is_null)$`. Se a última palavra underscore-separada não bater com op conhecido, parser considera parte da key (greedy reverse-match).
- `Array.isArray` values para `in`/`has_*`; CSV split com `,`. Cap 50 valores × 256 chars.

### 3.7. Cache
- Server action: `unstable_cache` com `tags: [\`custom-attrs:\${companyId}:\${entity}\`]`. `revalidateTag` após CRUD.
- Workers BullMQ: **não** usam `unstable_cache`; consultam Prisma direto (custo baixo — CustomAttribute table é pequena).

### 3.8. Delete sequence (purge → drop)
```
deleteCustomAttribute action:
  1. soft-delete (ou marca status=deleting)
  2. enqueue purge job
  3. purge job:
     a. chunks 500 rows; `UPDATE <entity>s SET custom = custom - '<key>' WHERE custom ? '<key>' AND company_id = ...`
     b. emit progress
     c. on success: enqueue drop-index job
  4. drop-index job (se isUnique): refCount-- ; se 0 → DROP INDEX
  5. prisma.customAttribute.delete({id})
```

### 3.9. PII pipeline
- Logger Pino: `redact: ["req.body.custom.*", "user.custom.*"]` quando `piiMasked=true` — implementado via intercept middleware em `src/lib/logger.ts`.
- DSAR export (`src/lib/dsar/export.ts`): função `stripPii(custom, defs)` que mapeia keys com `piiMasked=true` → `"***REDACTED***"`.
- Audit-log: não persiste valor `custom` — só diff de keys (audit do CRUD de definição, não de valor).

### 3.10. Caps
- 30 attrs/entity/tenant — `count()` antes de insert.
- 32KB/row (aproximação `Buffer.byteLength(JSON.stringify(custom))`) — Zod check.
- 256 chars/valor em `in`/`has_*` filter.
- 50 valores máx em `in`/`has_*`.
- 5 filtros `cf[...]` concorrentes por request.

### 3.11. Feature flag (seed)
```typescript
// prisma/seed.ts ou src/lib/flags/seed-custom-attributes.ts
await prisma.featureFlag.upsert({
  where: { key: "feature.custom_attributes" },
  update: {},
  create: {
    key: "feature.custom_attributes",
    enabled: false,
    description: "Custom attributes (Fase 5) — habilitar por tenant via override"
  }
});
```

## 4. Arquivos a tocar (determinístico — I22)

### 4.1. Novos
- `prisma/migrations/<ts>_custom_attributes/migration.sql`
- `prisma/migrations/<ts>_custom_attributes/migration.down.sql` (manual rollback)
- `src/lib/custom-attributes/types.ts`
- `src/lib/custom-attributes/validator.ts`
- `src/lib/custom-attributes/query-builder.ts`
- `src/lib/custom-attributes/limits.ts`
- `src/lib/custom-attributes/list.ts` (cached)
- `src/lib/filters/custom-parser.ts`
- `src/lib/jobs/custom-attrs/create-unique-index.ts`
- `src/lib/jobs/custom-attrs/drop-unique-index.ts`
- `src/lib/jobs/custom-attrs/purge-values.ts`
- `src/lib/actions/custom-attributes.ts`
- `src/app/(protected)/settings/custom-attributes/page.tsx`
- `src/app/(protected)/settings/custom-attributes/_components/attrs-content.tsx`
- `src/app/(protected)/settings/custom-attributes/_components/attr-form-dialog.tsx`
- `src/app/(protected)/settings/custom-attributes/_components/delete-confirm-dialog.tsx`
- `src/components/custom-attributes/CustomFieldInput.tsx` (switch por type)
- `src/components/custom-attributes/CustomFieldsSection.tsx`
- `src/components/custom-attributes/CustomColumnsRenderer.tsx` (para tabelas)
- `src/components/custom-attributes/CustomFiltersSection.tsx` (extensão FilterBar)
- `tests/unit/lib/custom-attributes/*.test.ts` (validator, query-builder, limits, parser, list)
- `tests/unit/components/custom-attributes/*.test.tsx`
- `tests/e2e/golden-paths/custom-attributes.spec.ts`
- `scripts/seed-custom-attrs-demo.ts` (dev only)

### 4.2. Modificados
- `prisma/schema.prisma` — 2 enums + 2 models + `custom Json` em 3 existentes.
- `src/lib/rbac/permissions.ts` — 2 permissions + mapeamento em 4 roles.
- `src/lib/actions/leads.ts` (+contacts, +opportunities) — aceitar `custom` no input; validar via definitions; respeitar `required`/`unique`/caps; catch `P2002` → mensagem amigável.
- `src/app/(protected)/leads/_components/lead-form.tsx` (+contacts, +opportunities) — render `<CustomFieldsSection>`.
- `src/app/(protected)/leads/_components/leads-table.tsx` (+contacts, +opportunities) — render `<CustomColumnsRenderer>`.
- `src/components/tables/filter-bar.tsx` — adicionar prop `customFilters?: CustomFilterConfig[]` e seção.
- `src/lib/logger.ts` — redact dinâmico via `piiMasked`.
- `src/lib/dsar/export.ts` — `stripPii(custom, defs)`.
- `src/app/api/search/route.ts` — opcional: searchable attrs contribuem (skip se bloquear fase).

## 5. Testes (v3 final)
Ver v2 §5 + adicionados:
- Flag OFF → rota `/settings/custom-attributes` 404.
- Flag ON + tenant override → acesso normal.
- CONCURRENTLY sem lock: inserir lead em loop enquanto cria unique index em staging — sem bloqueio.
- `CustomFieldsSection` unit: render ordenado por position; valor inicial; onChange trigger.
- `P2002` capture em createLead/updateLead → mensagem "valor duplicado em <label>".

## 6. Riscos (v3)
Inclui riscos v2 +:
- **Índice compartilhado shared por (entity,key)**: se dois tenants usam key `cpf` e ambos `isUnique:true`, o índice compartilhado faz unique check global por (custom->>'cpf', company_id) — ok, company_id na tupla garante separação. Sem cross-tenant leak.
- **Refcount desync**: mitigação via `UPDATE ... WHERE refCount = prevValue` optimistic lock.

## 7. Critérios de sucesso (v3)
Ver v2 §8 + critérios novos:
- [ ] `P2002` em duplicate retorna erro humano.
- [ ] `pii_masked` attrs redact no Pino logger; DSAR export confirma `***REDACTED***`.
- [ ] Flag OFF → rota 404; ON + override → 200.
- [ ] `CREATE INDEX CONCURRENTLY` não bloqueia inserts concorrentes (teste staging).
- [ ] Refcount drop funciona: 2 tenants habilitam `isUnique:true` em `mrr`; um desabilita → refCount=1 → index permanece; segundo desabilita → index DROP.

## 8. Veredito

Spec v3 FINAL aprovada internamente (self-review consolidou C8–C12 + I15–I28). Nenhum crítico remanescente. Pronta para **Plan v1**.

## 9. Rollout (igual v2)
Staging 7 dias → per-tenant allowlist prod → global 30d depois.

## 10. Follow-ups pós-Fase 5
Sortable por custom attr; import/export defs; show_if; value audit; WebForms.
