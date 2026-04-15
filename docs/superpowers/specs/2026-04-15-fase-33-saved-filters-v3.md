# Spec Fase 33 — Saved Filters (v3 FINAL)

## Mudanças vs v2 (review #2)

- `setAsDefault` sempre transacional via `$transaction` (unset dos outros + set do novo).
- Hook `useSavedFilters(moduleKey)` retorna **apenas** lista + CRUD; serialização fica no content (sabe chaves válidas).
- Dialog "Gerenciar": renomear via input inline com save-on-blur + Enter; excluir com AlertDialog.
- `listSavedFilters`: retorna vazio se user perdeu permissão do módulo.
- Limit 20 validado no `saveFilter` via `prisma.savedFilter.count()`.
- `setDefaultFilter` ação separada (conveniência via `updateFilter({setAsDefault:true})` reusa a mesma transaction).
- Tooltip discreto no botão "Limpar filtros" quando há default: "Limpa filtros e ignora o padrão até recarregar".
- E2E spec reduzido a 1 caso básico (abrir menu + salvar + aplicar).

## 1. Objetivo

Opção **I** do HANDOFF §0. Persistir conjuntos de filtros nomeados por
user por módulo, com default auto-apply no primeiro render.

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

Relação inversa em `User` e `Company`: `savedFilters SavedFilter[]`.

## 3. Zod schemas

Arquivo `src/lib/actions/saved-filters-schemas.ts`:

```ts
export const SavedFilterModuleZ = z.enum([
  "leads","contacts","opportunities",
  "products","tasks",
  "campaigns","segments","workflows",
]);
const FiltersPayloadZ = z.record(z.string(), z.string()).default({});
export const SaveFilterSchema = z.object({
  moduleKey: SavedFilterModuleZ,
  name: z.string().trim().min(1).max(80),
  filters: FiltersPayloadZ,
  setAsDefault: z.boolean().optional(),
});
export const UpdateFilterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  filters: FiltersPayloadZ.optional(),
  setAsDefault: z.boolean().optional(),
});
export const SetDefaultSchema = z.object({
  moduleKey: SavedFilterModuleZ,
  id: z.string().uuid(),
});
```

## 4. Server Actions (`src/lib/actions/saved-filters.ts`)

Assinaturas:

- `listSavedFilters(raw: { moduleKey }) → ActionResult<SavedFilter[]>`
- `saveFilter(raw) → ActionResult<SavedFilter>`
- `updateFilter(raw) → ActionResult<SavedFilter>`
- `deleteFilter(id: string) → ActionResult<{ deletedId }>`
- `setDefaultFilter(raw) → ActionResult<SavedFilter>` (transação)
- `getDefaultFilter(moduleKey): SavedFilter | null` (**não** usa ActionResult — helper para server components)

Todas ações: `await requirePermission("${moduleKey}:view")` (usa permissão do módulo base) + `requireActiveCompanyId` + `session.user.id`. Ownership enforce em update/delete (`where: { id, userId, companyId }`).

Limite: `saveFilter` faz `count({ where: { userId, companyId, moduleKey } }) → if >= 20: return error("Limite de 20 filtros salvos por módulo atingido")`.

Transaction em `setDefaultFilter`:
```ts
return prisma.$transaction([
  prisma.savedFilter.updateMany({
    where: { userId, companyId, moduleKey, isDefault: true },
    data:  { isDefault: false },
  }),
  prisma.savedFilter.update({
    where: { id, userId, companyId },
    data:  { isDefault: true },
  }),
]);
```

## 5. Hook `useSavedFilters`

`src/lib/hooks/use-saved-filters.ts`:

```ts
export function useSavedFilters(moduleKey: SavedFilterModule) {
  const [list, setList] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const r = await listSavedFilters({ moduleKey });
    if (r.success) setList(r.data);
    setLoading(false);
  }, [moduleKey]);
  useEffect(() => { reload(); }, [reload]);
  return { list, loading, reload };
}
```

Retorna só lista + reload. CRUD ações são chamadas diretamente pelo content (que trata toasts/refetch).

## 6. UI

### 6.1. `SavedFiltersMenu`

Arquivo `src/components/tables/saved-filters-menu.tsx`. Props:
```ts
interface Props {
  moduleKey: SavedFilterModule;
  currentFilters: Record<string,string>;
  savedList: SavedFilter[];
  onApply: (filters: Record<string,string>) => void;
  onSaveSuccess: () => void;
  onManageOpen: () => void;
}
```

Renderiza Popover com:
- Lista de filtros salvos (cada item com ⭐ se default + botão "Aplicar").
- Separador.
- Botão "+ Salvar filtros atuais" → abre `<SaveFilterDialog>` inline.
- Botão "⚙ Gerenciar" → abre `<ManageFiltersDialog>`.

Estado vazio: "Nenhum filtro salvo ainda. Configure filtros e clique em Salvar."

Ícones Lucide: `Star` (default), `Save`, `Settings2`, `BookmarkPlus`.

### 6.2. `SaveFilterDialog`

Dialog com:
- Input "Nome" (min 1 / max 80).
- Checkbox "Usar como padrão".
- Preview read-only dos filtros atuais ("3 filtros ativos: status=new, q='ABC', from=2026-03-01").
- Botões "Salvar"/"Cancelar".

### 6.3. `ManageFiltersDialog`

Dialog com tabela:
| Nome | Padrão | Ações |
|------|--------|-------|
| [input editável] | ⭐ toggle | Excluir |

Save on blur / Enter em input. Toast no sucesso. Optimistic update no toggle default.

### 6.4. Integração no FilterBar

Adicionar prop opcional em `FilterBar`:
```ts
savedFilters?: {
  moduleKey: SavedFilterModule;
  current: Record<string,string>;
  onApply: (filters: Record<string,string>) => void;
};
```

Quando presente: renderiza `<SavedFiltersMenu>` à esquerda do botão "Limpar filtros". Ausente: comportamento atual preservado.

### 6.5. Integração nos 8 contents

Em cada content:
```tsx
const savedList = useSavedFilters("leads");
const onApplySaved = (f) => {
  const parsed = LeadsFiltersSchema.safeParse(f);
  if (parsed.success) { setFilters(parsed.data); setSelectedIds(new Set()); }
};
<FilterBar
  {...existingProps}
  savedFilters={{ moduleKey:"leads", current: filters, onApply: onApplySaved }}
/>
```

## 7. Default auto-apply

Page Server Components (8 módulos):
```tsx
const params = await searchParams;
const hasParams = Object.keys(params).length > 0;
let effective = params;
if (!hasParams) {
  const def = await getDefaultFilter("leads");
  if (def) effective = def.filters;
}
const result = await listLeads(effective);
```

Tooltip no botão "Limpar filtros" quando `isDefault exists && filters ativos`: "Limpa filtros e ignora o padrão até recarregar a página".

## 8. i18n PT-BR

Strings:
- "Filtros salvos"
- "Nenhum filtro salvo ainda"
- "Salvar filtros atuais"
- "Nome" / "Usar como padrão"
- "Salvar" / "Cancelar" / "Excluir" / "Renomear"
- "Definir como padrão"
- "Gerenciar filtros salvos"
- "Limite de 20 filtros salvos por módulo atingido"
- "Filtro salvo com sucesso"
- "Filtro aplicado"
- Tooltip: "Limpa filtros e ignora o padrão até recarregar"

## 9. Migration prod

Prisma migrate dev gera `prisma/migrations/YYYYMMDDHHMMSS_add_saved_filters/`.

Em prod Prisma 7 sem runtime migrate deploy — aplicar via psql:
```sh
export PTOKEN=$(grep PORTAINER_TOKEN .env.production | cut -d= -f2)
# ... (obter CID do db)
docker exec -i <cid> psql -U nexus -d nexus_crm_krayin < prisma/migrations/<pasta>/migration.sql
```

Script idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) para segurança.

## 10. Critérios de aceitação

1. User salva filtros atuais com nome (1-80 chars).
2. Menu "Filtros salvos" em FilterBar de 8 módulos.
3. Aplicar filtro → state + URL atualizam imediato, selectedIds limpa.
4. Toggle default atômico via transaction.
5. Page aplica default quando sem query params.
6. Limpar filtros → ignora default até full reload (tooltip avisa).
7. Rename/delete via dialog Gerenciar com confirmação.
8. Limite 20 retorna erro PT-BR.
9. Cross-user: user A ≠ user B mesmo no mesmo tenant.
10. Migration aplicada em prod.
11. Vitest: server actions (ownership, limit, unique, setDefault transaction).
12. E2E: 1 spec básico (save + apply + delete).
13. `npm run test && npm run build` verdes.
14. Smoke prod OK pós-deploy.

## 11. Fora de escopo

- Compartilhamento entre users.
- Filtros globais da company.
- Sync entre abas.
- Último usado / recentes.
- Export/import.
- Filtros salvos com custom attributes embutidos.

## 12. Riscos

- R1 Migration prod: idempotente `IF NOT EXISTS`; checklist HANDOFF.
- R2 FilterBar fica poluído: prop opcional; sem integração = comportamento atual.
- R3 Schema de filters muda: opaco Record<string,string>; apply valida via Zod de cada módulo; chaves desconhecidas descartadas.
- R4 Performance: índice `(userId, companyId, moduleKey, isDefault)` → SELECT único.
- R5 Default loop: não chama router.replace no apply-default (só setState); guard didMount da Fase 32 previne refetch indesejado.

## 13. Estimativa

~4-5h autônomo. Grupos:
- A: modelo + migration + Zod schemas + 5 server actions + tests server.
- B: componentes `SavedFiltersMenu` + `SaveFilterDialog` + `ManageFiltersDialog` + FilterBar prop integration.
- C: hook `useSavedFilters` + integração em 8 contents + default auto-apply nos 8 pages.
- D: E2E + verification + deploy + migration psql.

Paralelizável: A/B em 2 subagents; C depende de B; D sequencial.
