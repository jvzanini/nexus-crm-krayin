# Plan v1 — Fase 5: Custom Attributes

**Status:** v1 (pronto para Review 1)
**Spec:** `docs/superpowers/specs/2026-04-15-fase-5-custom-attributes-v3.md`
**Execução:** task-a-task com TDD; cada task tem aceite mensurável + rollback.

## Grafo de dependências

```
T1 schema+migration
 ├─ T2 rbac permissions
 ├─ T3 types + limits
 │   └─ T4 validator
 │       └─ T5 query-builder
 │           └─ T6 custom-parser (URL filters)
 │               └─ T7 list (cached)
 │                   ├─ T8 actions (CRUD)
 │                   │   ├─ T9 job create-unique-index
 │                   │   ├─ T10 job drop-unique-index
 │                   │   └─ T11 job purge-values
 │                   └─ T12 feature flag seed
T1, T3 → T13 components (CustomFieldInput, Section, Columns, Filters)
T7, T8, T13 → T14 settings UI (page + dialogs)
T8, T13 → T15 integração leads form/table
T8, T13 → T16 integração contacts form/table
T8, T13 → T17 integração opportunities form/table
T8 → T18 filter-bar extensão (customFilters prop)
T7 → T19 DSAR export.ts + logger.ts PII pipeline
T4..T13 → T20 unit tests
T8..T19 → T21 integration tests
T14..T19 → T22 E2E tests
T20..T22 → T23 build + lint + audit
T23 → T24 docs HANDOFF + memória + commit
T24 → T25 push + monitor CI
T25 → T26 tag phase-5-deployed
```

---

## T1 — Schema Prisma + migration SQL

**Arquivos:**
- `prisma/schema.prisma` (modificar)
- `prisma/migrations/<ts>_custom_attributes/migration.sql` (novo)

**Ações:**
1. Adicionar `CustomAttribute`, `CustomAttributeUniqueRef`, enums `CustomAttributeEntity` + `CustomAttributeType` ao schema.
2. Adicionar `custom Json @default("{}")` em `Lead`, `Contact`, `Opportunity` (sem `@@index` no schema — criado via SQL manual).
3. `npx prisma migrate dev --name custom_attributes --create-only` — gera migration.sql base.
4. **Editar** o migration.sql gerado para:
   - Remover qualquer `CREATE INDEX ... ON ... (custom)` gerado pelo Prisma (não vamos confiar).
   - Adicionar manualmente: `CREATE INDEX idx_lead_custom ON leads USING gin (custom jsonb_ops);` × 3 entidades.
5. Adicionar `migration.down.sql` no mesmo diretório (comentários — Prisma não roda DOWN; é docs de rollback).
6. Aplicar: `npx prisma migrate dev` (aplica em dev DB).
7. `npx prisma generate` (client types).

**Aceite:**
- `npx prisma migrate status` limpo.
- `\d custom_attributes` em `psql` mostra tabela com 18 colunas + índices.
- `\di+ idx_lead_custom` confirma USING gin + jsonb_ops.
- `SELECT custom FROM leads LIMIT 1;` retorna `{}`.

**Rollback:** `npx prisma migrate reset` (dev) / down manual documentado em `migration.down.sql`.

---

## T2 — RBAC permissions

**Arquivos:**
- `src/lib/rbac/permissions.ts` (modificar)

**Ações:**
1. Adicionar `"custom-attributes:view"` e `"custom-attributes:manage"` ao array `PERMISSIONS`.
2. Mapear em `ROLE_PERMISSIONS`:
   - `super_admin`: já pega tudo via `...PERMISSIONS`.
   - `admin`: ambas.
   - `manager`: `view` only.
   - `viewer`: `view` only.
3. Rodar `npx tsc --noEmit` — type-check garante `Permission` union atualizado.

**Aceite:**
- `userHasPermission({...admin}, "custom-attributes:manage")` → `true`.
- `userHasPermission({...viewer}, "custom-attributes:manage")` → `false`.
- `userHasPermission({...viewer}, "custom-attributes:view")` → `true`.

**Rollback:** reverter diff.

---

## T3 — Types + limits

**Arquivos novos:**
- `src/lib/custom-attributes/types.ts`
- `src/lib/custom-attributes/limits.ts`

**Contratos:**
```typescript
// types.ts
export type { CustomAttribute, CustomAttributeEntity, CustomAttributeType } from "@prisma/client";

export interface CustomFieldValue {
  [key: string]: unknown;  // JSONB shape
}

export const OPS_BY_TYPE: Record<CustomAttributeType, readonly string[]>;
export type CustomOp =
  | "eq" | "in" | "gt" | "gte" | "lt" | "lte" | "between"
  | "contains" | "starts" | "ends"
  | "has_any" | "has_all" | "has_none"
  | "is_null";

// limits.ts
export const MAX_ATTRS_PER_ENTITY = 30;
export const MAX_CUSTOM_BYTES_PER_ROW = 32 * 1024;
export const MAX_FILTER_VALUES = 50;
export const MAX_FILTER_VALUE_LENGTH = 256;
export const MAX_CONCURRENT_FILTERS = 5;
export const RESERVED_KEYS: readonly string[] = [
  "id", "companyId", "createdAt", "updatedAt", "deletedAt",
  "assignedTo", "status", "stage", "name", "email", "custom",
  "order", "group", "user"
];

export function assertCustomBytes(custom: CustomFieldValue): void;  // throws se > MAX_CUSTOM_BYTES_PER_ROW
export function assertKeyNotReserved(key: string): void;            // throws se reserved
export function assertAttrCount(companyId: string, entity: CustomAttributeEntity, prisma: Prisma): Promise<void>;
```

**Aceite:**
- Unit: chamar com valores ok → no-throw; com 33KB → throw; com key "id" → throw.
- `npx tsc --noEmit` limpo.

---

## T4 — Validator

**Arquivo novo:** `src/lib/custom-attributes/validator.ts`

**Contratos:**
```typescript
export function buildZodFromDefinitions(defs: CustomAttribute[]): z.ZodSchema<CustomFieldValue>;
```

**Lógica:**
- Itera `defs`; para cada `def`:
  - Seleciona base schema por `type` (text → z.string().max(def.maxLength ?? 500), number → z.number(), etc.).
  - Aplica `required`: `.optional()` se `!def.required`.
  - `select`: `z.enum(def.options.map(o => o.value))`.
  - `multi_select`: `z.array(z.enum(values)).max(def.options.length)`.
- Compõe em `z.object({ [def.key]: schema })`.
- Strict: `z.object({...}).strict()` — rejeita keys não-definidas (proteção).
- Aplica `assertKeyNotReserved` em cada key presente no input.

**Aceite:** ≥12 unit tests cobrindo cada tipo válido/inválido + required behavior + reserved key reject + strict mode.

---

## T5 — Query builder

**Arquivo novo:** `src/lib/custom-attributes/query-builder.ts`

**Contrato:**
```typescript
export function buildPrismaWhereFromCustomFilters(
  filters: Array<{ key: string; op: CustomOp; value: unknown }>,
  defs: CustomAttribute[]
): Prisma.JsonNullableFilter | null;
```

**Lógica:**
- Para cada filter:
  - Localizar `def` com `def.key === filter.key`; se não existir → skip.
  - Validar `filter.op ∈ OPS_BY_TYPE[def.type]` → se não, lançar erro 400.
  - Mapear op → Prisma JSON filter:
    - `eq` → `{ path: [key], equals: value }`.
    - `gt/gte/lt/lte` → path-based com comparators.
    - `in` → `{ path: [key], array_contains: [value] }` (iterar).
    - `has_any/has_all/has_none` → array ops.
    - `contains` → `{ path: [key], string_contains: value, mode: "insensitive" }` (Prisma 7.6 suporta `string_contains`).
    - `is_null` → `NOT (custom ? key)`: `{ NOT: { custom: { path: [key], not: Prisma.AnyNull } } }`.
- Combinar via `AND`.

**Aceite:** ≥20 unit tests (cada type × cada op).

---

## T6 — Custom parser (URL filters)

**Arquivo novo:** `src/lib/filters/custom-parser.ts`

**Contrato:**
```typescript
export function parseCustomFiltersFromSearchParams(
  searchParams: URLSearchParams
): Array<{ key: string; op: CustomOp; value: unknown }>;
```

**Lógica:**
- Itera entries; regex 1 (bracket): `^cf\[([a-z][a-z0-9_]{0,79})\]\[([a-z_]+)\]$`.
- Regex 2 (underscore): greedy-reverse match separando op conhecido da key.
- Value: split por `,` para `in`/`has_*`/`between`; trim cada; cap `MAX_FILTER_VALUE_LENGTH`; cap count `MAX_FILTER_VALUES`.
- Retorna apenas filters com key+op ambos válidos (regex + op existe na allowlist).
- Cap total `MAX_CONCURRENT_FILTERS`.

**Aceite:** ≥8 unit tests (bracket, underscore, invalid, multi, cap).

---

## T7 — List cached

**Arquivo novo:** `src/lib/custom-attributes/list.ts`

**Contrato:**
```typescript
export async function listCustomAttributes(
  companyId: string,
  entity: CustomAttributeEntity
): Promise<CustomAttribute[]>;
```

**Impl:**
```typescript
import { unstable_cache } from "next/cache";

export const listCustomAttributes = (companyId: string, entity: CustomAttributeEntity) =>
  unstable_cache(
    async () =>
      prisma.customAttribute.findMany({
        where: { companyId, entity },
        orderBy: { position: "asc" }
      }),
    [`custom-attrs`, companyId, entity],
    { tags: [`custom-attrs:${companyId}:${entity}`], revalidate: 3600 }
  )();
```

**Aceite:**
- Cache hit após segunda chamada (mock `findMany` é chamado 1x).
- `revalidateTag` após CRUD invalida.
- Tenant B chamar não vê defs de A.

---

## T8 — Server actions

**Arquivo novo:** `src/lib/actions/custom-attributes.ts`

**Actions:**
- `listCustomAttributesAction(entity)` → wrapper do T7 + `requirePermission`.
- `getCustomAttribute(id)`
- `createCustomAttribute(input)` — valida Zod, cap count, key not reserved, type not in future-only (`quote`), agenda job create-unique-index se `isUnique:true`, persiste, revalidateTag.
- `updateCustomAttribute(id, input)` — type/key imutáveis; se toggle `isUnique`, agenda job apropriado.
- `deleteCustomAttribute(id, { purgeValues: boolean })` — soft-delete ou `status=deleting`, agenda purge job → drop-index, depois delete def.
- `reorderCustomAttributes(entity, orderedIds)` — transação atualiza `position`.

**Todas:**
- `requirePermission("custom-attributes:manage")` (exceto list/get que aceitam `:view`).
- `requireActiveCompanyId()`.
- `auditLog({resourceType: "custom_attribute", action, resourceId})`.
- Catch `P2002` → `{success: false, error: "Valor duplicado em <label>"}`.

**Aceite:** ≥10 unit tests cobrindo cada action + permissões + cap + P2002.

---

## T9 — Job create-unique-index

**Arquivo novo:** `src/lib/jobs/custom-attrs/create-unique-index.ts`

**Lógica:** conforme spec §3.3. Usa `pg` client dedicado (via `new Pool().connect()` ou `new Client()`), `CONCURRENTLY`, regex-validated key, refcount via `customAttributeUniqueRef`.

**Aceite:**
- Primeiro tenant ativa → cria index + ref.
- Segundo tenant mesma (entity,key) → ref.refCount = 2, index preexistente.
- Query em staging mostra index USING btree com `WHERE custom ? 'key'`.
- Idempotent: rodar 2x → segundo no-op.

---

## T10 — Job drop-unique-index

**Arquivo novo:** `src/lib/jobs/custom-attrs/drop-unique-index.ts`

**Lógica:** `refCount--`; se 0, `DROP INDEX CONCURRENTLY` + `refs.delete`.

**Aceite:** ref.refCount desce de 2→1 (index permanece), 1→0 (index drop + ref removido).

---

## T11 — Job purge-values

**Arquivo novo:** `src/lib/jobs/custom-attrs/purge-values.ts`

**Lógica:**
```typescript
const chunks = 500;
let offset = 0;
while (true) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM ${Prisma.raw(tableName)}
    WHERE company_id = ${companyId} AND custom ? ${key}
    LIMIT ${chunks} OFFSET ${offset}`;
  if (rows.length === 0) break;
  await prisma.$executeRaw`
    UPDATE ${Prisma.raw(tableName)}
    SET custom = custom - ${key}
    WHERE id = ANY(${rows.map(r => r.id)}::uuid[])`;
  offset += chunks;
  // emit progress
}
```

Nota: `tableName` e `key` são regex-validated antes de raw interpolation.

**Aceite:** 1000 rows com key `mrr` → após purge, nenhuma row tem `custom ? 'mrr'`.

---

## T12 — Feature flag seed

**Arquivo modificado:** `prisma/seed.ts` (ou criar se não existir)

**Ação:**
```typescript
await prisma.featureFlag.upsert({
  where: { key: "feature.custom_attributes" },
  update: {},
  create: { key: "feature.custom_attributes", enabled: false,
    description: "Custom attributes (Fase 5)" }
});
```

**Aceite:** `SELECT * FROM feature_flags WHERE key='feature.custom_attributes'` retorna row com `enabled=false`.

---

## T13 — Components

**Arquivos novos:**
- `src/components/custom-attributes/CustomFieldInput.tsx`
- `src/components/custom-attributes/CustomFieldsSection.tsx`
- `src/components/custom-attributes/CustomColumnsRenderer.tsx`
- `src/components/custom-attributes/CustomFiltersSection.tsx`

**Regras:**
- Client components.
- Switch por `def.type`; reuso de `Input`/`Select`/`Checkbox`/`DatePicker` do `@nexusai360/design-system`.
- `CustomFieldInput` props: `def`, `value`, `onChange(v)`, `error?`.
- `CustomFieldsSection` props: `defs`, `values`, `onChange`, ordena por `position`.
- `CustomColumnsRenderer` props: `defs`, `row.custom` — renderiza só attrs com `visibleInList:true`.
- `CustomFiltersSection` props: `defs`, `onApply(filters)` — renderiza só attrs com `searchable:true`.

**Aceite:** ≥8 component tests (render, onChange, error display, order).

---

## T14 — Settings UI

**Arquivos novos:**
- `src/app/(protected)/settings/custom-attributes/page.tsx` — server component, checa flag+permission.
- `src/app/(protected)/settings/custom-attributes/_components/attrs-content.tsx` — client, usa Tabs por entity.
- `src/app/(protected)/settings/custom-attributes/_components/attr-form-dialog.tsx` — modal criar/editar.
- `src/app/(protected)/settings/custom-attributes/_components/delete-confirm-dialog.tsx` — confirmação com contagem de rows impactadas.

**Aceite:** E2E admin cria/edita/deleta; viewer vê read-only.

---

## T15 — Integração leads

**Arquivos modificados:**
- `src/app/(protected)/leads/_components/lead-form.tsx` — adicionar `<CustomFieldsSection>`.
- `src/app/(protected)/leads/_components/leads-table.tsx` — adicionar `<CustomColumnsRenderer>`.
- `src/lib/actions/leads.ts` — aceitar `custom` no input, validar, catch P2002.

**Aceite:** criar lead com 3 custom attrs; lista mostra colunas; edit preserva.

---

## T16, T17 — Integração contacts + opportunities
Replicar T15 para cada entity.

---

## T18 — FilterBar extension

**Arquivo modificado:** `src/components/tables/filter-bar.tsx`

Adicionar prop `customFilters?: CustomFilterConfig[]` com seção colapsável renderizando `<CustomFiltersSection>`.

**Aceite:** filter-bar compatível backward (sem `customFilters` = sem seção); com prop, render.

---

## T19 — DSAR + logger PII

**Arquivos modificados:**
- `src/lib/logger.ts` — helper `redactCustomPii(defs)` que gera config Pino `redact.paths`.
- `src/lib/dsar/export.ts` — `stripPii(custom, defs)` função.
- `src/lib/dsar/erase.ts` — idem para anonymize.

**Aceite:** export DSAR mostra `***REDACTED***` em attrs com `piiMasked:true`.

---

## T20 — Unit tests
Garantir ≥40 unit tests verdes (T3–T13 contribuem).

---

## T21 — Integration tests
- Migration apply + index check.
- Unique partial index violação.
- Cross-tenant isolation.
- Refcount desync optimistic lock.

---

## T22 — E2E

**Arquivo novo:** `tests/e2e/golden-paths/custom-attributes.spec.ts`

Cenários (spec §5.3):
- admin full CRUD + filter.
- viewer read-only.
- cross-tenant isolation.
- seller 403.
- flag OFF → 404.

---

## T23 — Build/lint/audit
```
npx prisma generate
npm run build
npm run lint
npm audit --audit-level=high --omit=dev
```
Tudo verde.

---

## T24 — Docs + memória

- Atualizar `docs/HANDOFF.md` (CRM) com Fase 5.
- Atualizar `memory/project_crm_phase_status.md` (blueprint).
- Novo memo: `memory/fase_5_custom_attrs_decisions.md` (decisões chave).

---

## T25 — Commit + push + CI
Commit único squash `feat(custom-attrs): Fase 5 — Custom Attributes (impl completa)`.
Push. Monitor CI.

---

## T26 — Tag + deploy
Tag `phase-5-deployed`. Flip flag OFF global (aguardar staging).

---

## Duração estimada (dev humano)
T1–T7: 1 dia (foundation)
T8–T12: 2 dias (actions+jobs)
T13–T17: 2 dias (UI+integração)
T18–T19: 0.5 dia
T20–T22: 1.5 dia (testes)
T23–T26: 0.5 dia (ship)
**Total: ~7.5 dias.** Em modo autônomo subagents (paralelizáveis T13/T15/T16/T17), pode baixar para ~3 dias.

## Paralelismo
Podem rodar em paralelo:
- T9+T10+T11 (jobs independentes).
- T15+T16+T17 (integrações).
- T20–T22 (após impl).
