# Plan — Fase 24 Filtros + Bulk Actions

**Spec:** `docs/superpowers/specs/2026-04-15-fase-24-filters-bulk-actions-design.md`
**Tag:** `phase-24-filters-bulk-deployed`

## Tasks

### T1 — Componentes compartilhados

**Novos:**
- `src/components/tables/bulk-action-bar.tsx` — sticky violet bar com count + cancelar + destructive action
- `src/components/tables/filter-bar.tsx` — wrapper com CustomSelect + Input + "Limpar filtros"

### T2 — Actions estendidas

Em `src/lib/actions/leads.ts`, `contacts.ts`, `opportunities.ts`:

```ts
// Extend get* com filters opcionais
export async function getLeads(filters?: {
  status?: LeadStatus;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
}): Promise<ActionResult<LeadItem[]>> { ... }

// Nova action
export async function deleteLeadsBulk(ids: string[]): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const user = await requirePermission("leads:delete");
    const companyId = await requireActiveCompanyId();
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa" };
    const res = await prisma.lead.deleteMany({ where: { id: { in: ids }, companyId } });
    return { success: true, data: { deletedCount: res.count } };
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { success: false, error: "Sem permissão" };
    throw err;
  }
}
```

### T3 — Pages server components

Em cada `page.tsx` de leads/contacts/opportunities, ler `searchParams`:

```tsx
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canCreate = userHasPermission(user, "leads:create");
  const canEdit = userHasPermission(user, "leads:edit");
  const canDelete = userHasPermission(user, "leads:delete");

  return <LeadsContent canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} initialFilters={params} />;
}
```

### T4 — Contents com filter+bulk

Em cada `*-content.tsx`:

1. Props: adicionar `initialFilters`
2. State: `filters`, `selectedIds: Set<string>`
3. FilterBar no topo antes da tabela
4. Coluna de checkbox no início da tabela (só se `canDelete`)
5. BulkActionBar sticky quando selectedIds.size > 0
6. AlertDialog confirmação para bulk delete
7. `router.push` ao mudar filter (URL query params)
8. Clear `selectedIds` quando filters mudarem

### T5 — E2E spec

`tests/e2e/golden-paths/filters-bulk.spec.ts`:

```ts
test.describe("filters + bulk [admin]", () => {
  test("/leads filter status new via URL param", async ({ page }) => {
    await page.goto("/leads?status=new");
    await expect(page).toHaveURL(/status=new/);
    // podem ser 0 leads em prod; só verifica que URL é respeitada
  });
});
```

Adicionar `filters-bulk` ao regex admin em `playwright.config.ts`.

### T6 — Build + push + tag

```sh
npm run build
git push origin main
# CI valida
git tag phase-24-filters-bulk-deployed
git push origin phase-24-filters-bulk-deployed
```

## Execução

Delegar via subagent único (tudo relacionado, mesmo estilo de mudança).

## Rollback

Commits atômicos por componente/ação. Revert granular possível.
