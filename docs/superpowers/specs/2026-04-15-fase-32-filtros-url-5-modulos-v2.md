# Spec Fase 32 — Filtros URL em products/tasks/campaigns/segments/workflows (v2)

**Data:** 2026-04-15 (tarde)
**Versão:** v2 (pós-review #1 da spec)
**Autor:** Claude Opus 4.6 (sessão autônoma)
**Status:** rascunho — aguardando review #2

## Mudanças vs v1

- Schemas Zod de filters especificados (padrão `<nome>-schemas.ts` já estabelecido, ver CLAUDE.md §Convenções).
- RBAC preservado: cada action refactored mantém `requirePermission(...)` atual.
- Enums reais confirmados via `prisma/schema.prisma`.
- Tasks: definido toggle "Minhas vs Todas" via param `assigneeScope=me|all|<uuid>`.
- Labels PT-BR listados por módulo.
- Pattern crítico `useEffect` por campo individual documentado.
- Identidade visual (LEI #4) explicitada: Card `border-border bg-card/50`, botões `bg-violet-600 hover:bg-violet-700`, Lucide icons, stagger 0.08.
- Empty state vazio após filter: Fase 20 T2 já renderiza `<EmptyState>` quando lista vazia — precisa verificar que mensagem é "Nenhum resultado para os filtros aplicados" (fallback).

## 1. Objetivo

Fechar **G** do HANDOFF (§0): estender padrão URL-based filters (Fase 24)
para `/products`, `/tasks`, `/marketing/campaigns`, `/marketing/segments`,
`/automation/workflows`. Bulk delete já presente (Fases 26-31).

## 2. Padrão canônico (memory `filters_bulk_pattern.md`)

### 2.1. Server Action template

```ts
// <module>-schemas.ts  (NÃO "use server", pode exportar Zod/enums)
import { z } from "zod";

export const ProductsFiltersSchema = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  active: z.enum(["active", "inactive"]).optional(),
  category: z.string().trim().min(1).max(64).optional(),
});
export type ProductsFilters = z.infer<typeof ProductsFiltersSchema>;

// products.ts  ("use server")
export async function listProducts(raw?: unknown) {
  await requirePermission("products:view");
  const companyId = await requireActiveCompanyId();
  const filters = raw ? ProductsFiltersSchema.parse(raw) : undefined;

  const where: Prisma.ProductWhereInput = { companyId };
  if (filters?.active === "active")   where.active = true;
  if (filters?.active === "inactive") where.active = false;
  if (filters?.category) where.category = filters.category;
  if (filters?.q) where.OR = [
    { name: { contains: filters.q, mode: "insensitive" } },
    { sku:  { contains: filters.q, mode: "insensitive" } },
  ];

  return { success: true as const, data: await prisma.product.findMany({ where, orderBy: { createdAt: "desc" } }) };
}
```

Defense-in-depth: `companyId` SEMPRE presente.

### 2.2. Page Server Component template

```tsx
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const result = await listProducts(params);
  if (!result.success) notFound();
  const categories = await listDistinctCategories(); // 1 query extra
  return <ProductsContent initialItems={result.data} initialFilters={params} categoryOptions={categories} />;
}
```

### 2.3. Content Client template (padrão useEffect por campo)

```tsx
"use client";
const [filters, setFilters] = useState<ProductsFilters>(initialFilters);
const [items, setItems] = useState(initialItems);
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const router = useRouter();

// CRÍTICO: watchdog por campo individual (não objeto) — evita loop
useEffect(() => {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.active) params.set("active", filters.active);
  if (filters.category) params.set("category", filters.category);
  router.replace(`?${params.toString()}`, { scroll: false });
  listProducts(filters).then(r => { if (r.success) setItems(r.data); setSelectedIds([]); });
}, [filters.q, filters.active, filters.category]);

const updateFilter = (key: keyof ProductsFilters, value: string | undefined) => {
  setFilters(prev => ({ ...prev, [key]: value || undefined }));
};
```

Debounce em `q` (300ms) via util existente (verificar se já há; senão `useDebouncedValue`).

## 3. Escopo detalhado por módulo

### 3.1. Products

| Item | Valor |
|---|---|
| Page | `src/app/(protected)/products/page.tsx` |
| Content | `src/app/(protected)/products/products-content.tsx` |
| Action | `src/lib/actions/products.ts` — `listProducts(filters?)` |
| Schema | `src/lib/actions/products-schemas.ts` — `ProductsFiltersSchema` |
| RBAC | `products:view` (preservado) |
| Filtros | `q` (input), `active` (select: Todos/Ativos/Inativos), `category` (select dinâmico) |
| Refactor action | **Parcial** — já aceita `filter`; ajustar para Zod parse + validar |

**Helper novo:** `listDistinctCategories(companyId)` — `prisma.product.findMany({ where:{companyId}, distinct:["category"], select:{category:true} })`.

### 3.2. Tasks

| Item | Valor |
|---|---|
| Page | `src/app/(protected)/tasks/page.tsx` |
| Content | `src/app/(protected)/tasks/tasks-content.tsx` |
| Action | `src/lib/actions/activities.ts` — **novo** `listTasks(filters?)` |
| Schema | `src/lib/actions/activities-schemas.ts` — `TasksFiltersSchema` |
| RBAC | `activities:view` (preservado); se `assigneeScope=all` exige `activities:view-all` OU admin/manager (CompanyRole) |

**Filtros:**
- `status` (select): `ActivityStatus` = `pending | completed | canceled`
- `assigneeScope` (select): `me` (default) | `all` | `<userId>`
  - Label PT-BR: "Minhas tarefas" / "Todas" / "[Nome do usuário]"
- `dueWithinDays` (select): `today | 7 | 30 | overdue` (default: sem filtro)
- `q` (input): busca em `title` + `description`

**Action novo:**

```ts
export async function listTasks(raw?: unknown) {
  const user = await requireUser();
  const companyId = await requireActiveCompanyId();
  const filters = raw ? TasksFiltersSchema.parse(raw) : undefined;

  const where: Prisma.ActivityWhereInput = {
    companyId,
    type: "task",
  };
  // assigneeScope
  if (!filters?.assigneeScope || filters.assigneeScope === "me") {
    where.assignedToId = user.id;
  } else if (filters.assigneeScope === "all") {
    await requirePermission("activities:view-all"); // ou fallback admin/manager role
  } else {
    where.assignedToId = filters.assigneeScope; // specific user
  }
  if (filters?.status) where.status = filters.status;
  if (filters?.q) where.OR = [
    { title: { contains: filters.q, mode: "insensitive" } },
    { description: { contains: filters.q, mode: "insensitive" } },
  ];
  // dueWithinDays → dueAt range
  const now = new Date();
  if (filters?.dueWithinDays === "today") {
    where.dueAt = { gte: startOfDay(now), lte: endOfDay(now) };
  } else if (filters?.dueWithinDays === "overdue") {
    where.dueAt = { lt: now };
    where.status = "pending";
  } else if (filters?.dueWithinDays) {
    const days = Number(filters.dueWithinDays);
    where.dueAt = { gte: now, lte: addDays(now, days) };
  }
  return { success: true as const, data: await prisma.activity.findMany({ where, orderBy: { dueAt: "asc" } }) };
}
```

`listMyTasks` pode continuar existindo ou ser removido em favor de
`listTasks` com `assigneeScope=me`. Preferência: **remover `listMyTasks`**
e atualizar consumers (buscar referências).

### 3.3. Campaigns

| Item | Valor |
|---|---|
| Page | `src/app/(protected)/marketing/campaigns/page.tsx` |
| Content | `src/app/(protected)/marketing/campaigns/campaigns-content.tsx` |
| Action | `src/lib/actions/marketing-campaigns.ts` — `listCampaignsAction(filters?)` |
| Schema | `src/lib/actions/marketing-campaigns-schemas.ts` — `CampaignsFiltersSchema` |
| RBAC | `marketing:view` ou `campaigns:view` (verificar atual) |
| Filtros | `status` (select), `q` (input), `from`/`to` (date) |

**Enum `CampaignStatus`** (Prisma): `draft | scheduled | sending | sent | paused | canceled | failed`.
Label select: "Todos | Rascunho | Agendada | Enviando | Enviada | Pausada | Cancelada | Falhou".

### 3.4. Segments

| Item | Valor |
|---|---|
| Page | `src/app/(protected)/marketing/segments/page.tsx` |
| Content | `src/app/(protected)/marketing/segments/segments-content.tsx` |
| Action | `src/lib/actions/marketing-segments.ts` — `listSegmentsAction(filters?)` |
| Schema | `src/lib/actions/marketing-segments-schemas.ts` |
| RBAC | `marketing:view` ou `segments:view` (preservado) |
| Filtros | `q` (input em `name`), `from`/`to` (date em `createdAt`) |

### 3.5. Workflows

| Item | Valor |
|---|---|
| Page | `src/app/(protected)/automation/workflows/page.tsx` |
| Content | `src/app/(protected)/automation/workflows/workflows-list.tsx` |
| Action | `src/lib/actions/workflows.ts` — `listWorkflowsAction(filters?)` |
| Schema | `src/lib/actions/workflows-schemas.ts` |
| RBAC | `workflows:view` (preservado) |
| Filtros | `status`, `trigger`, `q` |

**Enums reais:**
- `WorkflowStatus`: `draft | active | paused`. Label: "Todos | Rascunho | Ativo | Pausado".
- `WorkflowTrigger`: `lead_created | contact_created | activity_completed`. Label: "Todos | Lead criado | Contato criado | Atividade concluída".

## 4. Labels PT-BR (UI)

Todos os filtros devem ter labels em PT-BR com acentos corretos. Exemplos:

| Filtro | Placeholder/Label |
|---|---|
| `q` | "Buscar..." |
| `status` | "Status" |
| `active` | "Status" (Ativos/Inativos) |
| `category` | "Categoria" |
| `assigneeScope` | "Responsável" |
| `dueWithinDays` | "Prazo" |
| `trigger` | "Gatilho" |
| `from` / `to` | "De" / "Até" |
| Botão clear | "Limpar filtros" |

## 5. Identidade visual (LEI #4 + CLAUDE.md §Padrão Visual)

- FilterBar reutilizado (já alinhado).
- BulkActionBar sticky violet já presente.
- Cards da tabela: `border-border bg-card/50 rounded-xl`.
- Botões primários: `bg-violet-600 hover:bg-violet-700`.
- Ícones Lucide (Filter, X, Search, Calendar). **NUNCA emoji.**
- Stagger 0.08 em motion.tr rows (já consolidado em Fase 13).
- Fonte Inter (default).

## 6. Critérios de aceitação

1. FilterBar visível acima de cada tabela nos 5 módulos.
2. Alterar filtro atualiza URL via `router.replace` e refetch retorna apenas itens filtrados.
3. Botão "Limpar filtros" reseta state + URL + `selectedIds` (limpa seleção).
4. Back navigation restaura filtros (URL source of truth; `initialFilters` vem de `searchParams`).
5. `companyId` sempre no `where`.
6. Zod schema valida `searchParams`; inputs inválidos → ignorados (fallback sem filtro, sem exception).
7. Tasks: `assigneeScope=all` exige admin/manager (CompanyRole) ou `activities:view-all` (se existir).
8. Debounce 300ms em `q`.
9. Empty state "Nenhum resultado com os filtros aplicados" quando lista vazia E algum filter ativo.
10. Testes Vitest: 1 caso de where-clause composto por módulo (5 novos).
11. E2E Playwright: 1 spec por módulo cobrindo apply + clear (5 novos).
12. `npm run lint && npm run typecheck && npm run test` verde (676+ tests).
13. Smoke prod pós-deploy: `/login` 200, `/api/health` 200, `/products` 200 autenticado.

## 7. Riscos

- **R1 — Tasks refactor:** `listMyTasks` possivelmente referenciado em outros pontos (dashboard, tasks count). Mitigação: grep antes do refactor + manter wrapper de compat temporário.
- **R2 — `activities:view-all` pode não existir:** verificar em `src/lib/rbac/permissions.ts`. Se ausente: usar checagem de role (CompanyRole in ["admin","manager"]) inline na action.
- **R3 — Category dinâmica:** `prisma.product.findMany({ distinct:["category"] })` → se o campo for nullable, tratar null.
- **R4 — Performance:** `q` com `contains` faz seq scan em tabelas grandes. Aceito em MVP; pg_trgm tracked em follow-up.
- **R5 — Duplicação de schema:** 5 novos `*-schemas.ts`. Aceitável — cada módulo auto-contido.

## 8. Fora de escopo

- Bulk delete/edit (Fases 26-31).
- Saved filters (opção **I**, fase separada).
- Custom attributes filter nesses módulos (Fase 5 escopo apenas leads/contacts/opps).
- pg_trgm / índices GIN text search.
- Novas permissions (`activities:view-all` se não existir: fallback CompanyRole).

## 9. Plano de verificação

- `npm run lint`
- `npm run typecheck`
- `npm run test` (Vitest, esperar ≥681 passando — 676 atual + 5 novos)
- `npm run build`
- `npm run test:e2e` (Playwright, esperar 22+ specs passando — atual 17+)
- Smoke prod: curl `/login`, `/api/health`, `/api/ready`.

## 10. Estimativa

- ~3h30 modo autônomo. Paralelizável via subagents: 2-3 módulos por rodada.

## 11. Artefatos

- Spec final: v3 neste mesmo diretório.
- Plan: v1→v2→v3 em `docs/superpowers/plans/`.
- Tag deployed: `phase-32-filtros-url-5-modulos-deployed`.
- Memory update: `filters_bulk_pattern.md` ampliar para 8 módulos.
