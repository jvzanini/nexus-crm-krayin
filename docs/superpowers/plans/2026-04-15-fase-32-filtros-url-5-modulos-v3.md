# Plan Fase 32 — Filtros URL em 5 módulos (v3 FINAL)

**Spec:** `docs/superpowers/specs/2026-04-15-fase-32-filtros-url-5-modulos-v3.md`

## Mudanças vs v2 (review #2)

- **Verificado:** `requireCompanyRole` **existe** em `src/lib/tenant.ts:21` — API `(userId, companyId, minRole)` retorna boolean. Usar em `listTasks` quando `assigneeScope=all`.
- **Verificado:** `getCompanyAssignees` **existe** em `src/lib/actions/leads.ts:349` — reaproveitar em tasks content.
- **Verificado:** `*-schemas.ts` já existem para `activities`, `marketing-campaigns`, `marketing-segments`, `workflows`. Apenas **estender**, não criar.
- **Verificado:** `tasks-content.tsx:466` já tem filter local (status, dueWithinDays) em useEffect chamando `listMyTasks(filter)`. Refactor para FilterBar mantém shape de query similar.
- **Commits segmentados por grupo** (não task-by-task) — 7 commits no total.
- **E2E:** Fase 12.2 já tem seed 2 tenants. Reutilizar. Cada spec cria registros on-demand no beforeAll caso necessário.
- **RBAC test explícito** para tasks (viewer bloqueado em `assigneeScope=all`).

## 0. Preparação (Rodada 1 — sequencial rápido)

### T0.1 — Criar hook `useDebouncedValue`
**Arquivo:** `src/lib/hooks/use-debounced-value.ts`
**Body:**
```ts
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
```
**Sucesso:** importável como `@/lib/hooks/use-debounced-value`.

### T0.2 — Criar `src/lib/actions/products-schemas.ts`
**Export:** `ProductsFiltersSchema` = `z.object({ q?, active?: z.enum(["active","inactive"]), category? })`.

### T0.3 — Documentar RBAC atual (no próprio plan)
```
products.ts listProducts     → requirePermission("products:view")
activities.ts listMyTasks    → requirePermission("activities:view")
marketing-campaigns.ts       → requirePermission("marketing:view") (assumir; grep em T-CAMP.2)
marketing-segments.ts        → requirePermission("marketing:view") (grep em T-SEG.2)
workflows.ts listWorkflows   → requirePermission("workflows:view") (grep em T-WF.2)
```
Cada refactor preserva o `requirePermission` atual.

## 1. Grupo A — Products (atomic)

Arquivos alvo:
- `src/lib/actions/products-schemas.ts` (novo — T0.2)
- `src/lib/actions/products.ts` (refactor `listProducts` + novo `listDistinctCategories`)
- `src/app/(protected)/products/page.tsx` (awaitar searchParams)
- `src/app/(protected)/products/products-content.tsx` (FilterBar + state + useEffect)
- `src/lib/actions/__tests__/products-filters.test.ts` (novo)

**Detalhamento em v2** (seção Grupo A). Sem mudanças em v3.

**Commit:** `feat(fase-32): filtros URL em /products (A)`.

## 2. Grupo B — Tasks (atomic)

### T-TASK.1 — Estender `activities-schemas.ts`
**Export novo:** `TasksFiltersSchema`:
```ts
export const TasksFiltersSchema = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  status: z.enum(["pending","completed","canceled"]).optional(),
  assigneeScope: z.union([z.enum(["me","all"]), z.string().uuid()]).optional(),
  dueWithinDays: z.enum(["overdue","today","7","30"]).optional(),
});
export type TasksFilters = z.infer<typeof TasksFiltersSchema>;
```

### T-TASK.2 — Novo `listTasks` em `activities.ts`
**RBAC:**
- `requirePermission("activities:view")` sempre.
- Se `assigneeScope==="all"`: checar `requireCompanyRole(user.id, companyId, "manager")` → se false, silenciosamente forçar `assigneeScope="me"` (graceful degrade) OU retornar erro. **Decisão:** graceful degrade (clamp para "me") — evita UI quebrada para viewer com URL adulterada; log warn.

### T-TASK.3 — `listMyTasks` wrapper
```ts
export async function listMyTasks(filter?: { status?: ..., dueWithinDays?: number }) {
  return listTasks({
    status: filter?.status,
    assigneeScope: "me",
    dueWithinDays: filter?.dueWithinDays ? String(filter.dueWithinDays) as any : undefined,
  });
}
```
Nota: `dueWithinDays` antes era `number`, agora string enum. Adaptar no wrapper.

### T-TASK.4 — Page `/tasks`
Awaitar searchParams; chamar `listTasks(params)`; carregar `getCompanyAssignees()`.

### T-TASK.5 — Content `tasks-content.tsx`
- Substituir state local por `filters: TasksFilters`.
- FilterBar com 4 filtros.
- `assigneeScope` select popula com `[{value:"me",label:"Minhas tarefas"}, {value:"all",label:"Todas"},  ...assignees]`.
- Se session.user.companyRole ∈ {admin,manager} → mostra opção "Todas"; senão esconde.

### T-TASK.6 — Tests Vitest
`src/lib/actions/__tests__/tasks-filters.test.ts`:
- `listTasks({status:"pending"})` → where.status="pending".
- `listTasks({assigneeScope:"me"}, viewer)` → where.assignedToId=user.id.
- `listTasks({assigneeScope:"all"}, admin)` → where.assignedToId undefined.
- `listTasks({assigneeScope:"all"}, viewer)` → graceful clamp para "me" (where.assignedToId=user.id + log warn).
- `listTasks({dueWithinDays:"overdue"})` → where.dueAt.lt=now + where.status=pending.

**Commit:** `feat(fase-32): filtros URL em /tasks + listTasks action (B)`.

## 3. Grupo C — Campaigns

### T-CAMP.0 — grep RBAC atual
`grep "requirePermission" src/lib/actions/marketing-campaigns.ts` → anotar.

### T-CAMP.1 — Estender `marketing-campaigns-schemas.ts`
`CampaignsFiltersSchema` = `z.object({ q?, status?: z.nativeEnum(CampaignStatus), from?: z.string().date(), to?: z.string().date() })`.

### T-CAMP.2 — Refactor `listCampaignsAction(raw?)`

### T-CAMP.3 — Page `/marketing/campaigns`

### T-CAMP.4 — Content `campaigns-content.tsx`
FilterBar (q, status, from, to).

### T-CAMP.5 — Test
`src/lib/actions/__tests__/campaigns-filters.test.ts`.

**Commit:** `feat(fase-32): filtros URL em /marketing/campaigns (C)`.

## 4. Grupo D — Segments

### T-SEG.1 — Estender `marketing-segments-schemas.ts`
`SegmentsFiltersSchema` = `z.object({ q?, from?, to? })`.

### T-SEG.2 — Refactor `listSegmentsAction(raw?)`
### T-SEG.3 — Page
### T-SEG.4 — Content FilterBar (q, from, to)
### T-SEG.5 — Test

**Commit:** `feat(fase-32): filtros URL em /marketing/segments (D)`.

## 5. Grupo E — Workflows

### T-WF.1 — Estender `workflows-schemas.ts`
`WorkflowsFiltersSchema` = `z.object({ q?, status?: z.nativeEnum(WorkflowStatus), trigger?: z.nativeEnum(WorkflowTrigger) })`.

### T-WF.2 — Refactor `listWorkflowsAction(raw?)`
### T-WF.3 — Page
### T-WF.4 — Content `workflows-list.tsx` FilterBar (q, status, trigger)
### T-WF.5 — Test

**Commit:** `feat(fase-32): filtros URL em /automation/workflows (E)`.

## 6. Grupo F — E2E (consolidado em 1 commit)

### T-E2E.1 — products (`tests/e2e/products-filters.spec.ts`)
### T-E2E.2 — tasks (`tests/e2e/tasks-filters.spec.ts`)
### T-E2E.3 — campaigns
### T-E2E.4 — segments
### T-E2E.5 — workflows

Template por spec:
```ts
test("admin filters /products", async ({ page }) => {
  await page.goto("/products");
  await page.getByPlaceholder(/buscar/i).fill("widget");
  await expect(page).toHaveURL(/q=widget/);
  await page.getByRole("button", { name: /limpar/i }).click();
  await expect(page).toHaveURL(/\/products$/);
});
```

**Commit:** `test(fase-32): E2E specs para filtros URL em 5 módulos (F)`.

## 7. Grupo Z — Verificação + deploy

### TZ.1 — `npm run lint`
### TZ.2 — `npm run typecheck`
### TZ.3 — `npm run test` (esperar ≥681 passed; 5 novos sobre 676)
### TZ.4 — `npm run build`
### TZ.5 — `npm run test:e2e` (esperar ≥22 passed)
### TZ.6 — Push main
### TZ.7 — Monitor CI (`gh run list`)
### TZ.8 — Smoke prod
### TZ.9 — Tag `phase-32-filtros-url-5-modulos-deployed`
### TZ.10 — Atualizar HANDOFF.md §0 (G → entregue; nova Fase 32 no histórico)
### TZ.11 — Atualizar memory `filters_bulk_pattern.md` (8 módulos cobertos)
### TZ.12 — Memory `session_state_2026_04_16.md` se adequado

**Commit único Z:** `docs(fase-32): HANDOFF + memory update após deploy`.

## Dependências e paralelização

- **Rodada 1 (seq):** T0.1 + T0.2 + T0.3 (≤10min).
- **Rodada 2 (paralelo):** Grupos A, B, C em 3 subagents (≤45min).
- **Rodada 3 (paralelo):** Grupos D, E em 2 subagents (≤30min).
- **Rodada 4 (seq local):** Grupo F em 1 subagent batch (≤30min).
- **Rodada 5 (seq):** Grupo Z (≤20min).

Total estimado: **~2h30** com paralelização agressiva. Tolerância até 4h.

## Critérios de sucesso globais (verification-before-completion)

1. 5 módulos com FilterBar visível + URL-sync.
2. Back navigation restaura filtros.
3. Vitest ≥681 passed.
4. Playwright ≥22 passed.
5. `npm run build` verde.
6. CI verde em GitHub Actions.
7. Prod `/login` 200, `/api/health` 200, `/api/ready` 200 pós-deploy.
8. Tag aplicada.
9. Nenhum emoji/console.*/prazo PT-BR sem acento.
10. HANDOFF + memory atualizados.

## Total: ~42 tasks atômicas, 7 commits principais.
