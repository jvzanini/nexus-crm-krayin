# Fase 34 — Visual Parity com Krayin Original (Parte A) — v2

**Data:** 2026-04-16
**Versão:** v2 (incorpora Review #1 — 2 críticos, 4 altos, 8 médios, 5 lows)
**Fonte de verdade visual:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm` (Laravel/Krayin — pacote `Webkul/Admin`, 282 Blade templates).
**Destino:** páginas existentes do `nexus-crm-krayin` + **extensão** de patterns já existentes no `nexus-blueprint` (não criar 4º shell).
**Escopo Fase A:** shell admin refinado + 5 rotas de alto tráfego (dashboard, leads, contacts, opportunities, pipeline).
**Fase B (35, futura):** 8 módulos restantes.

---

## 1. Contexto

CRM em produção (`crm2.nexusai360.com`) está funcional (Fase 33, 706/706 verde) mas o **shell visual diverge** da referência do Krayin original (`crm.nexusai360.com`, pacote Laravel `packages/Webkul/Admin`). Usuário quer skin alinhada (densidade compacta, sidebar colapsável 85px, topbar 62px, card-based header, two-column detail sticky). Toda lógica (Prisma, auth, Server Actions, RBAC, tenant scope) fica intacta.

**Decisão arquitetural pós-Review #1:** não criar novo "AdminShell" concorrente com os 3 candidatos existentes (`AppShell` do `@nexusai360/design-system`, `PageShell` do `@nexusai360/patterns`, `src/components/layout/sidebar.tsx` do CRM). Em vez disso:

1. **Estender `PageShell`** (patterns) com props additive: `topbar?`, `collapsedSidebarWidth?`, `sidebarCollapsed?`, tokens semânticos (`bg-card`/`border-border` em vez de zinc-950).
2. **Novo pattern `CrmShell`** no `@nexusai360/patterns` que **consome o `AppShell` do DS** internamente + adiciona layout Krayin (sidebar 85px collapsed / ~260px expanded, topbar 62px, densidade compacta). Justificativa: `AppShell` (DS) é primitivo DS-opinião; `PageShell` (patterns) é shell genérico Radix-agnóstico; `CrmShell` é composição CRM-flavor com defaults Krayin + slots tipados. Sem reimplementação: usa `AppShell.Root/Sidebar/Header/Main/Content` por baixo.
3. **`CrmListShell`** **compõe `PageHeader`** (patterns, já existente) dentro de um wrapper card `rounded-lg border bg-card` + slot de content + slot opcional `toolbar` (NÃO `viewSwitcher` — ver §5.4).
4. **`CrmDetailShell`** novo (sem concorrente): two-column grid (sticky left 394px + flex right) com slots `left`/`right`.
5. **`CrmDashboardGrid`** novo (sem concorrente): grid (flex-1 main + 378px side) com slots `main`/`side`.

**Preservação obrigatória (§15):** tudo entregue das Fases 13/17/18/20/22/24/25/32 continua funcional após refactor.

**Respeita LEIs:**
- LEI #4 CLAUDE.md krayin — consultar blueprint; decisão v2 é *estender*, não duplicar.
- Regra 11 blueprint — visual regression `pnpm visual:snap` antes/depois.
- Regra 12 blueprint — modularização; patterns = composição acima de primitivos.
- `design_system_versioning` — additive = minor bump.
- `design_system_bundle_budget` — ≤60KB gz total, ≤15KB gz por subpath.
- `design_system_manual_visual_source` — validar contra `docs/manual-visual.html`.

## 2. Motivação (não-negociável)

- Shell CRM unificado num pattern versionado → mudar sidebar/topbar = 1 edit no blueprint, propaga pros N consumidores (CRM, outros produtos Nexus futuros).
- Páginas do CRM compõem patterns, não reinventam layout.
- Alinhamento estrutural com Krayin (densidade, card-based header, sticky detail) aumenta reconhecibilidade para quem vem do CRM antigo.
- **Brand color continua violeta Nexus (`#6d28d9` / `#7c3aed` via `--primary` do DS).** O azul do Krayin (`#0E90D9`) é default do pacote open-source, **não** identidade Nexus — ver §3.5 decisão H4.

## 3. Fonte de verdade visual (inventário da referência)

### 3.1. Shell (layout principal)
Arquivo: `packages/Webkul/Admin/src/Resources/views/components/layouts/index.blade.php`.

```
<body class="h-full font-inter dark:bg-gray-950">
  <x-admin::layouts.header />                     {{-- topbar 62px --}}
  <div class="group/container sidebar-collapsed flex gap-4">
    <x-admin::layouts.sidebar.desktop />          {{-- collapse 85px / expanded ~250px --}}
    <div class="flex min-h-[calc(100vh-62px)] bg-gray-100 pt-3 dark:bg-gray-950">
      <div class="px-4 pb-6 ltr:lg:pl-[85px]">{{ $slot }}</div>
    </div>
  </div>
</body>
```

Características canônicas:
- Fonte: Inter.
- Topbar altura: **62px fixa**.
- Sidebar: **85px collapsed / ~260px expanded**, transição 300ms.
- Main bg: **surface sutil** (em tokens Nexus: `bg-muted/30` light / `bg-background` dark — NÃO `gray-100` cru — ver M6 do review).
- Padding content: `px-4 pb-6 pl-[85px]` (offset da sidebar colapsada).

### 3.2. Dashboard
Arquivo: `packages/Webkul/Admin/src/Resources/views/dashboard/index.blade.php`.

Header: `mb-5 flex justify-between`, título `text-2xl font-semibold`, filtros à direita (2 date pickers 140px).
Grid: left `flex-1 flex-col gap-4`, right `w-[378px] flex-col gap-4`. Mobile `max-xl:flex-wrap`.

### 3.3. Lead Index (list)
Arquivo: `packages/Webkul/Admin/src/Resources/views/leads/index.blade.php`.

Header em card: `flex justify-between rounded-lg border bg-white px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-900`. Left: breadcrumbs + título `text-xl font-bold`. Right: ações.
Content: view switcher `?view_type=table|kanban` default kanban. **Ver §5.4 — kanban leads fora desta fase.**

### 3.4. Lead View (detail)
Arquivo: `packages/Webkul/Admin/src/Resources/views/leads/view.blade.php`.

Two-column:
- **Left sticky 394px** `rounded-lg border bg-white`: info (breadcrumbs+tags+title+actions) → attributes → person.
- **Right flex** `flex-1 flex-col gap-4`: stages pill → activities tabs (All/Description/Products/Quotes).
Mobile: `max-lg:flex-wrap`.

### 3.5. Tokens da referência aplicáveis + decisão brand color (H4)

| Característica referência | Classe Krayin cru | Equivalente Nexus (tokens semânticos) |
|---|---|---|
| Card bg | `bg-white dark:bg-gray-900` | `bg-card` |
| Card border | `border-gray-200 dark:border-gray-800` | `border-border` |
| Main bg | `bg-gray-100 dark:bg-gray-950` | `bg-muted/30` light / `bg-background` dark |
| Text muted | `text-gray-600 dark:text-gray-300` | `text-muted-foreground` |
| Radius card | `rounded-lg` (8px) | `rounded-lg` |
| Radius input/btn | `rounded-md` (6px) | `rounded-md` |
| Gap padrão | `gap-4` (16px) | `gap-4` |
| Densidade | `text-sm`, `py-2`, `min-h-[39px]` | mesmo |
| Hover border | `hover:border-gray-400` | `hover:border-ring` |
| **Brand primary** | `#0E90D9` (CSS var `--brand-color`) | **`--primary` violeta Nexus (#6d28d9 light / #7c3aed dark) — MANTIDO** |

**Decisão H4 (crítica):** **brand color violeta Nexus fica.** Fundamentos:
1. CLAUDE.md krayin §251 fixa `#6d28d9 / #7c3aed` como brand do produto.
2. LEI Design System Blueprint = fonte única de verdade visual. Trocar pelo azul do Krayin open-source seria import de brand alheia.
3. Usuário pediu "telas parecidas com referência" = estrutura/densidade/skin, não marca/cor.
4. Sidebar atual do CRM tem `shadow-[rgba(124,58,237,0.3)]` violeta — trocar geraria frankenstein.

`CrmShell` **não** introduz `--brand-color`; usa `--primary` do DS (já existente). Ponto encerrado.

## 4. Escopo (in/out)

### IN — Fase 34 (A)

**Blueprint (patterns additive):**
- Estender `PageShell` (patterns) com props additive: `topbar?: ReactNode`, `collapsedSidebarWidth?: number` (default 85), `sidebarCollapsed?: boolean`, **tokens semânticos** (`bg-background`, `bg-card`, `border-border` em vez de zinc-950). Zero breaking para consumidores atuais (props opcionais com defaults que reproduzem comportamento anterior).
- Novo pattern **`CrmShell`** em `@nexusai360/patterns/crm-shell`: composição sobre `AppShell` do DS com defaults Krayin (collapse 85/260, topbar 62px, densidade compacta). API de slots: `<CrmShell sidebar={{ logo, search, nav, themeCycler, user, footer }} topbar={{ breadcrumbs?, notifications?, actions? }}>{children}</CrmShell>`. Slots preservam cycleTheme, search Ctrl+K, user info com avatar, nav stagger 0.08 — **gaps explícitos (H1 review)**.
- Novo pattern **`CrmListShell`** em `@nexusai360/patterns/crm-list-shell`: composição `PageHeader` (reutilizando o existente — não duplica) dentro de wrapper card `rounded-lg border bg-card px-4 py-2`. API: `<CrmListShell title description? breadcrumbs? actions? toolbar?>{children}</CrmListShell>`. Sem viewSwitcher (decisão §5.4).
- Novo pattern **`CrmDetailShell`** em `@nexusai360/patterns/crm-detail-shell`: two-column `lg:grid-cols-[394px_1fr] gap-4`, left sticky `top-[73px]`, mobile reordena left→top. API: `<CrmDetailShell left={...} right={...} />`.
- Novo pattern **`CrmDashboardGrid`** em `@nexusai360/patterns/crm-dashboard-grid`: grid `xl:grid-cols-[1fr_378px] gap-4`, mobile empilha. API: `<CrmDashboardGrid side={...}>{main}</CrmDashboardGrid>`.

**nexus-crm-krayin (5 rotas):**
- `src/app/(protected)/layout.tsx` — criar/atualizar pra consumir `CrmShell`; sidebar atual vira `sidebar` prop montada pelo consumer (preserva cycleTheme, search, user, stagger 0.08, logo violeta).
- `/dashboard` (via `DashboardContent`) — compõe `CrmDashboardGrid` com widgets existentes (`FunnelCard`/`PipelineValueCard`/`TopOpportunitiesCard` no main; 3 widgets menores no side — decidir quais no plan; **não** port de widgets Krayin original).
- `/leads` — compõe `CrmListShell` envelopando `FilterBar`+`BulkActionBar`+`DataTable` (todos preservados; Fases 24/32).
- `/contacts` — `CrmListShell` envelopando estrutura atual.
- `/opportunities` — `CrmListShell` envelopando estrutura atual.
- `/opportunities/pipeline` — `CrmListShell` envelopando kanban existente (`@dnd-kit`, Fases 17/21); DndContext intocado.

**Tokens:**
- Não adicionar `--brand-color` (decisão H4).
- Eventualmente: adicionar `var(--sidebar-collapsed-width, 85px)` + `var(--topbar-height, 62px)` se `CrmShell` expor essas como CSS vars. Decisão fica no plan.

**Audit:**
- `nexus-crm-krayin/docs/visual-audit-krayin.md` com tabela: [rota] | [screenshot krayin original — manual dev browser] | [screenshot krayin-next atual `pnpm visual:snap`] | [diffs] | [ação].
- Validar tokens adicionados contra `nexus-blueprint/docs/manual-visual.html` (H3 review).

**Visual regression:**
- Baseline `pnpm visual:snap` pré-fase.
- Captura pós-fase.
- Threshold: rotas alvo (5) — mudanças documentadas antes/depois no PR (sem threshold binário, porque o diff é intencional). Rotas NÃO-alvo (`/companies`, `/products`, `/tasks`, `/reports`, `/settings/*`, `/profile`, `/users`, `/marketing/*`, `/automation/*`) — `maxDiffPixelRatio ≤ 0.02` (M2 review: critério binário).

### OUT — Fase 35 (B) ou follow-ups

- 8 módulos restantes (Fase 35).
- Kanban novo de leads (standby documentado no HANDOFF; ver §5.4).
- Port 1:1 de widgets Krayin original (Revenue/OverAll/TotalLeads/TopProducts/TopPersons/OpenLeadsByStates/RevenueBySources/RevenueByTypes). Widgets atuais do krayin-next **permanecem**.
- Não mexer em Prisma/Server Actions/RBAC/auth/tenant scope.
- Não mudar paleta dark mode global.
- Não port de emails templates.
- Não usar `dembrandt` (decisão do usuário; opcional futuro).
- Não suportar RTL (L1 review; documentado).

## 5. Arquitetura das mudanças

### 5.1. `nexus-blueprint` — patterns novos + extensão (API explícita)

```
packages/patterns/src/
  page-shell/index.tsx                  # extensão additive (props topbar, collapsedSidebarWidth, tokens semânticos)
  crm-shell/
    crm-shell.tsx                       # composição sobre AppShell do DS
    crm-shell.stories.tsx
    crm-shell.test.tsx
    types.ts
    index.ts
  crm-list-shell/
    crm-list-shell.tsx                  # consome PageHeader internamente
    crm-list-shell.stories.tsx
    crm-list-shell.test.tsx
    index.ts
  crm-detail-shell/
    crm-detail-shell.tsx                # two-column sticky
    crm-detail-shell.stories.tsx
    crm-detail-shell.test.tsx
    index.ts
  crm-dashboard-grid/
    crm-dashboard-grid.tsx              # main + side 378px
    crm-dashboard-grid.stories.tsx
    crm-dashboard-grid.test.tsx
    index.ts
```

**Dependências internas:**
- `CrmShell` → `AppShell` (`@nexusai360/design-system`).
- `CrmListShell` → `PageHeader` (`@nexusai360/patterns/page-header`).
- Todos usam `@nexusai360/ui` primitivos (card, button, breadcrumb quando aplicável).
- Nenhum pattern novo bate direto em Tailwind gray-XXX — usa tokens semânticos (M6 review).

**API slots `CrmShell`:**
```tsx
interface CrmShellProps {
  sidebar: {
    logo: React.ReactNode;
    search?: React.ReactNode;
    nav: React.ReactNode;
    themeCycler?: React.ReactNode;
    user: React.ReactNode;
    footer?: React.ReactNode;
    collapsed?: boolean;
    onCollapsedChange?: (v: boolean) => void;
  };
  topbar?: {
    breadcrumbs?: React.ReactNode;
    notifications?: React.ReactNode;
    actions?: React.ReactNode;
  };
  labels?: {
    skipLink?: string;          // default "Pular para o conteúdo"
    expandSidebar?: string;     // default "Expandir menu"
    collapseSidebar?: string;   // default "Recolher menu"
  };
  children: React.ReactNode;
}
```
Preserva skip link do `AppShell`, aceita labels PT-BR (M5 review), slot `themeCycler` explicita onde o ciclador mora.

### 5.2. `nexus-crm-krayin` — composição (preservação + refactor)

**Preservação obrigatória** (ver §15):
- `src/components/layout/sidebar.tsx` → refatorado como **montador de slots** para `CrmShell`: exporta funções `buildSidebarSlots(user)` / `buildTopbarSlots()` que retornam os nós (logo violeta, search Ctrl+K, nav com getNavItems + stagger motion 0.08, cycleTheme, user info avatar, footer signOut, mobile drawer). Continua `"use client"`.
- `FilterBar`+`BulkActionBar`+`CommandPalette`+`HighlightMatch`+`EmptyState`+`loading.tsx` de cada rota — intocados no refactor; apenas o wrapper ao redor muda.
- Theme cycler — preservado e testado (e2e clica, verifica `document.documentElement.class` muda).

**Páginas:**
- `src/app/(protected)/layout.tsx`:
  ```tsx
  import { CrmShell } from "@nexusai360/patterns";
  import { buildSidebarSlots, buildTopbarSlots } from "@/components/layout/shell-slots";
  export default async function ProtectedLayout({ children }) {
    const user = await getCurrentUser();
    return (
      <CrmShell sidebar={buildSidebarSlots(user)} topbar={buildTopbarSlots()}>
        {children}
      </CrmShell>
    );
  }
  ```
- `dashboard/page.tsx` → `DashboardContent` compõe `CrmDashboardGrid`.
- `leads|contacts|opportunities|opportunities/pipeline` → `CrmListShell`.

### 5.3. Mobile + a11y (cobertura explícita — M3/M4 review)

**Mobile** (breakpoints Tailwind):
- `<lg` (1024px): `CrmShell` sidebar vira overlay com backdrop blur (reusar motion atual do krayin-next); topbar mantém 62px.
- `<lg`: `CrmDetailShell` reordena left→top (left vira cabeçalho colado no topo).
- `<xl` (1280px): `CrmDashboardGrid` empilha main+side em 1 coluna.
- `<sm` (640px): densidade inalterada; table vira scroll horizontal (preservar comportamento atual `@nexusai360/ui/table`).

**A11y:**
- `CrmShell` preserva skip link "Pular para o conteúdo" (já existe no `AppShell` DS; spec confirma).
- Sidebar nav: `<nav aria-label="Primária">`, `aria-current="page"` no item ativo.
- Topbar: `<header role="banner">`.
- Main: `<main id="conteudo" role="main">`.
- `CrmListShell`: título com `<h1>`.
- `CrmDetailShell`: left sticky panel com `aria-label="Informações do registro"`.
- axe-core sem violations críticas nas 5 rotas.

### 5.4. Kanban de leads — decisão final (M1 review)

**Removido da Fase 34.** Nem viewSwitcher, nem link cross-entidade. O `CrmListShell` NÃO tem prop `viewSwitcher` na v2. Leads/contacts/opportunities seguem como tabela (Fase 24). Kanban de leads vira **follow-up dedicado** registrado no HANDOFF como "opção L — Kanban Leads" (drag + server action de move + colunas por status). Pipeline de opportunities (`/opportunities/pipeline`) continua como kanban — entregue na Fase 17, só envelopado no `CrmListShell` agora.

### 5.5. Riscos de regressão cobertos (H2 review)

- **E2E Fase 14 stabilizer:** novo spec `visual-parity.spec.ts` rodará sob `next start` (mesmo config). Mitigação: rodar `npm run test:e2e` local antes do push; aceitar 17→18 specs verde mínimo.
- **Dual React (incidente 2026-04-14):** todos os patterns novos adicionados a `transpilePackages` no `next.config.ts` (`@nexusai360/patterns` já deve estar lá — verificar no plan). Smoke `/login` pós-deploy.
- **Theme cycler regride:** e2e novo `theme-cycler.spec.ts` — admin clica cycler, verifica `document.documentElement.className` muda dark→light→system.
- **`--primary` vs `--brand-color`:** não introduzir `--brand-color`. Usar `--primary` do DS. Documentado §3.5.

## 6. Audit visual

`nexus-crm-krayin/docs/visual-audit-krayin.md` com:
- Tabela por tela × 5 rotas.
- Colunas: [Rota] | [Screenshot Krayin original] | [Screenshot krayin-next atual] | [Diffs categorizados] | [Ação planejada].
- Screenshot Krayin original: dev browser manual do usuário em `crm.nexusai360.com` (usuário fornece OU tiramos manualmente via dev tools do navegador do user, tipo pedir screenshots). **Dembrandt NÃO usado.**
- Screenshot krayin-next atual: baseline `pnpm visual:snap`.
- Diffs categorizados: (i) shell (sidebar/topbar/bg), (ii) header/título, (iii) tabela/densidade, (iv) cards/radius/borders, (v) empty states, (vi) dark mode tokens.
- Validação cruzada com `nexus-blueprint/docs/manual-visual.html` (H3 review).

## 7. Visual regression

- **Antes:** `pnpm visual:snap` em `main` pré-fase (baseline).
- **Depois:** `pnpm visual:snap` pós cada tela.
- **Rotas alvo (5):** antes/depois anexado no PR; mudanças intencionais documentadas na descrição do PR (sem threshold binário).
- **Rotas não-alvo:** `maxDiffPixelRatio ≤ 0.02` (falha o job se ultrapassar).
- Output: `docs/assets/visual/{desktop,mobile}-NN-rota.png`.

## 8. Testes

### 8.1. Unit (Vitest) — patterns novos no blueprint
- `page-shell` extended: renderiza com/sem topbar; collapse-width default 85; tokens semânticos aplicados; backwards compat (props ausentes → comportamento anterior).
- `crm-shell`: renderiza todos os slots; preserva skip link; aplica `aria-label="Primária"` na nav; dark mode via classList; responde a `labels` PT-BR.
- `crm-list-shell`: consome `PageHeader`; aplica card wrapper `rounded-lg border bg-card`.
- `crm-detail-shell`: grid 394px/1fr em `lg+`; reordena em `<lg`; sticky `top-[73px]`.
- `crm-dashboard-grid`: grid 1fr/378px em `xl+`; empilha em `<xl`.

Target mínimo: **~24 casos** (5 patterns × ~5 casos médios).

### 8.2. Integration (Vitest) — krayin
- `layout.test.tsx`: `ProtectedLayout` renderiza `CrmShell` com slots montados; sem crash; preserva `<main id="conteudo">`.
- Testes existentes por rota (leads/contacts/opps) não quebram.

### 8.3. E2E (Playwright) — krayin
- `visual-parity.spec.ts`: admin navega `/dashboard` → `/leads` → `/contacts` → `/opportunities` → `/opportunities/pipeline`, verifica presença shell (aside sidebar, header topbar, main), card wrapper em listas, sticky left em detail.
- `theme-cycler.spec.ts`: admin clica cycler, `documentElement.className` muda `dark → light → system → dark`.
- `preservation-smoke.spec.ts`: em cada rota alvo, verifica presença de EmptyState wrapper (quando lista vazia), FilterBar inputs, BulkActionBar (seleciona linha), CommandPalette Ctrl+K abre.
- Target: **17 → ≥20 specs verde** (17 atuais + 3 novos).

### 8.4. A11y (axe-core)
- Rodar axe-core nas 5 rotas alvo via Playwright (existe `@axe-core/playwright` ou equivalente).
- Falha: qualquer violation `critical` ou `serious`.

### 8.5. Vitest target agregado
**706 (atual) + ~24 (patterns blueprint) + ~6 (krayin integration) = ~736 casos.** Floor 722 na v1 revisado pra cima.

## 9. Documentação / handoff

- `nexus-crm-krayin/docs/HANDOFF.md` — atualiza estado Fase 34 entregue + standby "Kanban Leads" + tag `phase-34-deployed`.
- `nexus-blueprint/architecture.md` — menciona `CrmShell`/`CrmListShell`/`CrmDetailShell`/`CrmDashboardGrid`.
- `nexus-blueprint/patterns/` — docs md por pattern novo (API + exemplos).
- `nexus-blueprint/CHANGELOG.md` — minor bump (additive).
- Memory: atualiza `project_crm_phase_status.md` + cria `law_crm_shell_pattern.md` se houver regra permanente.

## 10. Success criteria (binários/numéricos)

1. ✅ 4 patterns novos + 1 extensão (`page-shell`) no blueprint, com stories + testes verde, publicados em `@nexusai360/patterns@X.Y.0` (minor additive).
2. ✅ 5 rotas do krayin-next consumindo patterns (dashboard/leads/contacts/opps/pipeline); zero layout custom ad-hoc nessas 5.
3. ✅ `pnpm visual:snap` antes/depois anexado no PR para 5 rotas × 2 viewports (10 pares); rotas não-alvo com `maxDiffPixelRatio ≤ 0.02`.
4. ✅ Vitest ≥736 verde; E2E ≥20 specs verde (+ 3 novos: visual-parity, theme-cycler, preservation-smoke).
5. ✅ `docs/visual-audit-krayin.md` existe, cobre 5 rotas, validado contra `manual-visual.html`.
6. ✅ Deploy em `crm2.nexusai360.com` sem regressão: `/api/health` 200, `/api/ready` 200, `/login` 200, smoke prod OK.
7. ✅ Tag `phase-34-deployed` aplicada.
8. ✅ Bundle budget respeitado: `pnpm size` total ≤60KB gz; cada pattern novo ≤15KB gz; relatório anexado no PR.
9. ✅ A11y axe-core: zero violations `critical`/`serious` nas 5 rotas.
10. ✅ Dark mode: 100% dos novos patterns usam tokens semânticos (`bg-card`/`border-border`/`text-muted-foreground`); grep pós-merge `rg "gray-[0-9]{2,3}" packages/patterns/src/crm-*` retorna vazio.
11. ✅ Preservação: smoke pass em EmptyState, FilterBar, BulkActionBar, CommandPalette, loading skeletons nas 5 rotas — via `preservation-smoke.spec.ts`.
12. ✅ Theme cycler preservado e testado (`theme-cycler.spec.ts`).
13. ✅ Skip link preservado (`aria-label` na main-link, axe-core passa).

## 11. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Dual React (incidente 2026-04-14) | Alta | Patterns adicionados a `transpilePackages`; smoke `/login` + `/api/debug/layout` pós-deploy (LEI #1 krayin). |
| R2 | Theme cycler regride | Alta | `theme-cycler.spec.ts` obrigatório; PR não fecha sem ele verde. |
| R3 | Bundle delta >8KB gz | Média | `pnpm size` antes de merge; orçamento 15KB por pattern. |
| R4 | Visual regression falso-positivo | Média | Threshold `maxDiffPixelRatio ≤ 0.02` só em rotas não-alvo; alvo tem diff intencional. |
| R5 | Breaking para outros consumidores (roteador-webhook) | Média | Props additive em `page-shell` (defaults reproduzem comportamento atual); minor bump; teste manual no roteador antes do publish. |
| R6 | E2E Fase 14 stabilizer destabiliza | Baixa | Rodar `npm run test:e2e` local pré-push; aceitar mínimo 17→20 verde. |
| R7 | CSS vars `--brand-color` conflita | N/A | Não introduz (decisão §3.5). |
| R8 | Kanban leads viewSwitcher confuso | N/A | Removido (§5.4). |
| R9 | Sidebar mobile overlay quebra em telas <sm | Baixa | E2E mobile test na `visual-parity.spec.ts` (viewport 390×844). |
| R10 | Preservação de Fases 13/17/18/20/22/24/25/32 | Alta | `preservation-smoke.spec.ts` dedicado; §15 enumera obrigações. |

## 12. Não-objetivos (anti-scope explícito — consolidado com §4 OUT)

- Não port 1:1 de widgets do dashboard Krayin original.
- Não implementação de kanban novo de leads (standby documentado).
- Não mudanças em Prisma, Server Actions, RBAC, tenant scope, auth.
- Não mudança de paleta dark mode.
- Não port de emails templates.
- Não consumir dembrandt.
- Não suportar RTL.

## 13. Entregáveis (checklist canônica para review)

- [ ] `nexus-blueprint/packages/patterns/src/page-shell/*` (extensão additive)
- [ ] `nexus-blueprint/packages/patterns/src/crm-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-list-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-detail-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-dashboard-grid/*`
- [ ] `nexus-blueprint` publish minor + CHANGELOG + architecture.md
- [ ] `nexus-crm-krayin/src/app/(protected)/layout.tsx` consumindo `CrmShell`
- [ ] `nexus-crm-krayin/src/components/layout/shell-slots.tsx` exportando `buildSidebarSlots`/`buildTopbarSlots`
- [ ] 5 rotas do krayin compõem patterns
- [ ] `nexus-crm-krayin/docs/visual-audit-krayin.md`
- [ ] `nexus-crm-krayin/docs/HANDOFF.md` atualizado (Fase 34 deployed + standby Kanban Leads)
- [ ] Visual regression snapshots antes/depois (10 pares)
- [ ] Vitest ≥736 verde
- [ ] Playwright ≥20 specs verde (+ visual-parity, theme-cycler, preservation-smoke)
- [ ] axe-core zero violations critical/serious
- [ ] Bundle size report ≤60KB gz total
- [ ] Deploy + smoke prod + tag `phase-34-deployed`

## 14. Próxima versão

- **v3 — pente fino profundo:** segunda passada crítica, revalidar contra CLAUDE.md krayin + CLAUDE.md blueprint + memory rules; versão definitiva antes de writing-plans.

## 15. Preservação obrigatória (nova seção — §5.3 review) 🛡️

Features que NÃO podem ser quebradas no refactor (ordenadas por fase de origem):

| Fase | Feature | Smoke test obrigatório |
|---|---|---|
| 13 | PageHeader em 9 telas | `preservation-smoke.spec.ts` verifica `<h1>` presente |
| 17 | Kanban Pipeline dnd-kit | e2e drag + verifica card movido |
| 18 | Dashboard Funnel/PipelineValue/TopOpps | verifica 3 cards renderizam |
| 20 | EmptyState em 9 telas | e2e zera filtros, verifica empty state CTA |
| 22 | Loading skeletons | verifica `loading.tsx` renderiza durante SSR fetch |
| 24 | URL filters + Bulk Actions | verifica `?status=...` aplicado, BulkActionBar sticky |
| 25 | CommandPalette Ctrl+K | verifica abre + HighlightMatch `<mark>` |
| 26-32 | Bulk delete/edit em 8 módulos | verifica botão "Excluir N" no BulkActionBar |
| 33 | Saved filters default | verifica filtro padrão auto-aplicado |

**Regra:** `preservation-smoke.spec.ts` roda em todas as 5 rotas alvo. PR não fecha se ele falhar.

## 16. Resumo executivo (v2 vs v1)

**Mudanças incorporadas do Review #1:**
- ✅ C1 AdminShell removido; `CrmShell` agora compõe `AppShell` (DS) internamente.
- ✅ C2 `CrmListShell` explicita que consome `PageHeader` (não duplica).
- ✅ H1 API de slots do `CrmShell` detalhada; cycleTheme/search/user/stagger preservados.
- ✅ H2 risco E2E Fase 14 adicionado na §11 (R6).
- ✅ H3 validação contra `manual-visual.html` adicionada na §6.
- ✅ H4 decisão brand color violeta Nexus — definitiva, justificada §3.5.
- ✅ M1 kanban leads removido; viewSwitcher fora; follow-up no HANDOFF.
- ✅ M2 threshold binário visual regression (§7).
- ✅ M3 mobile breakpoints explícitos (§5.3).
- ✅ M4 a11y checklist detalhada (§5.3 + §8.4).
- ✅ M5 labels PT-BR no `CrmShell` (§5.1).
- ✅ M6 tokens semânticos (§3.5) em vez de gray-XXX (grep check §10.10).
- ✅ M7 bundle budget success criteria (§10.8).
- ✅ M8 dual React smoke (§11 R1).
- ✅ L3 §12 consolidado com §4 OUT.
- ✅ L4 origem de screenshot audit definida (§6).
- ✅ Preservação seção dedicada (§15).
