# Fase 17 — Pipeline Kanban (Fase 2 do blueprint)

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fase 15 RBAC (opportunities:edit); Fase 13 UI consistency (PageHeader)

## 1. Contexto

`Opportunity` tem 6 stages enum: `prospecting | qualification | proposal |
negotiation | closed_won | closed_lost`. UI atual mostra lista tabular com
coluna "Stage" e badge. Usuário pede visualização kanban para gestão visual
do pipeline.

Blueprint (consultado): não há pattern canônico de Kanban em
`/nexus-blueprint/patterns/`. Seguir design system em `core/design-system.md`
+ componentes PageHeader/Card/Badge do `@nexusai360/design-system`.

## 2. Objetivo

Adicionar nova rota `/opportunities/pipeline` com kanban drag-and-drop:

- 6 colunas (uma por stage).
- Cards com título, valor R$, contato, probabilidade.
- Drag entre colunas atualiza `opportunity.stage` via Server Action.
- Header de coluna mostra count + soma de valores.
- Link do card para detalhes (`/opportunities/[id]/activities`).
- Filtros: por owner (usuário), período.
- Rota existente `/opportunities` (tabela) permanece — kanban é visão
  complementar, não substitui.

Critérios de sucesso:

- Viewer vê kanban read-only (sem drag).
- Manager/admin podem arrastar cards → persiste no DB.
- Summation/count de coluna atualiza ao mover card.
- Build + E2E passam.

Fora de escopo:

- Kanban para Leads ou Contacts.
- Stages customizáveis por tenant (apenas enum fixo).
- Mobile drag (desktop-first — mobile fallback mostra lista).
- Histórico de mudanças de stage (já tem via audit-log implícito).

## 3. Arquitetura

### 3.1 Biblioteca de drag-and-drop

Usar **`@dnd-kit/core` + `@dnd-kit/sortable`** (peer dep React 18+, já funciona
com 19). Bem-adotada, acessível (keyboard support), pequena (~12kb).

Alternativa: `react-beautiful-dnd` (descontinuada, evitar).

### 3.2 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ PageHeader: "Pipeline" + filtros + toggle lista/kanban       │
├─────────────┬─────────────┬─────────────┬─────────────┬─────┤
│ Prospecting │ Qualification│ Proposal   │ Negotiation │ Won │
│ 12 • R$ 45k │ 8 • R$ 30k  │ 5 • R$ 80k │ 3 • R$ 120k │ ... │
├─────────────┼─────────────┼─────────────┼─────────────┼─────┤
│ [Card A]    │ [Card D]    │ [Card G]    │ [Card J]    │     │
│ [Card B]    │ [Card E]    │ [Card H]    │             │     │
│ [Card C]    │ [Card F]    │ [Card I]    │             │     │
└─────────────┴─────────────┴─────────────┴─────────────┴─────┘
```

Horizontal scroll em telas pequenas; desktop cabe todas as 6 colunas.

### 3.3 Componente Card

```tsx
<Card className="border-border bg-card/50 rounded-xl p-3 cursor-grab active:cursor-grabbing">
  <div className="flex items-center justify-between">
    <h4 className="text-sm font-medium">{opp.title}</h4>
    <Badge variant="outline">{opp.probability}%</Badge>
  </div>
  <p className="text-xs text-muted-foreground mt-1">{opp.contactName}</p>
  <p className="text-sm font-semibold text-violet-500 mt-2">R$ {fmt(opp.value)}</p>
</Card>
```

### 3.4 Server Action para drag

Reaproveita `updateOpportunity({id, stage})` existente (Fase 15 já guardado
por `opportunities:edit`).

Otimistic update no client: atualizar UI antes do server response; revert
em erro.

### 3.5 Persistence

Prisma update simples. Sem history de mudanças nesta fase — audit-log já
captura implicitamente.

## 4. Componentes novos

| Componente | Path | Responsabilidade |
|---|---|---|
| `PipelinePage` | `src/app/(protected)/opportunities/pipeline/page.tsx` | Server, fetch opps + passa permissions |
| `PipelineContent` | `src/app/(protected)/opportunities/pipeline/_components/pipeline-content.tsx` | Client, orquestra dnd-kit |
| `KanbanColumn` | idem | Coluna com header + lista de cards |
| `KanbanCard` | idem | Card sortable |

Botão na sidebar: adicionar item "Pipeline" abaixo de "Oportunidades" OU
toggle dentro de `/opportunities`. **Escolha: toggle dentro de /opportunities**
para não inflar sidebar (Tabs: "Lista" | "Pipeline").

## 5. Integração com blueprint design-system

- Cores stage: mapear cada stage para um `IconTileColor`:
  - `prospecting` → zinc
  - `qualification` → blue
  - `proposal` → amber
  - `negotiation` → violet
  - `closed_won` → emerald
  - `closed_lost` → red
- Spacing: `gap-4` entre colunas, `space-y-2` entre cards (blueprint §spacing).
- Cards: seguir padrão `border-border bg-card/50 rounded-xl`.

## 6. Testes

- E2E: spec `golden-paths/pipeline.spec.ts` — admin drag card, verifica
  persistência via reload.
- Unit: reducer de stage mapping (pura).

## 7. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| dnd-kit com React 19 bugs | baixa | libs com suporte oficial; rollback via toggle |
| Performance com 500+ opps | média | virtualize colunas quando >100 cards; paginação futura |
| Drop em coluna errada por drag rápido | baixa | dnd-kit tem collisionDetection; validar onDragEnd |
| Viewer consegue drag no DOM | baixa | conditional render dos handlers; server rejeita via RBAC |

## 8. Entregáveis

1. `@dnd-kit/core` + `@dnd-kit/sortable` adicionados.
2. 4 componentes novos.
3. Toggle Lista/Pipeline em /opportunities.
4. E2E spec.
5. Tag `phase-17-pipeline-kanban-deployed`.
