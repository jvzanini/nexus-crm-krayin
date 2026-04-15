# Fase 24 — Filtros avançados + Bulk actions

**Data:** 2026-04-15
**Status:** spec v3
**Depends on:** Fase 15 RBAC (gating) + Fase 20 T2 (EmptyStates)

## 1. Contexto

Tabelas atuais (/leads, /contacts, /opportunities, /products, /tasks) mostram
lista completa sem filtros. Com 100+ registros, user precisa rolar muito.
Sem bulk operations, deletar 50 leads antigos requer 50 cliques individuais.

UI-UX-Pro-Max §8: empty-states (feito), forms feedback. §5 layout: content-priority
— filtros são secondary nav, não devem dominar viewport.

Blueprint: `patterns/dashboard.md` tem padrão de filter bar. Seguir.

## 2. Objetivo

Adicionar 2 funcionalidades em 3 tabelas core (leads, contacts, opportunities):

1. **Filtros por query params** (URL-shareable):
   - Leads: status (new/contacted/qualified/unqualified/converted), source (livre), data criação
   - Contacts: data criação, busca por nome/email (já tem busca, expandir para filtro persistente)
   - Opportunities: stage, value range (min/max), data

2. **Bulk actions**:
   - Checkbox por row + checkbox "select all" no header
   - Ao selecionar ≥1: barra flutuante no topo da tabela mostra "N selecionados" + botão "Excluir"
   - Bulk delete chama server action `deleteLeadsBulk(ids[])` (novo — wrapper sobre o existente com transaction).
   - RBAC: bulk delete requer `<módulo>:delete`.
   - AlertDialog confirmação antes de executar.

Critérios:
- Filtros persistidos em URL (share + back navigation).
- Filter pill mostra filtros ativos + X pra limpar.
- Bulk actions só aparecem se user tem `delete` permission.
- E2E test valida filtro + bulk delete.

Fora de escopo:
- Bulk edit (mudar status de N leads).
- Export CSV em bulk (já tem individual via relatórios).
- Saved filters (persistir filtros por user).
- Filtros em products/tasks/marketing (follow-up Fase 24b).

## 3. Arquitetura

### 3.1 Filtros (URL query params)

**Page Server Components** leem `searchParams`:

```tsx
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; from?: string; to?: string; q?: string }>;
}) {
  const params = await searchParams;
  // ...passa filters para getLeads({ status: params.status, ... })
}
```

**Action atualizado** `getLeads(filters?: LeadsFilters)` com where clause dinâmico.

**FilterBar client** em cada content:
- CustomSelect "Status: Todos" (default) com opções enum
- Input "Source:" (debounced)
- 2 date inputs (from/to)
- Botão "Limpar filtros" quando qualquer ativo
- `router.push("/leads?status=X&source=Y")` on change

### 3.2 Bulk actions

**State local** no content component:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

**Checkbox na tabela**:
```tsx
<TableRow>
  <TableCell className="w-10">
    <Checkbox
      checked={selectedIds.has(row.id)}
      onCheckedChange={(c) => toggleSelect(row.id)}
    />
  </TableCell>
  {/* rest */}
</TableRow>
```

**BulkActionBar** (novo component):
```tsx
{selectedIds.size > 0 && (
  <motion.div
    initial={{ y: -20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="sticky top-0 z-20 bg-violet-600 text-white rounded-lg px-4 py-2 flex items-center justify-between"
  >
    <span className="text-sm">{selectedIds.size} {selectedIds.size === 1 ? "selecionado" : "selecionados"}</span>
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
      <Button variant="destructive" size="sm" onClick={openBulkDelete}>
        <Trash2 className="h-4 w-4 mr-2" />
        Excluir {selectedIds.size}
      </Button>
    </div>
  </motion.div>
)}
```

**Bulk delete action**:

```ts
// src/lib/actions/leads.ts
export async function deleteLeadsBulk(ids: string[]) {
  try {
    const user = await requirePermission("leads:delete");
    const companyId = await requireActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa" };

    const deleted = await prisma.lead.deleteMany({
      where: { id: { in: ids }, companyId },
    });

    return { success: true, deletedCount: deleted.count };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
}
```

Similar para contacts, opportunities.

### 3.3 Componentes compartilhados

**`src/components/tables/bulk-action-bar.tsx`** — genérico, recebe count + handlers.

**`src/components/tables/filter-bar.tsx`** — genérico, recebe filtros definidos + callback.

## 4. Componentes afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/actions/leads.ts` | `getLeads(filters?)` + `deleteLeadsBulk(ids)` |
| `src/lib/actions/contacts.ts` | idem |
| `src/lib/actions/opportunities.ts` | idem |
| `src/app/(protected)/leads/page.tsx` | ler searchParams + passar filters |
| `src/app/(protected)/leads/_components/leads-content.tsx` | FilterBar + checkboxes + BulkActionBar |
| `src/app/(protected)/contacts/...` | idem |
| `src/app/(protected)/opportunities/...` | idem |
| `src/components/tables/bulk-action-bar.tsx` | novo |
| `src/components/tables/filter-bar.tsx` | novo |

## 5. Testes

- E2E: `golden-paths/filters-bulk.spec.ts`:
  - admin filtra leads por status=new → URL atualiza, lista filtrada
  - admin seleciona 2 leads + bulk delete → alert → confirm → 2 removidos
  - viewer: bulk delete não aparece (sem permission)

## 6. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| deleteMany sem tenant scope vaza entre tenants | baixa | `where: { id: { in: ids }, companyId }` é safe |
| Checkbox state vs filter change → seleções órfãs | média | limpar selectedIds ao mudar filter |
| URL query params não encoded em chars especiais | baixa | router.push normaliza |
| Acessibilidade: BulkActionBar não anuncia mudanças | média | `role="status" aria-live="polite"` |

## 7. Entregáveis

1. Filtros + bulk em leads/contacts/opportunities (3 módulos).
2. Componentes reutilizáveis bulk-action-bar + filter-bar.
3. Bulk delete actions server-side com RBAC + tenant scope.
4. E2E spec.
5. Tag `phase-24-filters-bulk-deployed`.
