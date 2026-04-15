# Spec v2 — Fase 5: Custom Attributes

**Status:** v2 (pós Review 1 — 7 críticos + 14 importantes endereçados; pronto para Review 2 profundo)
**Data:** 2026-04-15
**Changelog v1→v2:**
- C1: RBAC explícito (`custom-attributes:view` + `:manage`, roles mapeados).
- C2: feature flag via DB (`src/lib/flags`) + seed migration + cache.
- C3: enum sem `quote` (Fase 4 adiciona via `ALTER TYPE`).
- C4: migration SQL manual com `jsonb_ops` explícito.
- C5: formato URL `cf[<key>][<op>]=<value>` resolve ambiguidade de underscore.
- C6: unique soft (app-level com race documentada) — partial index SQL por key quando `unique:true` criado.
- C7: cache tag-based por tenant+entity.
- I1–I14: operadores completos, migration reversível, delete purge via BullMQ, sortable, renderer local, tz policy, missing-vs-null, audit, caps, flag rollout, reserved keys, i18n, cross-tenant tests.

## 1. Contexto e motivação
(mantido v1)

## 2. Escopo

### 2.1. Incluído
- `CustomAttribute` table (metadados por tenant).
- `custom JSONB` em Lead/Contact/Opportunity (Fase 4 adicionará Quote).
- 8 tipos canônicos (§3.2).
- Admin UI `/settings/custom-attributes`.
- Validação Zod dinâmica.
- Render dinâmico forms/tabelas/filtros.
- Filtros URL `cf[<key>][<op>]=<value>` (bracket — sem ambiguidade).
- Query operators allowlist (§3.4).
- GIN index `jsonb_ops`.
- RBAC `custom-attributes:view` + `custom-attributes:manage`.
- Feature flag `feature.custom_attributes` (DB).
- Testes unit + integration + E2E (incluindo cross-tenant leak).

### 2.2. Fora de escopo
Cross-entity shared attrs; derivados/calculados; versionamento; import/export definições (Fase 10 importa/exporta VALORES via JSONB, definições ficam para v2); show_if; regex custom; WebForms públicos; sort por custom attr (I4, TODO declarado); audit de value changes (Fase 12 — só CRUD de definição audita em v5).

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
  unique        Boolean  @default(false)   // só text/number; partial index criado/dropado on-write
  options       Json?    @default("[]")    // select/multi_select
  defaultValue  Json?
  placeholder   String?  @db.VarChar(200)
  helpText      String?  @db.VarChar(500)
  minLength     Int?
  maxLength     Int?
  minValue      Decimal? @db.Decimal(12, 4)
  maxValue      Decimal? @db.Decimal(12, 4)
  position      Int      @default(0)
  visibleInList Boolean  @default(false)
  searchable    Boolean  @default(false)
  sortable      Boolean  @default(false)   // reservado — usado em fase futura
  piiMasked     Boolean  @default(false)   // mascarar em logs/exports (I texto)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, entity, key])
  @@index([companyId, entity, position], name: "idx_custom_attr_form_order")
  @@map("custom_attributes")
}

enum CustomAttributeEntity {
  lead
  contact
  opportunity
  // Fase 4 fará: ALTER TYPE custom_attribute_entity ADD VALUE 'quote';
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

Alterações em Lead/Contact/Opportunity:
```prisma
custom Json @default("{}")
@@index([custom], type: Gin)   // fallback se Prisma não aceitar; override via SQL manual
```

**Migration SQL manual** (caso `type: Gin` não aplique `jsonb_ops` corretamente):
```sql
-- prisma/migrations/2026_04_15_custom_attributes/migration.sql
CREATE TYPE custom_attribute_entity AS ENUM ('lead','contact','opportunity');
CREATE TYPE custom_attribute_type AS ENUM ('text','number','date','datetime','boolean','select','multi_select','url');

CREATE TABLE custom_attributes (...);  -- canônico Prisma

ALTER TABLE leads         ADD COLUMN custom jsonb NOT NULL DEFAULT '{}';
ALTER TABLE contacts      ADD COLUMN custom jsonb NOT NULL DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN custom jsonb NOT NULL DEFAULT '{}';

CREATE INDEX idx_lead_custom         ON leads         USING gin (custom jsonb_ops);
CREATE INDEX idx_contact_custom      ON contacts      USING gin (custom jsonb_ops);
CREATE INDEX idx_opportunity_custom  ON opportunities USING gin (custom jsonb_ops);
```
`jsonb_ops` (não `jsonb_path_ops`) — cobre `@>`, `?`, `?&`, `?|`.

**Rollback:** DROP INDEX × 3 → ALTER TABLE DROP COLUMN × 3 → DROP TABLE → DROP TYPE × 2. Cada step idempotent.

### 3.2. Tipos canônicos
| type | storage JSON | valor null | notas |
|------|--------------|------------|-------|
| text | string | `null` ou missing | max 500 chars; `piiMasked` mascara em logs |
| number | number | `null` | decimal client-side; fraction armazenada como number |
| date | `"YYYY-MM-DD"` | `null` | sem timezone |
| datetime | ISO 8601 UTC | `null` | renderizado no tz user (IntlConvention §5.1 do roadmap) |
| boolean | boolean | `null` (não setado) ou false/true | |
| select | string (value do option) | `null` | validado contra `options[*].value` |
| multi_select | string[] | `[]` ou `null` | subset de `options[*].value` |
| url | string | `null` | Zod URL validation |

**Convenção null vs missing (I7):** ao "apagar" um valor, server action faz `delete obj[key]` antes de salvar — NÃO seta null. Query operator `eq null` filtra pela ausência via `NOT (custom ? key)`.

### 3.3. RBAC (C1)
Duas permissions novas:
- `custom-attributes:view` — ver a tab em /settings; listar defs.
- `custom-attributes:manage` — criar/editar/deletar/reordenar.

Matriz por role:
| Role | view | manage |
|------|------|--------|
| super_admin | ✅ | ✅ |
| admin | ✅ | ✅ |
| manager | ✅ | ❌ |
| seller | ✅ | ❌ |
| viewer | ✅ | ❌ |

Usuários sem `manage` veem a tab read-only (UI esconde CTAs).

### 3.4. Query operators allowlist (I1 completo)
```typescript
const OPS_BY_TYPE: Record<CustomAttributeType, readonly string[]> = {
  text:         ["eq", "in", "contains", "starts", "ends", "is_null"],
  number:       ["eq", "in", "gt", "gte", "lt", "lte", "between", "is_null"],
  date:         ["eq", "gt", "gte", "lt", "lte", "between", "is_null"],
  datetime:     ["eq", "gt", "gte", "lt", "lte", "between", "is_null"],
  boolean:      ["eq", "is_null"],                 // eq: true|false
  select:       ["eq", "in", "is_null"],           // in valida cada valor em options
  multi_select: ["has_any", "has_all", "has_none", "is_null"],
  url:          ["eq", "contains", "starts", "is_null"],
} as const;
```
- `between` exige 2 valores: URL `cf[mrr][between]=100,500`.
- `in` / `has_*`: CSV na URL. Max 50 valores por filtro.
- `is_null` → `NOT (custom ? key)`.

Parser rejeita op fora da allowlist com 400. Zod valida request body.

### 3.5. Filtros URL (C5 — bracket format)
Formato canônico: `cf[<key>][<op>]=<value>`.
- Next `useSearchParams().getAll("cf[mrr][gte]")` funciona com `decodeURIComponent` automático.
- Parser `src/lib/filters/custom-parser.ts` itera `searchParams.entries()` matchando regex `^cf\[([a-z][a-z0-9_]{0,79})\]\[([a-z_]+)\]$`.
- Não colide com filtros fixos (`status`, `q`, etc.).
- Máximo 5 filtros custom concorrentes (cap DoS).

### 3.6. Unique (C6 — soft + partial index por key)
- Flag `unique: true` permitida só para `text`/`number`.
- Ao criar/atualizar def com `unique: true`:
  - Server action enfileira job BullMQ `create-custom-attr-unique-index` que roda:
    ```sql
    CREATE UNIQUE INDEX CONCURRENTLY idx_<entity>_custom_<key>_unique
      ON <entity>
      ((custom->>'<key>'))
      WHERE custom ? '<key>' AND companyId = '<tenantUUID>';
    ```
    NB: Postgres não permite tenant na `WHERE` de unique index (precisa column real). Alternativa: compor via `(custom->>'<key>', company_id)` + `WHERE custom ? '<key>'`.
    **Decisão final:** `CREATE UNIQUE INDEX ... ((custom->>'<key>'), company_id) WHERE custom ? '<key>'`.
- Ao deletar def: `DROP INDEX CONCURRENTLY`.
- Soft-check no action `createLead`/`updateLead`: `findFirst` antes de insert. Race residual documentada — o índice DB é garantia final.

### 3.7. Cache (C7)
- `listCustomAttributes(companyId, entity)` usa `unstable_cache`:
  - `keyParts: [companyId, entity]`.
  - `tags: ["custom-attrs", \`custom-attrs:${companyId}:${entity}\`]`.
- Invalidação após CRUD de def: `revalidateTag(\`custom-attrs:${companyId}:${entity}\`)`.
- Zero cross-tenant leak (key inclui companyId).

### 3.8. Delete purge (I3)
Delete de def agenda job BullMQ `purge-custom-attr-values`:
- Lê batches de 500 rows com `where: { companyId, custom: { path: [key], not: Prisma.JsonNull } }` (ou `custom ? key`).
- Para cada row: `custom = omit(custom, [key])`; `updateMany` com set.
- Progress reportado via `DataTransferJob`-like ou `AutomationExecution`-like (decisão: novo `CustomAttrPurgeJob` modelo leve).
- UI mostra progress bar; delete da definição já é imediato (soft — só some da listagem para criação, valores legacy vão desaparecendo).

### 3.9. UI Admin
(mantido v1 — §3.3)
- Componentes DS: Tabs, Table, Dialog, Form, DropdownMenu, Badge.
- Form de atributo: `type` disabled após criar; `key` disabled após criar.

### 3.10. Render forms (I5 — local em src/components/)
- `src/components/custom-attributes/CustomFieldInput.tsx` — client, switch por type.
- `src/components/custom-attributes/CustomFieldsSection.tsx` — agrupa e ordena.
- Não publica em DS v5 — só MVP; DS pode absorver em v1e (Fase 1e ou futura).

### 3.11. Reserved keys (I12)
Blocklist hard: `id`, `companyId`, `createdAt`, `updatedAt`, `deletedAt`, `assignedTo`, `status`, `stage`, `name`, `email`, `custom`. Zod refine rejeita.

### 3.12. Caps enforcement
- **30 attrs por entity por tenant (I9):** `createCustomAttribute` action conta `prisma.customAttribute.count({ where: { companyId, entity } })` antes de insert; retorna erro se ≥30.
- **64KB por row JSONB (I10):** helper `assertCustomBytes(custom)` em `src/lib/custom-attributes/limits.ts` mede `Buffer.byteLength(JSON.stringify(custom))`; usado em `createLead`/`updateLead`/etc.

### 3.13. Feature flag (C2)
Flag canônica: `feature.custom_attributes`.
- Seed migration: `setFlag({ key: "feature.custom_attributes", enabled: false, scope: "global" })`.
- Resolver: no `layout.tsx` de `/settings/custom-attributes` → 404 se `getFlag(key, ctx) === false`.
- Rollout: per-company via `FeatureFlagOverride` (scope=company) — admin habilita em `/settings/flags`.

### 3.14. Timezone (I6)
- `date`: ISO `YYYY-MM-DD` literal.
- `datetime`: armazena UTC; renderiza em tz do usuário via `Intl.DateTimeFormat(user.timezone)`.

### 3.15. i18n (I13)
- `label`, `placeholder`, `helpText` livres (tenant escolhe idioma).
- Mensagens de erro Zod via `next-intl` (se existir no projeto; senão hardcoded pt-BR).

## 4. API (Server Actions)

`src/lib/actions/custom-attributes.ts`:
```typescript
listCustomAttributes(entity): ActionResult<CustomAttribute[]>
getCustomAttribute(id): ActionResult<CustomAttribute>
createCustomAttribute(input): ActionResult<CustomAttribute>
updateCustomAttribute(id, input): ActionResult<CustomAttribute>
deleteCustomAttribute(id, confirm: { purgeValues: boolean }): ActionResult<{ jobId?: string }>
reorderCustomAttributes(entity, orderedIds): ActionResult
```
Todas:
- `requirePermission(...)` (view para list/get; manage p/ mutações).
- `requireActiveCompanyId()`.
- Zod strict.
- `withAudit({ resourceType: "custom_attribute" })` — adicionar case em `src/lib/audit/*` (I8).
- Invalida cache (tag revalidation).

## 5. Testes

### 5.1. Unit (≥40 testes)
- `validator.test.ts` (12+): cada tipo válido+inválido; `required`; `piiMasked`.
- `query-builder.test.ts` (20+): cada par `type × op`; rejeição de op desconhecido; `is_null`; `between`; `has_*`.
- `custom-parser.test.ts` (8+): bracket format, multi-filter, invalid key/op rejection, cap 5, underscore in key.
- `list-cache.test.ts` (3): hit/miss, tag invalidation, cross-tenant isolation.
- `actions/custom-attributes.test.ts` (10+): unique flag gera job; blocklist; cap 30; delete purge; reorder; permissões.
- `limits.test.ts` (3): 64KB cap enforcement.

### 5.2. Integration (Prisma)
- Migration aplica; GIN index verificado via `\d+` ou `pg_indexes`.
- `EXPLAIN SELECT ... WHERE custom @> '{...}'` mostra index.
- Unique partial index criado e violação bloqueia.
- Cross-tenant: tenant A insere `mrr=100`; tenant B insere `mrr=100`; ambos ok; queries isoladas.

### 5.3. E2E (Playwright)
- admin: /settings/custom-attributes → cria 3 attrs (text/number/select) → form /leads/new renderiza + submit → /leads lista mostra custom columns (visibleInList) → filtra `cf[mrr][gte]=1000`.
- admin: delete attr → confirma purge → job roda em background → poll UI vê "concluído".
- viewer: acessa `/settings/custom-attributes` → vê listagem read-only; não vê botões de manage.
- seller: tenta hit `createCustomAttribute` via POST direto → 403.
- cross-tenant leak: tenant A cria attr `mrr`; tenant B chama `listCustomAttributes("lead")` → não vê `mrr` de A.

## 6. Observabilidade

- Logs: `custom_attr.created|updated|deleted|reordered` com `{tenantId, entity, attrId, type}`.
- Métricas Prometheus: `custom_attr_count_total{tenant,entity}`, `custom_attr_value_write_total`, `custom_attr_purge_duration_ms`.
- Sentry: erros em validator/query-builder/purge job.

## 7. Riscos (atualizado)

| Risco | Mitigação |
|-------|-----------|
| Race na unique soft-check | partial unique index DB garante; soft-check reduz 99% dos casos amigáveis |
| Purge job falha parcial | idempotente; retry BullMQ; dryRun opcional |
| GIN index não criado (Prisma ignora Gin type) | migration SQL manual garante |
| Operador injetado | allowlist estrita + Zod enum |
| Cache cross-tenant leak | tag+key inclui companyId |
| Bracket format quebra em proxies/CDN | teste contra CDN antes de deploy; fallback plano `cf_<key>_<op>` documentado no código |
| Tenant atinge 30 attrs | erro amigável; sugerir consolidar |
| JSONB > 64KB | Zod reject antes do save |

## 8. Critérios de sucesso

- [ ] Admin cria 8 attrs (um de cada tipo) sem erro.
- [ ] Viewer vê tab read-only; seller não consegue mutar (403).
- [ ] Form de Lead/Contact/Opportunity renderiza campos ordenados por `position`.
- [ ] Filtros `cf[key][op]=value` funcionam em 3 listas.
- [ ] Delete attr agenda purge job; valores somem após job finish.
- [ ] Unique partial index criado/dropado via CONCURRENTLY sem lock em staging.
- [ ] Cross-tenant leak: tenant B NÃO vê defs/values de A.
- [ ] GIN index em `leads.custom` confirmado EXPLAIN.
- [ ] Cap 30 attrs bloqueia 31º com erro amigável.
- [ ] 64KB cap bloqueia write acima.
- [ ] 40+ unit + 4 integration + 5 E2E verdes.
- [ ] `npm run build` OK; `npm audit` 0 high/critical.
- [ ] Feature flag OFF não quebra build; ON ativa rota.

## 9. Rollout

- Migration aplicada em staging.
- Seed da flag como `enabled=false` global.
- Staging smoke (E2E) — 7 dias com 3 dev-tenants.
- Prod rollout per-tenant via FeatureFlagOverride.
- Full global `enabled=true` após 30 dias de prod.

## 10. Follow-ups (Fase 5.x / 1e / 12)
- Sort por custom attr (`sortable: true`) — lista server action suporta.
- Audit de value changes.
- `show_if` condicional (requer parser expr).
- Import/export definições.
- WebForms públicos.
- PII pipeline (erase.ts + export.ts já consideram `piiMasked`).
