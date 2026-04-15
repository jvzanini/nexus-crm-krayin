# Spec v1 — Fase 5: Custom Attributes (atributos customizados por tenant)

**Status:** v1 (primeira redação — sujeito a Review 1)
**Data:** 2026-04-15
**Fase:** 5 — Custom Attributes
**Roadmap mestre:** linha 52
**Dependências:** Fases 1b, 1d (ambas completas)
**Bloqueia:** Fases 4 (Quotes), 9 (Marketing segmentação avançada), 11 (Reports por atributo)

## 1. Contexto e motivação

O CRM atual tem modelos fixos (Lead/Contact/Opportunity/Quote) com colunas SQL tradicionais. Cada tenant tem necessidades específicas: uma agência de marketing quer rastrear "campanha de origem"; uma imobiliária quer "tipo de imóvel interesse"; uma SaaS quer "MRR atual do cliente". Hoje isso obriga forks do schema por cliente — insustentável.

**Solução:** campo JSONB `custom` em cada entidade, metadados de definição em tabela `CustomAttribute` por tenant, renderização dinâmica de forms/tabelas/filtros.

## 2. Escopo

### 2.1. Incluído

- Nova tabela `CustomAttribute` (metadados por tenant).
- Colunas JSONB `custom Json? @default("{}")` em: `Lead`, `Contact`, `Opportunity`, `Quote` (Quote será criado na Fase 4; para esta fase, só as 3 existentes).
- 8 tipos de atributo (canônicos):
  - `text` (string, max 500)
  - `number` (decimal, precisão 12,4)
  - `date` (ISO 8601)
  - `datetime` (ISO 8601 + timezone)
  - `boolean`
  - `select` (single, enum de `options`)
  - `multi_select` (array de `options`)
  - `url` (validado por Zod)
- Admin UI `/settings/custom-attributes` (CRUD por entidade+tenant).
- Validação Zod gerada dinamicamente a partir das definições.
- Render dinâmico em forms de Lead/Contact/Opportunity (cria/edita).
- Render em tabelas: colunas opt-in (admin marca `visibleInList: true`).
- Filtros em URL-params reusando infra da Fase 24: `?custom.mrr_gte=1000`.
- **Query operators allowlist** por tipo:
  - text: `eq`, `contains`, `starts`, `ends`
  - number/date/datetime: `eq`, `gt`, `gte`, `lt`, `lte`, `between`
  - boolean: `eq`
  - select: `eq`, `in`
  - multi_select: `hasAny`, `hasAll`, `hasNone`
  - url: `eq`, `contains`
- **GIN index JSONB** na coluna `custom` de cada entidade.
- Migrations Prisma reversíveis.
- RBAC: `custom-attributes:manage` permission (admin/super_admin).

### 2.2. Fora de escopo (YAGNI)

- Atributos cross-entity compartilhados (cada entity tem seu namespace).
- Atributos derivados/calculados.
- Versionamento de definição (mudar tipo retro-compatível).
- Import/export de definições.
- Condicional/visibilidade condicionada (show_if).
- Validação regex custom por tenant.
- Formulários públicos com custom attrs (WebForm module).
- Audit-log de mudanças em definição (virá da Fase 12).
- Arquivamento soft (CRUD completo; delete = hard delete + confirmação + impacto em rows).

## 3. Arquitetura

### 3.1. Schema Prisma

**Nova tabela:**
```prisma
model CustomAttribute {
  id           String   @id @default(uuid()) @db.Uuid
  companyId    String   @map("company_id") @db.Uuid
  entity       CustomAttributeEntity  // enum: lead, contact, opportunity, quote
  key          String   @db.VarChar(80)   // identificador técnico (snake_case)
  label        String   @db.VarChar(120)  // rótulo humano
  type         CustomAttributeType        // enum
  required     Boolean  @default(false)
  unique       Boolean  @default(false)   // unicidade por tenant+entity+key+value (só text/number)
  options      Json?    @default("[]")    // para select/multi_select: [{value, label}]
  defaultValue Json?                      // default tipado ao criar row
  placeholder  String?  @db.VarChar(200)
  helpText     String?  @db.VarChar(500)
  minLength    Int?
  maxLength    Int?
  minValue     Decimal? @db.Decimal(12, 4)
  maxValue     Decimal? @db.Decimal(12, 4)
  position     Int      @default(0)       // ordem no form
  visibleInList Boolean @default(false)   // aparece como coluna na tabela
  searchable   Boolean  @default(false)   // contribui pra busca global (Fase 25)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, entity, key])
  @@index([companyId, entity, position], name: "idx_custom_attr_form_order")
  @@map("custom_attributes")
}

enum CustomAttributeEntity {
  lead
  contact
  opportunity
  quote
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

**Alterações em tabelas existentes:**
```prisma
// Lead, Contact, Opportunity recebem:
custom Json @default("{}")

// + GIN index:
@@index([custom], type: Gin)
```
Prisma suporta `type: Gin` via `@@index([column], type: Gin)` em schema. Confirmar versão Prisma atual (7.6) — suportado.

**Migration reversível:**
- UP: `ALTER TABLE leads ADD COLUMN custom jsonb NOT NULL DEFAULT '{}'; CREATE INDEX ...`
- DOWN: `DROP INDEX ...; ALTER TABLE leads DROP COLUMN custom;`

### 3.2. Camada de validação

**Novo módulo:** `src/lib/custom-attributes/`
- `schema.ts` — Zod base por tipo (`textSchema`, `numberSchema`, etc.).
- `validator.ts` — `buildZodFromDefinitions(defs: CustomAttribute[]): ZodSchema` dinâmico.
- `query-builder.ts` — `buildPrismaWhereFromCustomFilters(filters, defs)` com operador allowlist.
- `renderer.tsx` (client) — `<CustomFieldInput def={...} value={...} onChange={...} />` switch por tipo.
- `list.ts` — `listCustomAttributes(tenantId, entity)` cached (Next `unstable_cache` ou Redis).

**Regras de validação:**
- `key` regex: `^[a-z][a-z0-9_]{1,79}$`, imutável após criação.
- `label`: 1-120 chars, livre.
- `type`: imutável após criação (evita migração JSONB).
- `options`: obrigatório se type ∈ {select, multi_select}; array de `{value: string(max40), label: string(max120)}`, min 1 max 50.
- `required`: pode alternar livre (legacy rows com `null` passam validação se `required=false`).
- `unique`: só para `text` e `number`. Check via `prisma.<entity>.findFirst({ where: { companyId, custom: { path: [key], equals: value } } })`.

**Query operators (enforcement):**
- Validar `op` contra allowlist POR TIPO antes de qualquer Prisma call.
- Rejeitar unknown operator com erro 400.
- **Nunca** usar `$queryRawUnsafe`.

### 3.3. UI Admin

**Rota:** `/settings/custom-attributes`
- Tabs por entity (Lead / Contact / Opportunity / Quote).
- Lista paginada de atributos com drag-drop de `position`.
- Modal criar/editar: form com tipo fixo no criar, todos os outros campos editáveis no editar.
- Delete com AlertDialog: mostra quantas rows têm valor não-null naquele key, confirma "vou remover N valores".

**Componentes DS:** Tab, Table, Dialog, Form, DropdownMenu, Badge. Todos do `@nexusai360/design-system`.

### 3.4. Render em forms de Lead/Contact/Opportunity

**Arquivos impactados:**
- `src/app/(protected)/leads/_components/lead-form.tsx` (ou componente equivalente — auditar na implementação)
- `src/app/(protected)/contacts/_components/contact-form.tsx`
- `src/app/(protected)/opportunities/_components/opportunity-form.tsx`

**Padrão:**
```tsx
const defs = await listCustomAttributes(companyId, "lead");
return (
  <Form>
    <FieldsCore />
    <CustomFieldsSection defs={defs} values={lead.custom ?? {}} onChange={...} />
  </Form>
);
```

`<CustomFieldsSection>` renderiza `<CustomFieldInput>` por definição, ordenado por `position`. Server action merge: `custom = { ...existingCustom, ...customDiff }`. Remover key = setar `null`.

### 3.5. Render em tabelas (colunas opt-in)

Colunas "Extras" renderizadas após as fixas, só para defs com `visibleInList: true`. Rendering por tipo:
- text/url/select/number/date/datetime → texto formatado
- boolean → badge verde/vermelho
- multi_select → pills

### 3.6. Filtros via URL

Extensão do `?status=new&q=ana` (Fase 24) com `?custom.mrr_gte=1000&custom.tags_hasAny=vip,lead`. Parser em `src/lib/filters/custom-parser.ts`:
- Chave `custom.<key>_<op>=<value>`.
- `multi_select` values separados por vírgula.
- Rejeita operadores fora da allowlist.

FilterBar (Fase 24) ganha nova seção colapsável "Atributos custom" listando defs com `searchable: true`.

### 3.7. Integração com busca global (Fase 25)

Atributos com `searchable: true` entram no `rankItems` do `/api/search`. Para text/url, `contains`. Para select, igualdade. Limite: só um atributo searchable por entity para não explodir queries (enforced na UI admin).

## 4. Contratos / API

### 4.1. Server actions

**Arquivo novo:** `src/lib/actions/custom-attributes.ts`

```typescript
export async function listCustomAttributes(entity: CustomAttributeEntity): Promise<ActionResult<CustomAttribute[]>>;
export async function createCustomAttribute(input: CreateInput): Promise<ActionResult<CustomAttribute>>;
export async function updateCustomAttribute(id: string, input: UpdateInput): Promise<ActionResult<CustomAttribute>>;
export async function deleteCustomAttribute(id: string): Promise<ActionResult<{ deletedCount: number; affectedRows: number }>>;
export async function reorderCustomAttributes(entity: CustomAttributeEntity, orderedIds: string[]): Promise<ActionResult>;
```

Todas com:
- `requirePermission("custom-attributes:manage")`
- `requireActiveCompanyId()`
- Zod validation
- Audit-log via `withAudit`

### 4.2. Hooks no Lead/Contact/Opportunity actions

`createLead`/`updateLead` recebem `custom?: Record<string, unknown>`. Validado contra defs carregadas sync no server action (cache via `unstable_cache`, invalidado em CRUD de defs).

## 5. RBAC

Nova permission: `custom-attributes:manage` — só admin/super_admin. Adicionar em `src/lib/rbac/permissions.ts` + `ROLE_PERMISSIONS`.

## 6. Testes

### 6.1. Unit
- `validator.test.ts` — buildZodFromDefinitions para cada tipo; rejeita inválido; opcional respeita `required: false`.
- `query-builder.test.ts` — operador allowlist por tipo; rejeita op desconhecido; gera Prisma `where` correto.
- `custom-parser.test.ts` — `?custom.mrr_gte=1000` → `{ path: ["mrr"], gte: 1000 }`.
- `list.test.ts` — cache hit/miss, invalidação após CRUD.
- `actions/custom-attributes.test.ts` — criar/editar/deletar, unicidade (companyId, entity, key), impacto de delete (count de rows afetadas).

### 6.2. Integration (Prisma)
- GIN index query: `custom @> '{"mrr": 1000}'` com EXPLAIN mostrando index scan (pode ficar como teste manual inicial).

### 6.3. E2E
- admin: cria atributo "MRR" type=number na tab Opportunity → form de nova oportunidade mostra campo → preenche 5000 → salva → lista mostra coluna "MRR" com valor 5000 → edita atributo para `required: true` → tenta criar opp sem MRR → erro.
- viewer sem `custom-attributes:manage`: não vê `/settings/custom-attributes` no menu; rota retorna 403.

## 7. Performance

- JSONB GIN index cobre operadores `@>`, `?`, `?&`, `?|`, `jsonb_path_ops` (escolher `jsonb_ops` genérico).
- `select` com `in` eficiente via `@>`.
- Datasets piloto: 10k rows/tenant com 20 atributos JSONB → P95 filtro <100ms com index.
- Alerta: atributos sem index explícito (só GIN genérico) sofrem em `contains` sobre text. Monitorar.

## 8. Segurança

- **Injeção SQL:** zero raw. Só Prisma typed filters.
- **DoS por query complexa:** limite de 3 filtros custom concorrentes por request.
- **Enumeração de tenants:** `CustomAttribute` sempre filtrado por `companyId` no resolver.
- **PII em custom:** admin pode criar campo "CPF" sensível. Mitigação: flag `isPii: boolean` no CustomAttribute para mascarar em logs/exports (v2 scope).
- **Storage cap:** limitar tamanho do `custom` JSONB a 64KB por row (enforce via Zod antes do save).

## 9. Migrations (ordem)

1. `CREATE TYPE custom_attribute_entity AS ENUM (...)`
2. `CREATE TYPE custom_attribute_type AS ENUM (...)`
3. `CREATE TABLE custom_attributes (...)`
4. `ALTER TABLE leads ADD COLUMN custom jsonb NOT NULL DEFAULT '{}'`
5. Idem para contacts, opportunities
6. `CREATE INDEX idx_lead_custom ON leads USING gin (custom jsonb_ops)` — idem contacts/opps
7. Seed opcional para devs: `scripts/seed-custom-attrs.ts`

Reversão: DROP INDEX → ALTER TABLE DROP COLUMN → DROP TABLE → DROP TYPE. Cada step independente.

## 10. Rollout

- Feature flag `FEATURE_CUSTOM_ATTRIBUTES` via `src/lib/flags` (já existe — Fase 1c).
- OFF por default em staging até passar smoke.
- Flip gradual: staging 7 dias → prod per-tenant allowlist → prod global.

## 11. Observabilidade

- Log via logger: `custom_attr.created`, `custom_attr.updated`, `custom_attr.deleted` com `{tenantId, entity, attrId, type}`.
- Métrica: contagem de atributos por tenant por entity (detectar tenants exagerando — cap duro em 30 por entity para MVP).

## 12. Riscos

| Risco | Mitigação |
|-------|-----------|
| Drift de tipo (tenant muda type) | type imutável após create |
| Explosão JSONB GIN | cap 64KB por row, 30 attrs por entity |
| Operadores custom (SQLi) | allowlist estrito + Zod enum |
| Migration falha em produção | UP/DOWN testados em staging; kill-switch via flag |
| Performance queries combinadas | teste EXPLAIN em QA antes de deploy |
| Unicidade race condition | unique constraint no DB via partial index ou check app-level (trade-off) |

## 13. Critérios de sucesso

- [ ] Admin cria 8 atributos (um de cada tipo) em `/settings/custom-attributes`.
- [ ] Form de Lead/Contact/Opportunity renderiza campos custom ordenados por `position`.
- [ ] Filtros URL `?custom.<key>_<op>=<value>` funcionam em /leads /contacts /opportunities.
- [ ] Delete de atributo mostra quantas rows impactadas antes de confirmar.
- [ ] Viewer não acessa `/settings/custom-attributes` (403).
- [ ] GIN index criado e usado (verificado via EXPLAIN manual).
- [ ] 30+ testes unit verdes; 2 E2E (admin + viewer).
- [ ] `npm run build` OK; `npm audit` 0 high/critical.
- [ ] Feature flag permite OFF sem redeploy.

## 14. Follow-ups agendados (pós-Fase 5)

- PII flag + masking em logs.
- Formulários condicionais (`show_if`).
- Versionamento de definição.
- Import/export CSV das definições (sinergia com Fase 10).
- WebForms públicos com custom attrs (módulo futuro).
