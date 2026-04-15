# Fase 22 — Loading Skeletons Padronizados

**Data:** 2026-04-15
**Status:** spec v3
**Depends on:** Fase 20 T2 (empty states), Fase 21 (mobile kanban)

## 1. Contexto

Telas atuais usam Server Components com `await` — não há loading state
visível para o usuário durante a requisição. Em conexões lentas ou
quando o servidor demora >300ms, user vê branco antes do render.

UI-UX-Pro-Max §3 performance: `progressive-loading` — skeleton screens
em vez de spinner blocking para operações >1s. `content-jumping` —
reservar espaço para evitar layout shift.

DS já expõe `Skeleton` e `TableSkeleton`. Next.js suporta `loading.tsx`
file convention para Server Components.

## 2. Objetivo

Adicionar `loading.tsx` em rotas críticas que fazem DB queries grandes:

1. `/dashboard` → skeleton de stats cards + chart + funnel cards.
2. `/leads`, `/contacts`, `/opportunities` → `TableSkeleton rows={10}`.
3. `/opportunities/pipeline` → 6 colunas skeleton.
4. `/products`, `/marketing/campaigns`, `/marketing/segments` → table skeleton.

Critérios:
- Loading skeleton aparece durante fetch.
- Sem flash branco perceptível.
- Layout match final render (no layout shift).

Fora de escopo:
- Skeleton em dialogs/modals (já rápidos).
- Skeleton em cada componente pequeno.

## 3. Arquitetura

Next App Router auto-renderiza `loading.tsx` no segmento durante Suspense
boundary (Server Components). Nenhuma mudança no page.tsx.

Exemplo `src/app/(protected)/leads/loading.tsx`:

```tsx
import { TableSkeleton, PageHeader } from "@nexusai360/design-system";
import { Target } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader.Root>
        <PageHeader.Row>
          <PageHeader.Icon icon={Target} color="violet" />
          <PageHeader.Heading>
            <PageHeader.Title>Leads</PageHeader.Title>
            <PageHeader.Description>Carregando…</PageHeader.Description>
          </PageHeader.Heading>
        </PageHeader.Row>
      </PageHeader.Root>
      <TableSkeleton rows={10} columns={5} />
    </div>
  );
}
```

Dashboard skeleton mais elaborado com Skeleton do DS:

```tsx
<Skeleton className="h-24" />  // stats card
<Skeleton className="h-72" />  // chart
<Skeleton className="h-64" />  // funnel card
```

## 4. Arquivos novos

| Rota | Arquivo | Skeleton tipo |
|---|---|---|
| /dashboard | `src/app/(protected)/dashboard/loading.tsx` | Grid 4 stats + chart + 3 funnel cards |
| /leads | `src/app/(protected)/leads/loading.tsx` | TableSkeleton 10×5 |
| /contacts | `src/app/(protected)/contacts/loading.tsx` | idem |
| /opportunities | `src/app/(protected)/opportunities/loading.tsx` | idem |
| /opportunities/pipeline | `.../pipeline/loading.tsx` | 6 colunas × 3 cards |
| /products | `.../products/loading.tsx` | TableSkeleton 10×6 |
| /marketing/campaigns | `.../campaigns/loading.tsx` | TableSkeleton 10×4 |
| /marketing/segments | `.../segments/loading.tsx` | TableSkeleton 10×4 |
| /tasks | `.../tasks/loading.tsx` | TableSkeleton 10×5 |

9 arquivos novos.

## 5. Testes

- E2E: add delay artificial OU ver via browser devtools network throttle.
- Visual: confirmar que não há "flash" branco.

## 6. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| TableSkeleton do DS não aceitar rows/columns | baixa | fallback div grid com Skeleton |
| Skeleton não match layout → layout shift | média | testar manual cada tela |

## 7. Entregáveis

1. 9 arquivos `loading.tsx`.
2. Commit único.
3. Tag `phase-22-loading-skeletons-deployed`.
