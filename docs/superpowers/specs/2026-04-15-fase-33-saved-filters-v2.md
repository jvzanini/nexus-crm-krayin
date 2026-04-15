# Spec Fase 33 — Saved Filters (v2 pós-review #1)

## Mudanças vs v1

- `moduleKey` enum Prisma nativo (não string).
- Zod schemas completos.
- Comportamento explícito de "Limpar filtros" vs default.
- Limit 20 filtros/user/módulo.
- Migration manual em prod (Prisma 7).
- Interação com guard `didMount` da Fase 32.
- 8 módulos integrados via hook compartilhado.

## 1. Objetivo

Opção **I** do HANDOFF. Persistir conjuntos de filtros nomeados por user
por módulo, com opção de default automático.

## 2. Modelo Prisma

```prisma
enum SavedFilterModule {
  leads
  contacts
  opportunities
  products
  tasks
  campaigns
  segments
  workflows
}

model SavedFilter {
  id         String            @id @default(uuid())
  userId     String
  companyId  String
  moduleKey  SavedFilterModule
  name       String            @db.VarChar(80)
  filters    Json              @default("{}")
  isDefault  Boolean           @default(false)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  company    Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([userId, companyId, moduleKey, name])
  @@index([userId, companyId, moduleKey])
  @@index([userId, companyId, moduleKey, isDefault])
}
```

Regra de unicidade: um único `isDefault=true` por (user, company, module)
— garantir via transaction no setDefault (unset outros).

## 3. Zod schemas

`src/lib/actions/saved-filters-schemas.ts`:

```ts
export const SavedFilterModuleZ = z.enum([
  "leads", "contacts", "opportunities",
  "products", "tasks",
  "campaigns", "segments", "workflows",
]);
export const SaveFilterSchema = z.object({
  moduleKey: SavedFilterModuleZ,
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.string(), z.string()).default({}), // URLSearchParams → object
  setAsDefault: z.boolean().optional(),
});
export const UpdateFilterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  filters: z.record(z.string(), z.string()).optional(),
  setAsDefault: z.boolean().optional(),
});
```

## 4. Server Actions

`src/lib/actions/saved-filters.ts`:

- `listSavedFilters(moduleKey)`: retorna filtros do user atual no módulo. Sem RBAC admin — cada user só vê os seus.
- `saveFilter(raw)`: cria. Limite 20 por (user, company, module) — retorna erro se exceder.
- `updateFilter(raw)`: rename/filters/setDefault. Exige ownership.
- `deleteFilter(id)`: exige ownership.
- `setDefaultFilter({moduleKey, id})`: transaction desmarca default anterior + marca novo.
- `getDefaultFilter(moduleKey)` (usado no Server Component): se existir, usar como fallback quando searchParams vazio.

Todos: `requirePermission("<module>:view")` (usa perm do módulo base) + `requireActiveCompanyId` + `userId = session.user.id`. Filtros são tenant+user scoped.

## 5. UI

### 5.1. Componente `SavedFiltersMenu`

`src/components/tables/saved-filters-menu.tsx` — novo. Props: `moduleKey`, `currentFilters`, `savedList`, `onApply(filters)`, `onSaveCurrent()`, `onManage()`.

Renderiza dropdown/popover ancorado ao FilterBar:

```
┌─ Filtros salvos ────────────┐
│  ⭐ "Meus leads ativos"     │  ← default (star icon)
│  "Sem contato 30d"          │
│  "Convertidos Q1"           │
│  ─────────────────────────  │
│  + Salvar filtros atuais    │
│  ⚙  Gerenciar               │
└─────────────────────────────┘
```

Clicar em item → `onApply(item.filters)` que seta state + router.replace com URLSearchParams.

### 5.2. Dialog Salvar

`<Dialog>` com Input "Nome" + Checkbox "Usar como padrão" + botão "Salvar". Valida min(1)/max(80).

### 5.3. Dialog Gerenciar

Lista filtros com ações: renomear (inline), excluir (confirmação AlertDialog), marcar como padrão (⭐). Também permite exportar filtros (copia URL).

### 5.4. Botão Salvar dentro do FilterBar

Adicionar prop opcional `savedFilters?: { moduleKey, ... }` em FilterBar que renderiza o `SavedFiltersMenu` à esquerda do "Limpar filtros".

## 6. Default auto-apply

Server Component (page.tsx):

```tsx
const params = await searchParams;
const hasParams = Object.keys(params).length > 0;
let effective = params;
if (!hasParams) {
  const def = await getDefaultFilter("leads");
  if (def.success && def.data) effective = def.data.filters;
}
const result = await listLeads(effective);
return <LeadsContent initialFilters={effective} ... />;
```

Atenção: só aplica default no primeiro render (searchParams vazio). Clicar "Limpar filtros" → URL fica sem params; mas como não recarrega a page (router.replace), o default NÃO é reaplicado — `didMount` guard da Fase 32 previne loop. Comportamento: "Limpar" mostra TUDO sem filtros (ignora default até próximo full reload).

## 7. i18n PT-BR

Labels:
- "Filtros salvos"
- "Salvar filtros atuais"
- "Salvar" / "Cancelar"
- "Usar como padrão"
- "Gerenciar filtros salvos"
- "Renomear" / "Excluir" / "Definir como padrão"
- "Limite de 20 filtros salvos por módulo atingido"
- "Filtro salvo com sucesso"
- Estados vazios: "Nenhum filtro salvo ainda. Configure filtros e clique em Salvar."

## 8. Migration prod

Prisma 7 não tem migrate deploy no runtime. Aplicar via psql direto no container `nexus-crm-krayin_db` pós-deploy:

```sh
docker exec -i <cid> psql -U nexus -d nexus_crm_krayin < prisma/migrations/<pasta>/migration.sql
```

## 9. Critérios de aceitação

1. User pode salvar filtros atuais com nome; dialog valida 1-80 chars.
2. Lista "Filtros salvos" aparece no FilterBar de 8 módulos.
3. Clicar em filtro salvo aplica (state + URL) imediato.
4. Toggle default funciona; apenas 1 default por (user, module).
5. Page.tsx aplica default quando searchParams vazio.
6. Limpar filtros → tira URL + ignora default até full reload.
7. Renomear/excluir funcionam com optimistic update.
8. Limite 20 por módulo retorna erro PT-BR.
9. Cross-tenant e cross-user: user A não vê filtros do user B (mesmo na mesma company).
10. Migration aplicada em prod.
11. Testes Vitest cobrem server actions (ownership, limit, unique).
12. E2E: 1 spec cobrindo save + apply + default + delete.
13. `npm run test`, `build` verdes.
14. Smoke prod.

## 10. Fora de escopo

- Compartilhamento entre users.
- Filtros globais da company.
- Sync entre abas/sessões.
- Histórico de uso (último usado).
- Exportar/importar filtros como arquivo.
- Filtros salvos para custom attributes (Fase 5) — só os base.

## 11. Riscos

- **R1 — Migration em prod.** Mitigação: `CREATE TABLE IF NOT EXISTS` idempotente + checklist no HANDOFF.
- **R2 — Complexidade UI FilterBar.** Mitigação: `SavedFiltersMenu` isolado, FilterBar só injeta se `savedFilters` prop presente. Não-integrado = comportamento atual inalterado.
- **R3 — Filtros quebrarem quando schema mudar.** Mitigação: `filters` é Record<string,string> opaco — schema de filters por módulo valida no apply via Zod `safeParse`. Chaves desconhecidas descartadas.
- **R4 — Performance 20 filtros × 8 módulos em page load.** Mitigação: `getDefaultFilter` indexado por `(userId, companyId, moduleKey, isDefault)` → SELECT único com WHERE.

## 12. Estimativa

~4h autônomo. Parallelizável:
- T0: modelo Prisma + migration + Zod schemas + actions + tests server.
- T1: componente `SavedFiltersMenu` + dialogs.
- T2: integração em 8 contents (pode virar 1 hook `useSavedFilters(moduleKey)`).
- T3: E2E + verification + deploy.
