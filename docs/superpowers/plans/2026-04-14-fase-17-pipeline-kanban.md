# Plan — Fase 17 Pipeline Kanban

**Spec:** `docs/superpowers/specs/2026-04-14-fase-17-pipeline-kanban-design.md`
**Branch:** `main`
**Tag final:** `phase-17-pipeline-kanban-deployed`

## Tasks

### T1 — Dependências

```sh
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Commit: `chore(deps): @dnd-kit para pipeline kanban`.

### T2 — Stage config module

**Arquivo novo:** `src/lib/opportunities/stage-config.ts`

```ts
import type { OpportunityStage } from "@/generated/prisma/client";
import type { IconTileColor } from "@nexusai360/design-system";

export const STAGE_ORDER: readonly OpportunityStage[] = [
  "prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost",
];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: "Prospecção",
  qualification: "Qualificação",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

export const STAGE_COLORS: Record<OpportunityStage, IconTileColor> = {
  prospecting: "zinc",
  qualification: "blue",
  proposal: "amber",
  negotiation: "violet",
  closed_won: "emerald",
  closed_lost: "red",
};
```

Commit: `feat(opps): stage-config com labels e cores`.

### T3 — PipelineContent (client)

**Arquivo novo:** `src/app/(protected)/opportunities/pipeline/_components/pipeline-content.tsx`

Componente client com:
- `DndContext` do `@dnd-kit/core`
- 6 colunas via `STAGE_ORDER.map`
- Cada coluna usa `SortableContext` + cards filtrados por stage
- `onDragEnd` chama `updateOpportunityStage(id, newStage)` action
- Optimistic UI via local state

Paginação inicial: todos opps da empresa em memória (adequado até ~500).

### T4 — Pipeline page (server)

**Arquivo novo:** `src/app/(protected)/opportunities/pipeline/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { getOpportunities } from "@/lib/actions/opportunities";
import { PipelineContent } from "./_components/pipeline-content";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canEdit = userHasPermission(user, "opportunities:edit");
  const result = await getOpportunities();

  if (!result.success) {
    return <div>Erro ao carregar oportunidades</div>;
  }

  return <PipelineContent opportunities={result.data} canEdit={canEdit} />;
}
```

### T5 — Navegação Lista ↔ Pipeline

Em `src/app/(protected)/opportunities/_components/opportunities-content.tsx`:

Adicionar no `PageHeader.Actions` (antes do botão "Nova Oportunidade"):

```tsx
<Link href="/opportunities/pipeline">
  <Button variant="outline">
    <LayoutGrid className="h-4 w-4 mr-2" />
    Pipeline
  </Button>
</Link>
```

Em `pipeline-content.tsx` PageHeader:

```tsx
<Link href="/opportunities">
  <Button variant="outline">
    <TableIcon className="h-4 w-4 mr-2" />
    Lista
  </Button>
</Link>
```

### T6 — E2E spec

**Arquivo novo:** `tests/e2e/golden-paths/pipeline.spec.ts`

Tests:
- admin navega /opportunities → clica "Pipeline" → url /opportunities/pipeline
- admin drag card do col A para col B (usar `page.dragAndDrop`) → reload → card continua em col B
- viewer em /pipeline não consegue drag (cursor pointer não grab)

### T7 — Build + push + tag

```sh
npm run build
git push origin main
# aguardar CI
git tag phase-17-pipeline-kanban-deployed
git push origin phase-17-pipeline-kanban-deployed
```

## Rollback

Commits atômicos T1-T6. Se dnd-kit quebrar, revert T3+T4 mantém route mas
com link-back simples para lista.

## Riscos na execução

- dnd-kit + React 19: usar versão mais nova disponível (`@dnd-kit/core@6.3+`).
- Server Action `updateOpportunity` aceita `stage` como payload? Verificar
  schema Zod e adicionar se não.
