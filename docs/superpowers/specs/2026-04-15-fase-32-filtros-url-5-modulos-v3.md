# Spec Fase 32 — Filtros URL em products/tasks/campaigns/segments/workflows (v3 FINAL)

**Data:** 2026-04-15 (tarde)
**Versão:** v3 (pós-review #2, final)
**Autor:** Claude Opus 4.6 (sessão autônoma)
**Status:** APROVADA — pronta para plan

## Resumo executivo

Fechar opção **G** do HANDOFF (§0): estender padrão URL-based filters
(consolidado na Fase 24 em leads/contacts/opportunities) para os 5
módulos restantes com bulk delete já entregue (Fases 26-31):
`/products`, `/tasks`, `/marketing/campaigns`, `/marketing/segments`,
`/automation/workflows`.

## Mudanças vs v2 (review #2)

- **`activities:view-all` não existe** em `src/lib/rbac/permissions.ts` (verificado). Fallback oficial: exigir `CompanyRole` ∈ `{admin, manager}` via `requireCompanyRole`. Sem criar nova permission.
- **`listMyTasks` tem 1 consumer** (`tasks-content.tsx:474`). Estratégia: manter `listMyTasks` como wrapper chamando `listTasks({ assigneeScope:"me", ...filter })` para não quebrar nada externo. Novo Server Action `listTasks` assume filtros completos.
- **`initialFilters` revalidado no Client**: Content faz `ProductsFiltersSchema.safeParse(initialFilters)` antes de setar state — garante tipo seguro mesmo com URL adulterada manualmente.
- **Empty state:** confirmada existência de `<EmptyState>` em cada módulo (Fase 20 T2). Adicionar branch "Nenhum resultado com os filtros aplicados" quando `hasActive && data.length === 0`.
- **Debounce 300ms em `q`:** implementar via hook `useDebouncedValue` (criar se ausente em `src/lib/hooks/`).
- **Products: campo `category` é indexado** (`@@index([companyId, category])` — query distinct performática).
- **Segments sem status:** confirmado — só `q` + `from`/`to`.

## 1. Objetivo

Ver "Resumo executivo".

## 2. Padrão canônico

### 2.1. Arquitetura de filters (3 camadas)

```
searchParams (URL)
   │  await searchParams (Server Component)
   ▼
Page (SSR)
   │  listEntity(parsedByZod)  (first render)
   ▼
Content (Client)
   │  state: filters, items, selectedIds
   │  useEffect([filters.a, filters.b, ...])
   │    → router.replace(URLSearchParams, { scroll:false })
   │    → listEntity(filters).then(setItems)
   ▼
FilterBar + Table
```

### 2.2. Server Action template

```ts
// <module>-schemas.ts  (pode exportar Zod — NÃO tem "use server")
import { z } from "zod";
export const EntityFiltersSchema = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  status: EntityStatusZ.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type EntityFilters = z.infer<typeof EntityFiltersSchema>;

// <module>.ts  ("use server")
export async function listEntity(raw?: unknown) {
  await requirePermission("entity:view");
  const companyId = await requireActiveCompanyId();
  const parsed = raw ? EntityFiltersSchema.safeParse(raw) : { success: true, data: undefined };
  const filters = parsed.success ? parsed.data : undefined;

  const where: Prisma.EntityWhereInput = { companyId };
  if (filters?.status) where.status = filters.status;
  if (filters?.q) where.OR = [ /* fields */ ];
  if (filters?.from) where.createdAt = { ...(where.createdAt as object ?? {}), gte: new Date(filters.from) };
  if (filters?.to)   where.createdAt = { ...(where.createdAt as object ?? {}), lte: new Date(filters.to + "T23:59:59.999Z") };

  return { success: true as const, data: await prisma.entity.findMany({ where, orderBy: { createdAt: "desc" } }) };
}
```

`safeParse` evita exception em URL adulterada (fallback sem filtro).

### 2.3. Page template

```tsx
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const result = await listEntity(params);
  if (!result.success) notFound();
  return <Content initialItems={result.data} initialFilters={params} />;
}
```

### 2.4. Content template

```tsx
"use client";
const parsedInit = EntityFiltersSchema.safeParse(initialFilters);
const [filters, setFilters] = useState<EntityFilters>(parsedInit.success ? parsedInit.data ?? {} : {});
const [items, setItems] = useState(initialItems);
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const debouncedQ = useDebouncedValue(filters.q, 300);
const router = useRouter();

useEffect(() => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, q: debouncedQ })) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  router.replace(`?${params.toString()}`, { scroll: false });
  listEntity({ ...filters, q: debouncedQ }).then((r) => {
    if (r.success) {
      setItems(r.data);
      setSelectedIds([]);
    }
  });
}, [debouncedQ, filters.status, filters.from, filters.to /* etc por campo */]);

const updateFilter = (key: keyof EntityFilters, value: string | undefined) => {
  setFilters(prev => ({ ...prev, [key]: value || undefined }));
};
const clearFilters = () => { setFilters({}); setSelectedIds([]); };
```

**Crítico:** dependências do `useEffect` são **campos individuais**, não o objeto `filters` — evita loop infinito.

## 3. Escopo por módulo

### 3.1. Products

- **Page:** `src/app/(protected)/products/page.tsx` — awaitar `searchParams`; chamar `listProducts(params)`; buscar `listDistinctCategories(companyId)` para options.
- **Content:** `src/app/(protected)/products/products-content.tsx`.
- **Action:** `src/lib/actions/products.ts` — `listProducts(raw?)` com Zod. `listDistinctCategories(companyId)` helper novo.
- **Schema:** `src/lib/actions/products-schemas.ts`.
- **RBAC:** `products:view` preservado.
- **Filtros:**
  | Key | Tipo | Valores | Label |
  |---|---|---|---|
  | `q` | input | livre | "Buscar nome ou SKU..." |
  | `active` | select | `active`/`inactive` | "Status: Todos/Ativos/Inativos" |
  | `category` | select | distinct da company | "Categoria" |

### 3.2. Tasks

- **Page:** `src/app/(protected)/tasks/page.tsx`.
- **Content:** `src/app/(protected)/tasks/_components/tasks-content.tsx`.
- **Action:** `src/lib/actions/activities.ts` — **novo** `listTasks(raw?)`. `listMyTasks` vira wrapper (compat).
- **Schema:** `src/lib/actions/activities-schemas.ts` (já existe para activities — estender).
- **RBAC:** `activities:view` preservado. `assigneeScope=all` exige `CompanyRole ∈ {admin, manager}` via `requireCompanyRole`.
- **Filtros:**
  | Key | Tipo | Valores | Label |
  |---|---|---|---|
  | `q` | input | livre | "Buscar título ou descrição..." |
  | `status` | select | `pending`/`completed`/`canceled` | "Status: Todos/Pendente/Concluída/Cancelada" |
  | `assigneeScope` | select | `me` (default)/`all`/`<userId>` | "Responsável: Minhas/Todas/[user]" |
  | `dueWithinDays` | select | `overdue`/`today`/`7`/`30` | "Prazo: Qualquer/Atrasadas/Hoje/7 dias/30 dias" |

- **Lógica `dueWithinDays`:**
  - `overdue`: `dueAt < now AND status = pending`.
  - `today`: `dueAt BETWEEN startOfDay(now) AND endOfDay(now)`.
  - `7` / `30`: `dueAt BETWEEN now AND addDays(now, N)`.

### 3.3. Campaigns

- **Page:** `src/app/(protected)/marketing/campaigns/page.tsx`.
- **Content:** `src/app/(protected)/marketing/campaigns/campaigns-content.tsx`.
- **Action:** `src/lib/actions/marketing-campaigns.ts` — `listCampaignsAction(raw?)` (refactor).
- **Schema:** `src/lib/actions/marketing-campaigns-schemas.ts` (criar ou estender existente).
- **RBAC:** preservar `requirePermission(...)` atual (verificar nome exato em T0; provavelmente `marketing:view` ou `campaigns:view`).
- **Filtros:**
  | Key | Tipo | Valores | Label |
  |---|---|---|---|
  | `q` | input | livre | "Buscar nome..." |
  | `status` | select | `CampaignStatus` | "Status: Todos/Rascunho/Agendada/Enviando/Enviada/Pausada/Cancelada/Falhou" |
  | `from` | date | YYYY-MM-DD | "De" |
  | `to` | date | YYYY-MM-DD | "Até" |

### 3.4. Segments

- **Page:** `src/app/(protected)/marketing/segments/page.tsx`.
- **Content:** `src/app/(protected)/marketing/segments/segments-content.tsx`.
- **Action:** `src/lib/actions/marketing-segments.ts` — `listSegmentsAction(raw?)` (refactor).
- **Schema:** `src/lib/actions/marketing-segments-schemas.ts`.
- **RBAC:** preservar atual.
- **Filtros:**
  | Key | Tipo | Valores | Label |
  |---|---|---|---|
  | `q` | input | livre | "Buscar nome..." |
  | `from` | date | YYYY-MM-DD | "De" |
  | `to` | date | YYYY-MM-DD | "Até" |

### 3.5. Workflows

- **Page:** `src/app/(protected)/automation/workflows/page.tsx`.
- **Content:** `src/app/(protected)/automation/workflows/workflows-list.tsx`.
- **Action:** `src/lib/actions/workflows.ts` — `listWorkflowsAction(raw?)` (refactor).
- **Schema:** `src/lib/actions/workflows-schemas.ts`.
- **RBAC:** `workflows:view` preservado.
- **Filtros:**
  | Key | Tipo | Valores | Label |
  |---|---|---|---|
  | `q` | input | livre | "Buscar nome..." |
  | `status` | select | `WorkflowStatus` | "Status: Todos/Rascunho/Ativo/Pausado" |
  | `trigger` | select | `WorkflowTrigger` | "Gatilho: Todos/Lead criado/Contato criado/Atividade concluída" |

## 4. Identidade visual (LEI #4)

Reutilização total do FilterBar já consolidado. Nada novo em termos de
Card/botão/ícone. Ícones Lucide permitidos: `Filter`, `Search`, `X`,
`Calendar`, `Users`. Stagger 0.08 em motion.tr rows preservado.

## 5. Critérios de aceitação (pente fino)

1. **5 módulos** têm FilterBar visível acima da tabela.
2. Alterar filtro → URL atualiza (`router.replace`) **sem** scroll reset → refetch retorna itens filtrados → `selectedIds` limpa.
3. Botão "Limpar filtros" → reseta state + URL + seleção.
4. Back navigation → filtros restauram de `searchParams`.
5. `companyId` **sempre** no `where` (defense-in-depth).
6. `safeParse` → URL adulterada ignorada (fallback sem filtro; zero exception).
7. Debounce 300ms em `q`.
8. Empty state: "Nenhum resultado com os filtros aplicados. [Limpar filtros]" quando `hasActive && items.length === 0`.
9. Tasks: `assigneeScope=all` bloqueado para viewer (alert de permissão inline).
10. Labels 100% PT-BR com acentos.
11. Nenhum `console.*` — logger `@/lib/logger`.
12. Nenhum emoji — Lucide icons.
13. Testes Vitest: 5 novos (1 where-clause por módulo).
14. E2E Playwright: 5 novos specs (1 por módulo cobrindo apply + clear).
15. `npm run lint && npm run typecheck && npm run test && npm run build` verdes.
16. Smoke prod pós-deploy: `/login` 200, `/api/health` 200, `/products?q=test` 200 (autenticado via E2E).

## 6. Riscos & mitigações

- **R1 — `listMyTasks` refactor:** wrapper compat chama `listTasks({assigneeScope:"me"})`. Teste unitário validando que wrapper retorna mesma shape.
- **R2 — `activities:view-all` ausente:** usar `requireCompanyRole(["admin","manager"])` (função já existe em `src/lib/rbac/` — validar em T0; senão criar).
- **R3 — Zod parse fail silencioso pode mascarar bug:** logar `warn` quando `safeParse` falha com `url: searchParams` redacted.
- **R4 — Debounce em q com SSR:** na primeira renderização, aplica filter direto (não debounce). Debounce só no useEffect subsequente.
- **R5 — Duplicação de schemas:** 5 novos `*-schemas.ts`. Aceito — cada módulo auto-contido.
- **R6 — Performance q LIKE:** pg_trgm tracked em `project_phase_25_1_followups.md`. Aceito no MVP.

## 7. Fora de escopo

- Bulk delete/edit (já feito Fases 26-31).
- Saved filters (opção **I**, fase separada).
- Custom attributes filter nesses 5 módulos.
- pg_trgm GIN indexes.
- Criar permission `activities:view-all`.
- Mudanças em /leads/contacts/opps (já na Fase 24).

## 8. Verificação (LEI #5.1 → `verification-before-completion`)

- `npm run lint`
- `npm run typecheck`
- `npm run test` (Vitest ≥681 passed — 676 atual + 5 novos)
- `npm run build`
- `npm run test:e2e` (Playwright ≥22 specs — 17 atual + 5 novos)
- Smoke prod: `curl /login`, `/api/health`, `/api/ready`.

## 9. Estimativa

~3h30 autônomo, paralelizável via subagents (módulos independentes).

## 10. Artefatos entregues

- Specs `v1/v2/v3` em `docs/superpowers/specs/`.
- Plans `v1/v2/v3` em `docs/superpowers/plans/`.
- 5 novos `*-schemas.ts`.
- 5 action refactors + 1 action novo (`listTasks`).
- 5 page updates (`searchParams` awaitados).
- 5 content refactors (FilterBar + useEffect + empty state dinâmico).
- 5 Vitest tests + 5 Playwright specs.
- Tag `phase-32-filtros-url-5-modulos-deployed`.
- Memory: atualizar `filters_bulk_pattern.md` (8 módulos totais).
- HANDOFF.md §0 atualizado (remover G da lista, adicionar Fase 32 ao histórico).
