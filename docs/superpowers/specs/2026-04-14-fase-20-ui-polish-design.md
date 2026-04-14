# Fase 20 — UI Polish (Mobile, Empty States, Loading)

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fase 17 (kanban deployed), Fase 18 (dashboard funnel)

## 1. Contexto

Auditoria UI (Fase 13) cobriu PageHeader + stagger + spacing. Ficaram
pendentes:

- **Mobile responsiveness** — kanban é desktop-first, dashboard pode quebrar
  em viewport <768px.
- **Empty states** — telas com 0 registros mostram tabela vazia em vez de
  CTA amigável "Nenhum lead ainda".
- **Loading states** — alguns fetchs mostram blank em vez de skeleton.
- **Dark mode parity** — alguns bg-card/50 têm contraste diferente em light
  vs dark.

Blueprint (`core/design-system.md` + rules UX do ui-ux-pro-max §3 performance,
§5 layout): layout mobile-first, progressive-loading com skeletons,
empty-states com ação.

## 2. Objetivo

Polish UX final nas telas principais:

1. **Pipeline Kanban mobile** — viewport <768px mostra lista ordenada por
   stage (colunas vão para cima como cards colapsáveis OU swipe horizontal
   com scroll-snap).
2. **Empty states** — usar `EmptyState` do DS em telas de CRUD quando 0 items
   (leads, contacts, opportunities, products, tasks, campaigns, segments,
   workflows).
3. **Skeleton padrão** — tables/grids em loading mostram `TableSkeleton` ou
   `Skeleton` do DS (já disponível no vendor).
4. **Mobile test-suite básico** — 1 spec Playwright que carrega dashboard
   em 375px e valida nenhum overflow horizontal.

Critérios de sucesso:

- Kanban em 375px renderiza sem scroll horizontal indesejado.
- Todas as 9 telas de lista têm empty state com CTA.
- Skeleton aparece durante fetches >300ms.
- Test `golden-paths/mobile.spec.ts` passa.

Fora de escopo:

- Mobile drag-and-drop (técnica complexa; desktop-first fica MVP).
- Refactor grandes de layout.
- Internacionalização.

## 3. Arquitetura

### 3.1 Pipeline Kanban mobile

Breakpoint `md` (768px):

- `hidden md:flex` no container horizontal desktop.
- `md:hidden` wrap em accordion de stages (shadcn Accordion). Cada stage
  abre mostrando lista de cards compactos.
- Drag desabilitado em mobile (só reorder por tap + picker).

### 3.2 Empty States

DS tem `<EmptyState.Root>` com sub-components (Icon, Title, Description,
Action). Padrão:

```tsx
{items.length === 0 ? (
  <EmptyState.Root>
    <EmptyState.Icon icon={Target} />
    <EmptyState.Title>Nenhum lead ainda</EmptyState.Title>
    <EmptyState.Description>
      Adicione leads para começar a gerenciar sua pipeline de vendas.
    </EmptyState.Description>
    {canCreate && (
      <EmptyState.Action>
        <Button onClick={handleNew}>Novo lead</Button>
      </EmptyState.Action>
    )}
  </EmptyState.Root>
) : (
  <Table>...</Table>
)}
```

Aplicar em: leads, contacts, opportunities, products, tasks, campaigns,
segments, workflows, mailboxes.

### 3.3 Skeletons

`<TableSkeleton rows={10} columns={5} />` durante loading transitions.
Dashboard pode reusar Skeleton para stats cards (já tem parcial).

### 3.4 Mobile smoke test

```ts
test("dashboard 375px sem overflow horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/dashboard");
  const body = page.locator("body");
  const scrollWidth = await body.evaluate((el) => el.scrollWidth);
  const clientWidth = await body.evaluate((el) => el.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
```

## 4. Entregáveis

1. Pipeline mobile responsive.
2. 9 telas com EmptyState padronizado.
3. Skeletons em 3-4 telas chave (dashboard, leads, opportunities, pipeline).
4. E2E mobile spec.
5. Tag `phase-20-ui-polish-deployed`.

## 5. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| EmptyState do DS não suportar ícone | baixa | fallback inline div |
| Mobile kanban accordion perder valor UX | média | MVP mostra lista compacta, accordion em Fase 21 |
| Skeletons piscarem em fetches rápidos | baixa | delay 300ms antes de mostrar skeleton |
