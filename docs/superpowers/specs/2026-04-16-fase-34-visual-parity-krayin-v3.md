# Fase 34 — Visual Parity com Krayin Original (Parte A) — v3 FINAL

**Data:** 2026-04-16
**Versão:** v3 (definitiva) — incorpora Review #2 (pente fino: 5 bugs críticos, 7 ambiguidades, 5 inconsistências, 12 refinamentos textuais + 4 micro-decisões gating)
**Status:** pronta para writing-plans
**Fonte de verdade visual:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm` (Laravel/Krayin — pacote `Webkul/Admin`).
**Destino:** páginas existentes do `nexus-crm-krayin` + extensão additive de patterns no `nexus-blueprint`.
**Escopo Fase A:** shell admin + 5 rotas (dashboard, leads, contacts, opportunities, pipeline).
**Fase B (35):** 8 módulos restantes.

---

## 1. Contexto

CRM em produção (`crm2.nexusai360.com`) — Fase 33 entregue, 706/706 verde — tem shell visual divergente da referência Krayin (`crm.nexusai360.com`, pacote Laravel `packages/Webkul/Admin`). Usuário pediu skin alinhada (densidade compacta, sidebar colapsável 85px, topbar 62px, card-based header, two-column detail sticky). Toda lógica (Prisma, auth, Server Actions, RBAC, tenant scope) fica intacta.

**Decisão arquitetural (reforçada no Review #1):** não criar 4º shell concorrente com os 3 existentes (`AppShell` DS, `PageShell` patterns, `sidebar.tsx` krayin). Em vez disso:
1. **Estende `PageShell`** additive com props opcionais + tokens semânticos.
2. **`CrmShell`** novo — composição sobre `AppShell` DS com defaults Krayin.
3. **`CrmListShell`** — consome `PageHeader` existente internamente.
4. **`CrmDetailShell`** novo — two-column sticky (sem concorrente).
5. **`CrmDashboardGrid`** novo — main + side (sem concorrente).

**LEIs aplicáveis (todas):**
- LEI #4 krayin — consultar blueprint (✅ feito; decisão é estender).
- Regra 10 blueprint — graphify update pós-fase.
- Regra 11 blueprint — `pnpm visual:snap` antes/depois.
- Regra 12 blueprint — modularização extrema.
- `design_system_versioning` — additive = minor bump.
- `design_system_bundle_budget` — ≤60KB gz total; ≤15KB gz por subpath.
- `design_system_manual_visual_source` — validar contra `docs/manual-visual.html` (procedimento §6.2).
- `law_ui_uxpromax_blueprint` — invocar skill `ui-ux-pro-max` antes de cada pattern novo (gate no plan).
- `law_roteador_is_ui_matrix` — validar CrmShell em `/__ds-preview` do roteador-webhook (cross-check §5.6).
- `law_design_system_source` — Blueprint é fonte única; brand violeta Nexus.

## 2. Motivação (não-negociável)

- Shell CRM unificado num pattern versionado → mudar sidebar/topbar = 1 edit, propaga pros consumidores.
- Páginas do CRM compõem patterns; não reinventam layout.
- Alinhamento estrutural com Krayin aumenta reconhecibilidade.
- **Brand violeta Nexus (`--primary` #6d28d9 / #7c3aed) mantida**; azul Krayin (`#0E90D9`) é default do pacote open-source, não identidade Nexus. Decisão definitiva §3.5.

## 3. Fonte de verdade visual

### 3.1. Shell (layout principal)
`packages/Webkul/Admin/src/Resources/views/components/layouts/index.blade.php`.

- Fonte Inter; topbar 62px fixa; sidebar 85px collapsed / ~260px expanded; transição 300ms.
- Main bg: `gray-100` light / `gray-950` dark na ref. Nexus mapeia para `bg-muted/30` light / `bg-background` dark (tokens semânticos — ver §3.5 I3).
- Padding content: `px-4 pb-6 pl-[85px]` (offset sidebar colapsada).

### 3.2. Dashboard
`packages/Webkul/Admin/src/Resources/views/dashboard/index.blade.php`.

Header `flex justify-between mb-5`: título `text-2xl font-semibold`, filtros 2 date pickers 140px.
Grid: left `flex-1 flex-col gap-4`, right `w-[378px] flex-col gap-4`. Mobile `max-xl:flex-wrap`.

### 3.3. Lead Index
`packages/Webkul/Admin/src/Resources/views/leads/index.blade.php`.

Header card `flex justify-between rounded-lg border bg-white px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-900`. Left: breadcrumbs + título `text-xl font-bold`. Right: ações.
Content: view switcher `?view_type=table|kanban` — **kanban leads fora da Fase 34** (§5.4 final).

### 3.4. Lead View (detail)
`packages/Webkul/Admin/src/Resources/views/leads/view.blade.php`.

Two-column:
- **Left sticky 394px** `rounded-lg border bg-white`: info (breadcrumbs+tags+title+actions) → attributes → person.
- **Right flex** `flex-1 flex-col gap-4`: stages pill → activities tabs (All/Description/Products/Quotes).
Mobile `max-lg:flex-wrap`.

### 3.5. Tokens + decisão brand color (H4 final)

| Característica Krayin | Classe cru | Equivalente Nexus (tokens semânticos) |
|---|---|---|
| Card bg | `bg-white dark:bg-gray-900` | `bg-card` |
| Card border | `border-gray-200 dark:border-gray-800` | `border-border` |
| Main bg | `bg-gray-100 dark:bg-gray-950` | `bg-muted/30` light / `bg-background` dark |
| Text muted | `text-gray-600 dark:text-gray-300` | `text-muted-foreground` |
| Radius card | `rounded-lg` | `rounded-lg` |
| Radius input/btn | `rounded-md` | `rounded-md` |
| Gap padrão | `gap-4` | `gap-4` |
| Densidade | `text-sm`, `py-2`, `min-h-[39px]` | idem |
| **Brand primary** | `#0E90D9` Krayin | **`--primary` violeta Nexus (#6d28d9/#7c3aed) — MANTIDO** |

**Disclaimer (I2):** a tabela é *mapping documentacional*. O código dos patterns novos tem **zero match** para `gray-\d+` (success criteria §10.10 grep enforcement).

**Decisão brand (H4):** violeta Nexus final. Fundamentos:
1. CLAUDE.md krayin §251 fixa `#6d28d9/#7c3aed`.
2. LEI `law_design_system_source` — Blueprint fonte única.
3. "Parecido com referência" = estrutura/densidade, não marca.
4. Sidebar atual já tem glow violeta; trocar vira frankenstein.

**Paleta preservada (I3):** tokens semânticos (`bg-background`, `bg-card`, `border-border`) resolvem para valores atuais da paleta dark. Zero mudança percebida em consumidores existentes. Provado via visual regression `maxDiffPixelRatio ≤ 0.02` nas rotas não-alvo.

## 4. Escopo (in/out)

### IN — Fase 34 (A)

**Blueprint (additive):**
- Extensão `PageShell`: props additive `topbar?`, `collapsedSidebarWidth?` (default 85), `sidebarCollapsed?`, tokens semânticos (`bg-background`/`bg-card`/`border-border` em vez de `zinc-950` hardcoded). Defaults reproduzem comportamento atual (backwards-compat provado por teste); consumidores existentes não precisam mudar código.
- Pattern `CrmShell` — composição sobre `AppShell` DS. API §5.1.
- Pattern `CrmListShell` — consome `PageHeader`. API §5.1.
- Pattern `CrmDetailShell` — two-column sticky. API §5.1.
- Pattern `CrmDashboardGrid` — main + side 378px. API §5.1.
- **Atualização `PageHeader`:** trocar `text-zinc-50`/`text-zinc-400` hardcoded por tokens (`text-foreground`/`text-muted-foreground`). Additive (mesmos valores resolvidos). Necessário pra `CrmListShell` herdar dark mode.
- **`packages/patterns/package.json`:** adicionar `"sideEffects": false` (B4 review; garante tree-shaking).
- **`"use client"`** apenas em `crm-shell.tsx` (tem estado/motion); outros patterns são server-safe.

**nexus-crm-krayin (5 rotas):**
- `src/app/(protected)/layout.tsx` — (criar se não existir) consome `CrmShell` com slots montados via `src/components/layout/shell-slots.tsx` (novo).
- `src/components/layout/shell-slots.tsx` — exporta `buildSidebarSlots(user)` + `buildTopbarSlots()`; retorna **nós inertes** (logo, search, nav, user menu, theme cycler, footer, breadcrumbs, notifications, actions). Motion do drawer mora no `CrmShell` (decisão A2).
- `/dashboard` (via `DashboardContent`) — compõe `CrmDashboardGrid`. **Main:** `FunnelCard` + `PipelineValueCard` + `TopOpportunitiesCard` (existentes, preservados). **Side:** 3 widgets canônicos (decisão A1):
  1. `TasksTodayCard` (novo, read-only; lista top 5 activities com `dueAt <= hoje` + filter by assignedTo=user; RBAC `activities:view`).
  2. `RecentActivitiesCard` (novo, read-only; últimas 5 activities criadas na company).
  3. `QuickActionsCard` (novo; botões "Criar lead", "Criar contato", "Criar oportunidade" gated por RBAC).
  Todos Server Components, dados via actions existentes + Prisma. **Zero mudança de Prisma schema.**
- `/leads` — `CrmListShell` envelopando `FilterBar`+`BulkActionBar`+`DataTable` (preservados).
- `/contacts` — `CrmListShell` envelopando estrutura atual.
- `/opportunities` — `CrmListShell` envelopando estrutura atual.
- `/opportunities/pipeline` — `CrmListShell` envelopando kanban dnd-kit (preservado Fases 17/21).

**Tokens:** não adicionar `--brand-color`. `CrmShell` expõe CSS vars `--sidebar-expanded-width` (default 260px), `--sidebar-collapsed-width` (default 85px), `--topbar-height` (default 62px) — consumidas internamente por `CrmDetailShell` para `top-[calc(var(--topbar-height,62px)+0.75rem)]` (B2 review).

**Audit + visual regression:**
- `nexus-crm-krayin/docs/visual-audit-krayin.md` — 5 rotas × tabela. Procedimento manual-visual §6.2.
- Baseline `pnpm visual:snap` pré-fase; pós cada tela.
- Rotas alvo: antes/depois anexado no PR; mudanças documentadas na descrição.
- Rotas não-alvo: `maxDiffPixelRatio ≤ 0.02` (falha se ultrapassar).

### OUT — Fase 35 (B) ou follow-ups

- 8 módulos restantes (Fase 35: companies, products, tasks, reports, settings, campaigns, segments, workflows).
- Kanban novo de leads (standby "Opção L" HANDOFF).
- Port 1:1 de widgets Krayin original.
- Não mexer em Prisma/Server Actions/RBAC/auth/tenant scope.
- Não mudança de paleta dark mode.
- Não port de emails templates.
- Não usar `dembrandt`.
- Não suportar RTL (fora).

## 5. Arquitetura das mudanças

### 5.1. `nexus-blueprint` — API explícita dos patterns

**`PageShell` extension (additive):**
```tsx
interface PageShellProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  topbar?: React.ReactNode;                // novo
  children: React.ReactNode;
  sidebarWidth?: number;                   // default 280 (inalterado)
  collapsedSidebarWidth?: number;          // novo, default 85
  sidebarCollapsed?: boolean;
}
```
Tokens: `bg-background` (main) / `bg-card` (sidebar/header) / `border-border` em vez de `zinc-950` hardcoded.

**`CrmShell` (novo):**
```tsx
interface CrmShellSidebarSlots {
  logo: React.ReactNode;
  search?: React.ReactNode;
  nav: React.ReactNode;
  themeCycler?: React.ReactNode;
  userMenu: React.ReactNode;               // renomeado de `user` (v2 review sugestão M8)
  footer?: React.ReactNode;
}
interface CrmShellTopbarSlots {
  breadcrumbs?: React.ReactNode;
  notifications?: React.ReactNode;
  actions?: React.ReactNode;
}
interface CrmShellProps {
  sidebar: CrmShellSidebarSlots;
  topbar?: CrmShellTopbarSlots;            // opcional; §5.1.1 comportamento
  labels?: {
    skipLink?: string;                     // default "Pular para o conteúdo"
    expandSidebar?: string;                // default "Expandir menu"
    collapseSidebar?: string;              // default "Recolher menu"
    openMobileMenu?: string;               // default "Abrir menu"
    closeMobileMenu?: string;              // default "Fechar menu"
  };
  children: React.ReactNode;
}
```
- **Landmark único (B1 review):** topbar é `<div>` dentro do `<header>` do `AppShell` (que já é `role=banner`). Spec proíbe `role=banner` duplicado; axe-core fiscaliza.
- **Motion (A2):** `CrmShell` implementa drawer mobile (framer-motion internal). Slots são nós inertes.
- **Default `topbar` ausente (A4):** altura da área superior fica 0; sidebar mantém offset 85; main ocupa full altura. Teste unit cobre.

**`CrmListShell` (novo):**
```tsx
interface CrmListShellProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbEntry[];
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;               // slot pra FilterBar/BulkActionBar futura
  children: React.ReactNode;
}
```
- Internamente: `<div className="rounded-lg border bg-card px-4 py-2"><PageHeader ... /></div>` (wrapper cardizado). Densidade `text-xl` no título (bate com Krayin `/leads`). Override via prop CSS var se precisar.
- **`PageHeader` breadcrumbs aceita `undefined` (B3 review):** spec confirma leitura do código atual (`breadcrumbs?: BreadcrumbEntry[]` em `page-header/index.tsx:27`).

**`CrmDetailShell` (novo):**
```tsx
interface CrmDetailShellProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number;                      // default 394
}
```
- `lg:grid-cols-[var(--left-width,394px)_1fr] gap-4`.
- Left: `sticky top-[calc(var(--topbar-height,62px)+0.75rem)]` (B2 review; dinâmico).
- Mobile `<lg`: reorder flex-col, left vira topo.

**`CrmDashboardGrid` (novo):**
```tsx
interface CrmDashboardGridProps {
  children: React.ReactNode;               // main
  side?: React.ReactNode;                  // se ausente, main full-width (A3)
  sideWidth?: number;                      // default 378
}
```
- `xl:grid-cols-[1fr_var(--side-width,378px)] gap-4` quando `side` presente.
- `side={undefined}` → grid single-column full-width (A3 review).
- Mobile `<xl`: empilha.

### 5.2. `nexus-crm-krayin` — composição

**Preservação obrigatória (§15):**
- `src/components/layout/sidebar.tsx` → refatorado como módulo de **montagem de slots** (`shell-slots.tsx`), exportando nós inertes. Motion migra pra `CrmShell`. CycleTheme/search/stagger 0.08/user avatar/signOut preservados.
- Fases 13/17/18/20/22/24/25/32 — smoke em `preservation-smoke.spec.ts` (5 specs, 1 por rota, §8.3).

**Páginas:**
- `(protected)/layout.tsx`: `<CrmShell sidebar={buildSidebarSlots(user)} topbar={buildTopbarSlots()}>{children}</CrmShell>`.
- `(protected)/dashboard/page.tsx` → `<DashboardContent>` compõe `<CrmDashboardGrid side={<Side>{TasksToday + RecentActivities + QuickActions}</Side>}>{main cards}</CrmDashboardGrid>`.
- `(protected)/leads/_components/leads-content.tsx` → envelopa em `CrmListShell`. FilterBar passa como `toolbar` prop. BulkActionBar continua sticky (posicionamento próprio; não-slot).
- contacts/opportunities/opportunities/pipeline — idem.

### 5.3. Mobile + a11y (cobertura explícita)

**Mobile:**
- `<lg` (1024px): `CrmShell` sidebar vira overlay com backdrop blur. Motion ownership: `CrmShell` usa framer-motion internamente; exposto via `openMobileMenu()/closeMobileMenu()` (implementação detalhe). Keyboard: `Esc` fecha; foco trap dentro do drawer; `Tab` cicla nav itens.
- `<lg`: `CrmDetailShell` reorder via `flex-col`; left vira topo.
- `<xl` (1280px): `CrmDashboardGrid` empilha.
- `<sm` (640px): table mantém scroll horizontal.

**A11y:**
- `CrmShell` preserva skip link "Pular para o conteúdo" (link escondido visualmente, focável via Tab, aponta `#conteudo`).
- `<nav aria-label="Primária">` na sidebar nav.
- `aria-current="page"` no item ativo.
- Topbar: `<div>` dentro do `<header role="banner">` do `AppShell` (sem duplicar landmark — B1).
- `<main id="conteudo" role="main">` no content.
- `CrmListShell`: `<h1>` no título.
- `CrmDetailShell` left: `<aside aria-label="Informações do registro">`.
- axe-core: zero violations `critical`/`serious` nas 5 rotas (success criteria §10.9).

### 5.4. Kanban de leads — decisão final

**Removido da Fase 34.** Nem viewSwitcher, nem link cross-entidade. Justificativa: ref tem `?view_type=kanban` default, mas kanban de leads em Next.js exige drag + server action de move + status transitions + E2E — escopo desta fase é skin, não feature. Leads/contacts/opportunities seguem como tabela (Fase 24). **Standby:** "Opção L — Kanban Leads" no HANDOFF.

### 5.5. Riscos de regressão cobertos

- E2E Fase 14 port (B5): novos specs rodarão sob `next start -p 3001` (mesma config). `visual-parity`+`theme-cycler`+`preservation-smoke` = 3 novos; aceito 17→20 verde mínimo.
- Dual React (incidente 2026-04-14): `@nexusai360/patterns` já em `transpilePackages`; confirmar no plan. Smoke `/login` pós-deploy (LEI #1 krayin).
- Theme cycler: `theme-cycler.spec.ts` obrigatório.
- `--primary` vs `--brand-color`: não introduzir `--brand-color` (§3.5 final).

### 5.6. Cross-check roteador-webhook (LEI `law_roteador_is_ui_matrix`)

Antes de merge: rodar `__ds-preview` no repo `roteador-webhook` (URL staging) com `@nexusai360/patterns@X.Y.0-beta` publicado. Validar visual regression `maxDiffPixelRatio ≤ 0.02` nas rotas do roteador que consomem `PageShell`. Se regressão >0.02: ajustar defaults pra reproduzir comportamento anterior exato ou abrir follow-up no roteador.

## 6. Audit visual

### 6.1. Documento
`nexus-crm-krayin/docs/visual-audit-krayin.md` — 5 rotas × [Rota | Screenshot Krayin original (manual dev browser) | Screenshot krayin-next atual (`pnpm visual:snap`) | Diffs categorizados | Ação planejada].

Categorias de diff: (i) shell sidebar/topbar/bg, (ii) header/título, (iii) tabela/densidade, (iv) cards/radius/borders, (v) empty states, (vi) dark mode.

### 6.2. Procedimento validação contra `manual-visual.html` (A5 review)
1. Servir `docs/manual-visual.html` (`nexus-blueprint`) localmente.
2. Para cada token crítico (`--primary`, `--card`, `--border`, `--muted`, `--foreground`, `--muted-foreground`): ler `getComputedStyle(element)` em página de `__ds-preview` que renderiza `CrmShell`/`CrmListShell`/`CrmDetailShell`/`CrmDashboardGrid`.
3. Comparar valor RGB resolvido vs valor documentado em `manual-visual.html` para light + dark.
4. Diff > 0 → ajustar token ou documentar divergência justificada.
5. Entregável: tabela em `visual-audit-krayin.md` §2 "Token parity" com resultado.

## 7. Visual regression

- Baseline `pnpm visual:snap` em `main` pré-fase.
- Captura pós-fase por rota.
- **Rotas alvo (5):** antes/depois anexado no PR; mudanças intencionais documentadas na descrição.
- **Rotas não-alvo (todas as outras):** `maxDiffPixelRatio ≤ 0.02` (falha se >).
- Output: `docs/assets/visual/{desktop,mobile}-NN-rota.png`.

## 8. Testes

### 8.1. Unit (Vitest) — patterns blueprint
- `page-shell` extended: renderiza com/sem topbar; `collapsedSidebarWidth` default 85; tokens semânticos; **backwards-compat** (props ausentes ≡ comportamento anterior — snapshot deep).
- `page-header` updated: tokens `text-foreground`/`text-muted-foreground` substituídos; backwards-compat snapshot.
- `crm-shell`: renderiza todos os slots; `topbar` undefined → sem área superior; mobile overlay fecha com Esc; skip link funcional; `aria-label="Primária"` na nav; dark mode via classList; labels PT-BR default.
- `crm-list-shell`: consome `PageHeader`; wrapper card `rounded-lg border bg-card`; `breadcrumbs={undefined}` renderiza sem crash.
- `crm-detail-shell`: grid 394/1fr em `lg+`; reorder em `<lg`; sticky `top-[calc(var(--topbar-height,62px)+0.75rem)]`.
- `crm-dashboard-grid`: grid 1fr/378px em `xl+`; `side={undefined}` → single-column full-width; empilha em `<xl`.

Target mínimo: **~30 casos** (6 suites × ~5 casos).

### 8.2. Integration (Vitest) — krayin
- `layout.test.tsx`: `ProtectedLayout` renderiza `CrmShell` com slots; `<main id="conteudo">` presente; skip link presente.
- `shell-slots.test.tsx`: `buildSidebarSlots(user)` retorna nós com logo, search, nav, themeCycler, userMenu, footer; `buildTopbarSlots()` retorna notifications + breadcrumbs + actions.
- Rotas existentes (leads/contacts/opps) — testes atuais não quebram.

### 8.3. E2E (Playwright) — krayin
- `visual-parity.spec.ts`: admin navega 5 rotas; verifica shell (aside nav, header, main), card wrapper listas, sticky left detail (lead view futura fase B — neste A só valida presença de `CrmDetailShell` em `/leads/[id]/activities` se existir).
- `theme-cycler.spec.ts`: clica cycler, `documentElement.className` muda `dark → light → system → dark`.
- `preservation-smoke.spec.ts`: **5 specs (1 por rota)**, cada com 5 asserts:
  1. EmptyState renderiza quando lista vazia (filter → 0 results → wrapper empty state presente).
  2. FilterBar inputs funcionais (digita, URL atualiza).
  3. BulkActionBar aparece em hover checkbox (seleciona 1 row → bar sticky).
  4. CommandPalette abre via Ctrl+K + mostra resultados.
  5. Loading skeleton renderiza durante SSR (route pre-load state).
- Runtime estimado: ~120s total (43s atual + ~80s para 3 novos + preservation 5 × ~8s = 40s).

### 8.4. A11y (axe-core + Playwright)
- Instalar `@axe-core/playwright` no plan.
- Rodar axe-core em cada rota alvo após `visual-parity.spec.ts`.
- Fail: qualquer violation `critical` ou `serious`.

### 8.5. Vitest target agregado
**706 (atual) + ~30 (patterns) + ~6 (krayin integration) = ~742.**

## 9. Documentação / handoff / memory

- `nexus-crm-krayin/docs/HANDOFF.md` — Fase 34 entregue + standby "Opção L Kanban Leads" + tag `phase-34-deployed`.
- `nexus-blueprint/architecture.md` — menciona 4 patterns novos + `PageShell` extended.
- `nexus-blueprint/patterns/` — docs md por pattern novo (API + exemplos + slots).
- `nexus-blueprint/CHANGELOG.md` — minor bump (additive).
- Memory updates:
  - `project_crm_phase_status.md` — fase 34 done.
  - `law_crm_shell_pattern.md` (I1 review: nome alinhado ao pattern `CrmShell`) — lei de consumo do shell em apps Nexus.
- Skill invocation (LEI `law_ui_uxpromax_blueprint`): `Skill ui-ux-pro-max:ui-ux-pro-max` antes de cada pattern novo — gate explícito no plan.

## 10. Success criteria (binários/numéricos)

1. ✅ 4 patterns novos + 2 extensões (`PageShell`, `PageHeader`) no blueprint; stories + testes verde; publicado `@nexusai360/patterns@X.Y.0` minor additive.
2. ✅ 5 rotas do krayin-next consumindo patterns; zero layout custom ad-hoc nessas 5.
3. ✅ `pnpm visual:snap` antes/depois anexado no PR (5 rotas × 2 viewports = 10 pares); rotas não-alvo `maxDiffPixelRatio ≤ 0.02`.
4. ✅ Vitest ≥742 verde; E2E ≥20 specs verde (17 + visual-parity + theme-cycler + preservation-smoke[5]).
5. ✅ `docs/visual-audit-krayin.md` cobre 5 rotas + §2 Token parity validado vs `manual-visual.html`.
6. ✅ Deploy em `crm2.nexusai360.com` sem regressão: `/api/health` 200, `/api/ready` 200, `/login` 200, smoke prod OK.
7. ✅ Tag `phase-34-deployed` aplicada.
8. ✅ Bundle budget: `pnpm size` total ≤60KB gz; cada pattern novo ≤15KB gz; relatório no PR; `sideEffects: false` em `packages/patterns/package.json`.
9. ✅ A11y axe-core: zero violations `critical`/`serious` nas 5 rotas.
10. ✅ Dark mode: grep `rg "gray-[0-9]{2,3}" packages/patterns/src/{crm-shell,crm-list-shell,crm-detail-shell,crm-dashboard-grid}/` retorna zero matches. `PageShell`/`PageHeader` pós-update também zero.
11. ✅ Preservação: `preservation-smoke.spec.ts` verde nas 5 rotas × 5 asserts = 25 pontos.
12. ✅ Theme cycler: `theme-cycler.spec.ts` verde.
13. ✅ Skip link: axe-core passa; test unit em `crm-shell.test.tsx` confirma `role=skip-link` + href `#conteudo`.
14. ✅ `"use client"` apenas em `crm-shell.tsx` (grep `rg "use client" packages/patterns/src/` retorna 1 match).
15. ✅ Cross-check roteador-webhook: visual regression `≤ 0.02` nas rotas do roteador consumindo `PageShell` (beta publish pré-merge).

## 11. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Dual React (incidente 2026-04-14) | Alta | `@nexusai360/patterns` em `transpilePackages`; smoke `/login` + debug endpoint pós-deploy (LEI #1). |
| R2 | Theme cycler regride | Alta | `theme-cycler.spec.ts` obrigatório; PR não fecha sem verde. |
| R3 | Bundle delta >8KB gz | Média | `pnpm size` antes do merge; orçamento 15KB por subpath. |
| R4 | Visual regression falso-positivo | Média | Threshold 0.02 só em rotas não-alvo. |
| R5 | Breaking para roteador-webhook | Média | Cross-check §5.6 pré-merge (beta publish). |
| R6 | E2E Fase 14 port colliding | Baixa | `next start -p 3001` (mesmo config); local pré-push. |
| R7 | Landmark `role=banner` duplicado | Alta | B1 review: topbar `<div>` dentro do `<header>` do AppShell; axe-core fiscaliza (SC #9). |
| R8 | Sticky `top-[73px]` hardcoded | Média | B2 review: `top-[calc(var(--topbar-height,62px)+0.75rem)]` dinâmico. |
| R9 | Tree-shaking barrel quebra | Média | B4 review: `sideEffects: false` + `"use client"` só em `crm-shell.tsx`; SC #8 + #14. |
| R10 | Preservação Fases 13/17/18/20/22/24/25/32 | Alta | `preservation-smoke.spec.ts` 5×5 asserts; §15 enumera. |
| R11 | Motion ownership ambígua (A2) | Média | Decidido: motion em `CrmShell` (blueprint); slots inertes. |
| R12 | `CrmDashboardGrid` side vazio (A3) | Baixa | API cobre: undefined → single-column full-width; unit test. |
| R13 | `topbar` ausente em `CrmShell` (A4) | Baixa | API cobre: opcional; altura área superior = 0; unit test. |

## 12. Não-objetivos (consolidado)

- Não port 1:1 de widgets do dashboard Krayin original.
- Não kanban novo de leads.
- Não mudanças em Prisma/Server Actions/RBAC/auth/tenant scope.
- Não mudança de paleta dark mode.
- Não port de emails templates.
- Não consumir `dembrandt`.
- Não suportar RTL.
- Não decomposição prematura 34a/34b (mantido escopo único; rollback via revert do commit consolidado + revert tag).

## 13. Entregáveis (checklist canônica)

- [ ] `nexus-blueprint/packages/patterns/src/page-shell/*` (extension additive)
- [ ] `nexus-blueprint/packages/patterns/src/page-header/*` (tokens semânticos update)
- [ ] `nexus-blueprint/packages/patterns/src/crm-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-list-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-detail-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-dashboard-grid/*`
- [ ] `nexus-blueprint/packages/patterns/package.json` com `sideEffects: false`
- [ ] `nexus-blueprint` publish minor + CHANGELOG + architecture.md
- [ ] `nexus-crm-krayin/src/components/layout/shell-slots.tsx` (novo — `buildSidebarSlots`+`buildTopbarSlots`)
- [ ] `nexus-crm-krayin/src/app/(protected)/layout.tsx` consome `CrmShell`
- [ ] `nexus-crm-krayin` 5 rotas compõem patterns
- [ ] 3 novos dashboard side widgets (`TasksTodayCard`, `RecentActivitiesCard`, `QuickActionsCard`)
- [ ] `nexus-crm-krayin/docs/visual-audit-krayin.md` (5 rotas + §2 Token parity)
- [ ] `nexus-crm-krayin/docs/HANDOFF.md` atualizado (fase 34 deployed + standby Opção L)
- [ ] Visual regression snapshots antes/depois (10 pares)
- [ ] Vitest ≥742 verde
- [ ] Playwright ≥20 specs verde
- [ ] axe-core zero violations critical/serious
- [ ] Bundle size report ≤60KB gz total
- [ ] Cross-check roteador-webhook visual regression ≤ 0.02
- [ ] Deploy + smoke prod + tag `phase-34-deployed`
- [ ] Memory: `law_crm_shell_pattern.md` + `project_crm_phase_status.md` atualizados
- [ ] Graphify update (`graphify update .` em nexus-blueprint + nexus-crm-krayin)

## 14. Ordem de entrega (A6 review — gating downstream)

Sequência canônica (bloqueia em cada ponto):
1. **Blueprint primeiro:** 4 patterns + 2 extensions + tests + stories + bundle check + cross-check roteador.
2. **Publish `@nexusai360/patterns@X.Y.0-beta`** (tag pre-release).
3. **Beta em roteador-webhook:** validar visual regression ≤ 0.02.
4. **Publish `@nexusai360/patterns@X.Y.0`** (stable, após beta ok).
5. **Krayin consome:** `npm install @nexusai360/patterns@X.Y.0` no krayin; wire `shell-slots.tsx` + `layout.tsx`.
6. **Krayin refactor páginas:** dashboard → leads → contacts → opportunities → pipeline (ordem; commits atômicos).
7. **Visual regression pós:** `pnpm visual:snap` em cada rota.
8. **Audit doc:** `visual-audit-krayin.md` preenchido.
9. **Testes verde:** vitest + E2E + axe.
10. **Smoke local:** `/login`, `/dashboard`, `/leads`, `/contacts`, `/opportunities`, `/opportunities/pipeline`.
11. **Commit + push + deploy prod.**
12. **Smoke prod:** `/api/health`, `/api/ready`, `/login`, `/dashboard`.
13. **Tag `phase-34-deployed` + memory update + graphify update.**

## 15. Preservação obrigatória 🛡️

| Fase origem | Feature | Smoke obrigatório |
|---|---|---|
| 13 | PageHeader em 9 telas | `preservation-smoke` verifica `<h1>` |
| 17 | Kanban Pipeline dnd-kit | e2e drag + card movido |
| 18 | Dashboard Funnel/PipelineValue/TopOpps | 3 cards renderizam na main |
| 20 | EmptyState em 9 telas | zera filtros → empty state CTA |
| 22 | Loading skeletons | `loading.tsx` durante SSR fetch |
| 24 | URL filters + Bulk Actions | `?status=...`, BulkActionBar sticky |
| 25 | CommandPalette Ctrl+K | abre + HighlightMatch `<mark>` |
| 26-32 | Bulk delete/edit em 8 módulos | botão "Excluir N" ativo |
| 33 | Saved filters default | filtro padrão auto-aplicado |

`preservation-smoke.spec.ts` — 5 specs (1/rota) × 5 asserts = 25 pontos. PR não fecha se falhar.

## 16. Resumo executivo (v3 vs v2)

**Mudanças incorporadas do Review #2:**
- ✅ B1 landmark único (topbar `<div>` dentro do `<header>` do AppShell).
- ✅ B2 sticky dinâmico `top-[calc(var(--topbar-height,62px)+0.75rem)]`.
- ✅ B3 confirmado contrato `PageHeader.breadcrumbs?` opcional.
- ✅ B4 `sideEffects: false` + `"use client"` só em crm-shell.tsx.
- ✅ B5 E2E port explícito `next start -p 3001`.
- ✅ A1 3 widgets side decididos: TasksToday + RecentActivities + QuickActions.
- ✅ A2 motion ownership decidido: no `CrmShell` (blueprint).
- ✅ A3 `side={undefined}` → single-column full-width.
- ✅ A4 `topbar` opcional: ausente → área superior 0.
- ✅ A5 procedimento validação manual-visual detalhado (§6.2).
- ✅ A6 ordem de entrega §14 gated.
- ✅ A7 `preservation-smoke` = 5 specs × 5 asserts.
- ✅ I1 memory renomeada `law_crm_shell_pattern.md`.
- ✅ I2 disclaimer mapping doc-only §3.5.
- ✅ I3 tokens resolvem mesmos valores; visual regression fiscaliza.
- ✅ I4 skill `ui-ux-pro-max` invocação + LEIs referenciadas §9.
- ✅ I5 cross-check roteador-webhook §5.6.
- ✅ Refinamentos textuais 1-12 do review aplicados.

**Status:** pronta para `superpowers:writing-plans` gerar plan v1.
