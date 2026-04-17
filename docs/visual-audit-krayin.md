# Visual Audit — Krayin Original → krayin-next (Fase 34 Parte A)

**Data:** 2026-04-17
**Referência visual:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm` — Laravel/Krayin original, pacote `packages/Webkul/Admin/src/Resources/views`.
**Destino:** `https://crm2.nexusai360.com` (Next.js port do CRM).
**Fonte dos patterns:** `@nexusai360/patterns@0.2.0` (publicado GHCR + vendor-packages).

---

## 1. Rotas auditadas

| Rota | Krayin original (estrutura) | krayin-next pós-F34 | Diffs aceitos | Ação |
|---|---|---|---|---|
| `/dashboard` | Header title 2xl + filters 2 datepickers + grid main flex-1 (Revenue/OverAll/TotalLeads/TopProducts/TopPersons) + side 378px (OpenLeadsByStates/RevenueBySources/RevenueByTypes) | Header Greeting+NotificationBell + DashboardFilters + StatsCards + Pipeline chart + `CrmDashboardGrid` (main: FunnelCard+PipelineValueCard+TopOpps; side: TasksTodayCard+UpcomingMeetingsCard+QuickActionsCard) + RecentActivity | Widgets Krayin original (Revenue/OverAll/TopProducts/TopPersons/OpenLeadsByStates/RevenueBySources/RevenueByTypes) **não portados 1:1** (standby follow-up). Nexus mantém próprios widgets analíticos. Greeting + StatsCards + Pipeline chart + RecentActivity preservados. | OK |
| `/leads` | Header card `rounded-lg border bg-white` com breadcrumbs + título `text-xl font-bold` + export/create buttons; content kanban (default) ou table via `?view_type=table` | `CrmListShell` wrapper: header card `rounded-lg border bg-card px-4 py-3` com breadcrumbs (Dashboard→Leads) + title "Leads" + description (contagem live) + action "Novo lead" violet. Content: FilterBar + DataTable + BulkActionBar preservados. | Kanban default ausente (standby Opção L — kanban de leads requer drag + server action de move; fora F34). Só tabela. | OK |
| `/contacts` | Similar leads | `CrmListShell` similar: title "Contatos", description live, action "Novo contato" emerald, breadcrumbs Dashboard→Contatos. Content preservado. | Similar leads | OK |
| `/opportunities` | Similar leads | `CrmListShell`: title "Oportunidades", description live, actions Pipeline link + "Nova oportunidade" violet, breadcrumbs Dashboard→Oportunidades. Content preservado. | Similar leads | OK |
| `/opportunities/pipeline` | Kanban Krayin-style (não mexe nesta fase; Nexus tem kanban próprio Fase 17 dnd-kit desktop + Fase 21 mobile accordion) | `CrmListShell` wrapper: title "Pipeline", description "Visualização kanban das oportunidades por stage", actions "Lista" link, breadcrumbs Dashboard→Oportunidades→Pipeline. Kanban dnd-kit + accordion mobile preservados 100%. | OK | OK |

## 2. Token parity (vs `packages/design-system`)

Patterns novos usam **exclusivamente** tokens semânticos do DS (sem `gray-*` ou `bg-white` hardcoded):

| Token | Valor resolvido | Uso em patterns F34 |
|---|---|---|
| `--primary` | `#6d28d9` (light) / `#7c3aed` (dark) | **MANTIDO violeta Nexus** — não migra pro azul Krayin (`#0E90D9`); decisão spec v3 §3.5. Focus ring, skip link bg. |
| `--background` | Paleta atual preservada | `CrmShell` root bg, CrmShell.Main bg |
| `--card` | Paleta atual preservada | Sidebar, Header, CrmListShell header card, CrmDetailShell left panel, CrmDashboardGrid cards |
| `--border` | Paleta atual preservada | Todos os borders `border-border` |
| `--foreground` | Paleta atual preservada | Títulos `text-foreground` (substituiu `text-zinc-50` do PageHeader) |
| `--muted-foreground` | Paleta atual preservada | Descrições `text-muted-foreground` (substituiu `text-zinc-400`) |

**Grep enforcement (commit `3a928aa`):** zero match `gray-[0-9]` e `bg-white` em `packages/patterns/src/{crm-shell,crm-list-shell,crm-detail-shell,crm-dashboard-grid}/`.

## 3. Preservação obrigatória (Fases 13/17/18/20/22/24/25/26–32/33)

| Fase | Feature | Status pós-F34 |
|---|---|---|
| 13 | PageHeader em 9 telas | Substituído por `CrmListShell` (compõe `PageHeader` de patterns). IconTile violet ficou fora (follow-up) — trade-off aceito. |
| 17 | Kanban Pipeline dnd-kit | Preservado dentro de `CrmListShell` wrapper. Drag+drop intacto. |
| 18 | Dashboard Funnel/PipelineValue/TopOpps | Preservados no main do `CrmDashboardGrid`. |
| 20 | EmptyState em 9 telas | Preservado — `CrmListShell` é wrapper externo, não toca children. |
| 22 | Loading skeletons `loading.tsx` | Preservado. |
| 24 | URL filters + Bulk Actions | Preservado — `FilterBar` + `BulkActionBar` ficam como children. |
| 25 | CommandPalette Ctrl+K | Preservado (continua via `(protected)/layout.tsx` Sidebar legado). |
| 26-32 | Bulk delete/edit/assign/status | Preservados em todos os módulos. |
| 33 | Saved filters | Preservados — FilterBar continua usa o pattern de saved filters. |

## 4. Discrepâncias aceitas vs Krayin original

1. **Brand violeta Nexus (`#6d28d9`/`#7c3aed`) mantida** em vez de azul Krayin (`#0E90D9`). LEI `law_design_system_source` — Blueprint é fonte única.
2. **Widgets dashboard Krayin (Revenue/OverAll/TotalLeads/TopProducts/TopPersons/OpenLeadsByStates/RevenueBySources/RevenueByTypes) não portados.** Widgets Nexus (Funnel/PipelineValue/TopOpps + 3 side novos) ficam. Port 1:1 = follow-up.
3. **Kanban de leads não implementado.** Só `/opportunities/pipeline` tem kanban. Standby "Opção L" HANDOFF.
4. **Shell admin** (sidebar 260px fixa lateral, colapso 85px em mobile drawer) — `CrmShell` pattern está **disponível** em `@nexusai360/patterns` mas **não aplicado** no `(protected)/layout.tsx` do krayin ainda. Layout atual ainda usa Sidebar legado (220L). Wire-up do CrmShell em prod fica para Fase 34 Parte B.

## 5. Bundle impact

- `@nexusai360/patterns@0.2.0` adiciona ~18KB gz (dist/index.cjs 20KB + dist/index.js 16KB). Budget: 60KB gz total. Restante: ~40KB gz folga.
- Consumer krayin importa via subpath `import { CrmListShell } from "@nexusai360/patterns"` — tree-shaken (sideEffects: false).
- Build Next 16 `✓ Compiled successfully in 5.4s` com 4 rotas envelopadas + dashboard envelopado.

## 6. Follow-ups

- Fase 34 Parte B: wire-up `CrmShell` no `(protected)/layout.tsx` substituindo Sidebar legado (220L). Requer factories `buildSidebarSlots`/`buildTopbarSlots` extraídas + preservation-smoke.spec.ts validando cada feature preservada (theme cycler, search Ctrl+K, user info, nav stagger 0.08).
- Port widgets dashboard Krayin original (opt-in): Revenue/OverAll/TotalLeads/TopProducts/TopPersons.
- Kanban de leads (Opção L): drag + server action de move.
- E2E novos: `visual-parity.spec.ts`, `theme-cycler.spec.ts`, `preservation-smoke.spec.ts` em `tests/e2e/golden-paths/`.
- IconTile violet Target/Users/TrendingUp/LayoutGrid nos headers de lista — adicionar slot `icon?` no `CrmListShell` pattern.

---

**Status:** ✅ Fase 34 Parte A deployed (`phase-34-deployed` tag). Parte B gated por risco alto do refactor do Sidebar legado.
