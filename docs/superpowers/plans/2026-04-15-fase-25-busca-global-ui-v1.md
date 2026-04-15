# Plan v1 — Fase 25: Busca Global UI

**Status:** v1 (sujeito a review #1)
**Spec:** `docs/superpowers/specs/2026-04-15-fase-25-busca-global-ui-v3.md`
**Granularidade:** tasks atômicas, uma responsabilidade cada.

## Tasks

### T1 — Criar helper compartilhado `normalize`
- Arquivo: `src/lib/search/normalize.ts` (novo).
- Exporta `normalize(str: string): string`.
- Test: `src/lib/search/normalize.test.ts`.
- Commit: `feat(search): helper normalize compartilhado`.

### T2 — Criar helpers de scoring/ranking
- Arquivo: `src/lib/search/scoring.ts` (novo).
- Exporta `scoreMatch` + `rankItems`.
- Test: `src/lib/search/scoring.test.ts` (exact/startsWith/contains, diacritic, sort + tiebreak).
- Commit: `feat(search): scoring e ranking server-side`.

### T3 — Criar `recent.ts` (localStorage + TTL)
- Arquivo: `src/lib/search/recent.ts` (novo).
- Exporta `getRecents`, `addRecent`, `clearRecents`, tipo `RecentEntry`.
- Test: `src/lib/search/recent.test.ts` (add dedupe, TTL drop, limite 5, SSR no-op, JSON corrompido).
- Commit: `feat(search): recents localStorage com TTL`.

### T4 — Criar `HighlightMatch`
- Arquivo: `src/components/layout/highlight-match.tsx` (novo).
- Componente puro, usa `normalize`.
- Test: `src/components/layout/highlight-match.test.tsx` (jsdom).
- Commit: `feat(search): HighlightMatch component`.

### T5 — Atualizar `constants/search.ts`
- Editar `src/lib/constants/search.ts`.
- Adicionar entities: products/tasks/workflows/campaigns/segments.
- Exportar `SEARCH_ENTITY_LABELS` + `SEARCH_ENTITY_ORDER`.
- Commit: `feat(search): constants com novas entidades`.

### T6 — Refatorar `/api/search` com scoring + novas entidades
- Editar `src/app/api/search/route.ts`.
- Adicionar RBAC gating (hasPermission batch).
- Adicionar queries Product/Activity/Workflow/Campaign/Segment.
- Aplicar `rankItems` antes de mapear.
- Implementar `hrefFor` + `subjectPluralPath`.
- Deep-link leads/contacts/opportunities.
- Commit: `feat(search): API /api/search com scoring + 5 novas entidades + deep-link`.

### T7 — Alinhar Server Action `search()` com novo shape
- Editar `src/lib/actions/search.ts` (ou marcar deprecated se não chamado).
- Grep callers; se não houver, remover.
- Commit: `chore(search): deprecar Server Action em favor da API route`.

### T8 — Integrar recents + highlight + novos grupos no `CommandPalette`
- Editar `src/components/layout/command-palette.tsx`.
- Importar helpers + `HighlightMatch`.
- Estados novos: `recents`, `error`.
- Render recents quando query < 2 + recents.length > 0.
- Render erro inline.
- Renomear `ICON_MAP` incluindo novos ícones.
- `aria-live` + `aria-label`.
- Commit: `feat(search): integração recents/highlight/erro/a11y no CommandPalette`.

### T9 — Testes unit
- Executar `npm test` e garantir todas suites verdes.
- Commit: `test(search): unit scoring/normalize/recents/highlight`.

### T10 — E2E spec admin
- Criar `tests/e2e/specs/global-search.spec.ts`.
- Rodar local com `npm run test:e2e`.
- Commit: `test(e2e): global search admin spec`.

### T11 — Atualizar HANDOFF + memory
- Editar `docs/HANDOFF.md` com Fase 25 ✅.
- Criar memory `global_search_pattern.md` e atualizar MEMORY.md.
- Commit: `docs(handoff+memory): Fase 25 deployed`.

### T12 — Build + lint + audit
- `npm run build`, `npm run lint`, `npm audit --audit-level=low`.
- Corrigir erros.

### T13 — Push + CI + smoke prod + tag
- `git push origin main`.
- Monitorar GitHub Actions.
- Smoke: `/api/health`, `/login`.
- Aplicar tag `phase-25-global-search-deployed`.
