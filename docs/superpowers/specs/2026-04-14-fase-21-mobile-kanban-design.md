# Fase 21 — Mobile Kanban Responsivo

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fase 17 (pipeline kanban desktop deployed)

## 1. Contexto

Pipeline kanban (Fase 17) é desktop-first: 6 colunas em grid horizontal
com scroll. Em viewport <768px, cada coluna tem min-width 280px → scroll
horizontal incômodo em mobile, e drag-and-drop é impreciso em touch.

UI-UX-Pro-Max §5 (layout mobile-first): conteúdo core primeiro, sem scroll
horizontal indesejado. §2: touch targets ≥44px. §7: animação 150-300ms.

## 2. Objetivo

Adaptar pipeline para viewport <768px (`md` breakpoint Tailwind):

- Desktop `md:` (≥768px): mantém layout atual (6 colunas, drag desktop).
- Mobile `<md` (<768px): mostra accordion vertical. Cada stage é um card
  colapsável. Abre mostrando lista compacta de cards. Drag desabilitado.
  Em vez disso, cada card tem menu dropdown "Mover para..." que atualiza
  stage via server action.

Critérios:
- Viewport 375px não causa scroll horizontal.
- Tap em coluna expande/colapsa (chevron anima).
- Mover oportunidade funciona sem drag (dropdown).
- 44px touch targets.
- Desktop intacto.

Fora de escopo:
- Drag touch real (libs que suportam bem mobile tipo dnd-kit com sensor
  Touch ainda tem UX ruim em cards pequenos; fase futura).
- Landscape específico (cobre via breakpoint).

## 3. Arquitetura

### 3.1 Responsive split

Em `pipeline-content.tsx`:

```tsx
<>
  <div className="hidden md:block">{/* desktop existente: DndContext + grid */}</div>
  <div className="md:hidden">{/* mobile accordion */}</div>
</>
```

### 3.2 Mobile Accordion

Usar `TabsRoot` do DS não cabe (só uma aba visível por vez). Melhor
accordion custom simples:

```tsx
{STAGE_ORDER.map((stage) => {
  const items = byStage[stage];
  const isOpen = openStages.has(stage);
  return (
    <div key={stage} className="border-border border rounded-xl overflow-hidden">
      <button
        onClick={() => toggle(stage)}
        className="w-full flex items-center justify-between p-4 bg-card/50 hover:bg-card/70 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full bg-${STAGE_COLORS[stage]}-500`} />
          <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
          <Badge>{items.length}</Badge>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <motion.div
        animate={{ height: isOpen ? "auto" : 0 }}
        className="overflow-hidden"
      >
        <div className="p-3 space-y-2 bg-card/20">
          {items.map((o) => <MobileKanbanCard key={o.id} opp={o} canEdit={canEdit} />)}
        </div>
      </motion.div>
    </div>
  );
})}
```

### 3.3 MobileKanbanCard

Card compacto com `DropdownMenu` "Mover" quando `canEdit`:

```tsx
<Card className="p-3 border-border bg-card/50">
  <div className="flex items-start justify-between gap-2">
    <Link href={`/opportunities/${opp.id}/activities`} className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{opp.title}</p>
      <p className="text-xs text-muted-foreground truncate">{opp.contactName ?? "sem contato"}</p>
      <p className="text-sm font-semibold text-violet-500 mt-1">{formatBRL(opp.value)}</p>
    </Link>
    {canEdit && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11 cursor-pointer">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STAGE_ORDER.filter(s => s !== opp.stage).map(s => (
            <DropdownMenuItem key={s} onClick={() => moveToStage(opp.id, s)}>
              {STAGE_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
</Card>
```

Touch target 44px (h-11 w-11). Chevron animation 200ms.

## 4. Componentes afetados

- `src/app/(protected)/opportunities/pipeline/_components/pipeline-content.tsx`
  — adicionar branch mobile.

Nenhum arquivo novo.

## 5. Testes

E2E mobile:

```ts
test("pipeline mobile 375px sem scroll horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/opportunities/pipeline");
  const scrollW = await page.evaluate(() => document.body.scrollWidth);
  const clientW = await page.evaluate(() => document.body.clientWidth);
  expect(scrollW).toBeLessThanOrEqual(clientW + 1);
});
```

## 6. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Motion animate height=auto não funciona perfeito | média | usar `overflow-hidden` + `animate-height` CSS ou não animar altura (só fade) |
| DropdownMenu "asChild" — DS usa render | baixa | verificar API DropdownMenuTrigger; ajustar se necessário |
| Accordion desktop interferir | baixa | `md:hidden` garante isolamento |

## 7. Entregáveis

1. pipeline-content com branch mobile.
2. E2E spec mobile.
3. Tag `phase-21-mobile-kanban-deployed`.
