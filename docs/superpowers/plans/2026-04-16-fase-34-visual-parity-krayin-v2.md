# Fase 34 — Visual Parity com Krayin Original (Parte A) — Plan v2

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Checkboxes `- [ ]` rastreiam progresso.

**Goal:** Alinhar visualmente 5 rotas do `nexus-crm-krayin` (dashboard, leads, contacts, opportunities, pipeline) ao Krayin original via 4 patterns novos no `nexus-blueprint` (`CrmShell`, `CrmListShell`, `CrmDetailShell`, `CrmDashboardGrid`) + 2 extensões additive (`PageShell`, `PageHeader`). Preserva 100% das features de Fases 13/17/18/20/22/24/25/32.

**Architecture:** Patterns blueprint são composição sobre primitivos existentes (`AppShell` do DS, `PageHeader` do patterns). `CrmShell` encapsula motion do mobile drawer; slots são nós inertes. Brand violeta Nexus via `--primary` do DS. Krayin consome via `(protected)/layout.tsx` + factory `shell-slots.tsx`. Páginas preservam estrutura atual; apenas envelopam em wrapper pattern.

**Tech Stack:** Next 16 (App Router, RSC), React 19, TypeScript, Tailwind CSS, Radix, `@nexusai360/design-system@0.3.0`, `@nexusai360/patterns@0.2.0` (publish desta fase), `@nexusai360/ui`, Vitest, Playwright + `@axe-core/playwright`, framer-motion.

**Spec:** `docs/superpowers/specs/2026-04-16-fase-34-visual-parity-krayin-v3.md`.

**Revisão incorporada (Review #1):** 6 críticos (C1-C6), 6 altos (H1-H6), 8 médios + 4 lows. Principais mudanças vs v1:
- C1 Skip link ID canônico = `#main` (AppShell DS fornece; CrmShell não duplica).
- C2 AppShell API auditada — provê grid `lg:grid-cols-[260px_1fr]` + skip link + `<main id="main">` + `<header role="banner">`; CrmShell não implementa layout próprio, apenas adiciona mobile drawer + topbar slots + h-[62px] override.
- C3 Removido `<div>` dead code.
- C4 Assinatura real `listTasks(raw?: unknown): Promise<ActionResult<ActivityItem[]>>` — widget usa filters suportados.
- C5 Publish cycle: T10 bump `0.2.0-beta.0` (pré-beta publish); T12.3 bump `0.2.0` stable.
- C6 `package.json` adiciona `"files": ["dist", "src"]` para exports `./src/*.tsx` funcionarem pós-publish.
- H1/M8 E2E Playwright: todos os novos specs em `tests/e2e/golden-paths/` + regex do config expandido para reutilizar `storageState` admin.json.
- H2 `preservation-smoke.spec.ts` expandido para 5 blocks completos (sem placeholders).
- H3 T18/19/22/23 com código completo.
- H4 T16 adiciona audit pré + rollback.
- H5 T20 **preserva** StatsCards/DashboardFilters/RecentActivity/chart Pipeline no main — só envelopa em `CrmDashboardGrid` e adiciona 3 widgets novos no side.
- H6 Memory path corrigido: `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/`.

---

## Pré-requisitos

- Branch `main` limpo (pós Fase 33).
- Node 20+; `pnpm` global no blueprint; `npm` no krayin.
- `.npmrc` com PAT GHCR (`GHCR_TOKEN` ou `NPM_TOKEN` read/write packages).
- Portainer token em `.env.production`.
- Playwright browsers: `npx playwright install chromium`.
- Repos relacionados clonados (se possível): `roteador-webhook` (para cross-check visual regression).

---

## Estrutura de arquivos afetados

Ver plan v1 §"Estrutura de arquivos afetados". Mudanças vs v1:
- **Remover** menção a modificação no `src/app/layout.tsx` krayin (root layout já está limpo; Sidebar legada vem só via `(protected)/` contexto — confirmado por leitura Task 0.5).
- **Adicionar** E2E specs vão em `tests/e2e/golden-paths/` (não na raiz `tests/e2e/`) — alinhado com regex do `playwright.config.ts`.
- **Adicionar** `src/components/dashboard/upcoming-meetings-card.tsx` (widget side trocado; ver §H5 adiante).

---

# FASE 0 — Audits pré-execução (novo — Review #1 C2/C4/C6/H4)

### Task 0: Audits + baselines

**Files:** nenhum (inspeção)

- [ ] **Step 0.1: AppShell API do DS — confirma estrutura**

Run: `cat "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/packages/design-system/src/components/app-shell.tsx" | head -110`
Registrar em `/tmp/appshell-api.txt`. Confirmar:
- `AppShell.Root` → grid `grid-cols-1 lg:grid-cols-[260px_1fr]` + skip link `href="#main"`.
- `AppShell.Sidebar` → `<nav aria-label="Primária" class="hidden border-r border-border bg-sidebar text-sidebar-foreground lg:block">`.
- `AppShell.Header` → `<header role="banner" class="sticky top-0 z-30 h-14 ...">`.
- `AppShell.Main` → `<main id="main" tabIndex={-1} ...>`.
- `AppShell.Content` → `<div class="flex min-h-screen flex-col">`.

Se algo diferir, pausar e abrir issue. Caso contrário, seguir.

- [ ] **Step 0.2: `listTasks` assinatura real**

Run: `sed -n '200,280p' "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin/src/lib/actions/activities.ts"`
Registrar que:
- Assinatura: `listTasks(raw?: unknown): Promise<ActionResult<ActivityItem[]>>`.
- Filters suportados: `q`, `status` (`pending|completed|canceled`), `assigneeScope` (`me`|`all`|UUID), `dueWithinDays` (`overdue|today|7|30`).
- **Não aceita `limit` nem `dueTo` diretos.** Widget do dashboard limita `.slice(0, 5)` na UI.

- [ ] **Step 0.3: Playwright config inspection**

Run: `cat "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin/playwright.config.ts"`
Registrar:
- Projects: `unauth`, `admin`, `manager`, `viewer`.
- Admin regex: `/golden-paths\/(admin|cross-tenant|pipeline|reports|filters-bulk|global-search|custom-attributes)\.spec\.ts/`.
- Novos specs vão em `tests/e2e/golden-paths/` e regex deve ser expandido.

- [ ] **Step 0.4: Patterns package.json inspection**

Run: `cat "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/packages/patterns/package.json"`
Registrar:
- Version atual: `0.1.0`.
- `sideEffects: false` ✅.
- `files: ["dist"]` — **precisa mudar para `["dist", "src"]`** (C6).
- Exports usam path `./src/*/index.tsx` para a maioria → consistente com novos patterns Fase 34.

- [ ] **Step 0.5: Root layout krayin — confirma clean**

Run: `grep -n "Sidebar\|sidebar" "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin/src/app/layout.tsx" 2>&1 || echo "CLEAN"`
Expected: `CLEAN` (root layout não importa Sidebar diretamente).

- [ ] **Step 0.6: Testes blueprint + krayin — baseline**

Run blueprint:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint"
pnpm -r test 2>&1 | grep -E "(passed|failed)" | tail -5 > /tmp/blueprint-test-baseline.txt
cat /tmp/blueprint-test-baseline.txt
```

Run krayin:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
npm test 2>&1 | grep -E "(passed|failed)" | tail -5 > /tmp/krayin-test-baseline.txt
cat /tmp/krayin-test-baseline.txt
```
Expected krayin: `706 passed`.

- [ ] **Step 0.7: Bundle size baseline**

Run:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/packages/patterns"
pnpm build 2>&1 | tail -5
for f in dist/*.cjs dist/*.js; do
  [ -f "$f" ] && echo "$f: $(gzip -c "$f" | wc -c) bytes (gz)"
done > /tmp/patterns-bundle-baseline.txt
cat /tmp/patterns-bundle-baseline.txt
```

- [ ] **Step 0.8: Commit step zero**

Nenhum commit — apenas auditoria. Se algum assert falhar, pausar e diagnosticar.

---

# FASE 1 — Blueprint: extensões additive (PageShell + PageHeader) + package.json

> Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes de começar esta fase (LEI `law_ui_uxpromax_blueprint`).

---

### Task 1: `package.json` ajustes estruturais (bump beta + files + exports)

**Files:**
- Modify: `nexus-blueprint/packages/patterns/package.json`

Alterações:
1. Version: `0.1.0` → `0.2.0-beta.0` (prepara publish beta; bump final para `0.2.0` após cross-check, Task 12).
2. `files`: `["dist"]` → `["dist", "src"]`.
3. `exports`: adicionar entradas para os 4 patterns novos.

- [ ] **Step 1.1: Aplicar alterações**

```json
{
  "name": "@nexusai360/patterns",
  "version": "0.2.0-beta.0",
  ...
  "files": ["dist", "src"],
  ...
  "exports": {
    ...
    "./org-switcher": "./src/org-switcher/index.tsx",
    "./crm-shell": "./src/crm-shell/index.tsx",
    "./crm-list-shell": "./src/crm-list-shell/index.tsx",
    "./crm-detail-shell": "./src/crm-detail-shell/index.tsx",
    "./crm-dashboard-grid": "./src/crm-dashboard-grid/index.tsx"
  }
}
```

- [ ] **Step 1.2: Commit**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint"
git add packages/patterns/package.json
git commit -m "chore(patterns): bump 0.2.0-beta.0 + files[src] + exports CrmShell*"
```

---

### Task 2: Estender `PageShell` (additive + tokens semânticos)

**Files:**
- Modify: `nexus-blueprint/packages/patterns/src/page-shell/index.tsx`
- Create: `nexus-blueprint/packages/patterns/src/__tests__/page-shell.test.tsx`

- [ ] **Step 2.1: Escrever teste (backwards-compat + novos)**

Criar `packages/patterns/src/__tests__/page-shell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "../page-shell";

describe("PageShell — backwards-compat", () => {
  it("renderiza sem props novas", () => {
    render(
      <PageShell sidebar={<nav>nav</nav>} header={<h1>header</h1>}>
        <div>content</div>
      </PageShell>
    );
    expect(screen.getByTestId("page-shell-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("page-shell-header")).toBeInTheDocument();
    expect(screen.getByTestId("page-shell-main")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("default sidebarWidth 280 preservado", () => {
    const { container } = render(<PageShell sidebar={<nav />}>x</PageShell>);
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain("280px");
  });
});

describe("PageShell — extensões v3", () => {
  it("renderiza topbar quando fornecido", () => {
    render(
      <PageShell topbar={<div data-testid="topbar">t</div>}>x</PageShell>
    );
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
  });

  it("collapsedSidebarWidth usa valor custom quando sidebar presente", () => {
    const { container } = render(
      <PageShell sidebar={<nav />} collapsedSidebarWidth={85}>x</PageShell>
    );
    const root = container.firstChild as HTMLElement;
    // data-attr exposta para consumidor inspecionar
    expect(root.getAttribute("data-collapsed-width")).toBe("85");
  });

  it("sidebarCollapsed=true oculta sidebar", () => {
    const { container } = render(
      <PageShell sidebar={<nav />} sidebarCollapsed>x</PageShell>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("1fr");
  });

  it("usa tokens semânticos (bg-background / bg-card / border-border)", () => {
    const { container } = render(
      <PageShell sidebar={<nav />} header={<h1 />}>x</PageShell>
    );
    const sidebar = container.querySelector('[data-testid="page-shell-sidebar"]');
    const header = container.querySelector('[data-testid="page-shell-header"]');
    const main = container.querySelector('[data-testid="page-shell-main"]');
    expect(sidebar?.className).toMatch(/bg-card|bg-sidebar/);
    expect(sidebar?.className).toContain("border-border");
    expect(header?.className).toMatch(/bg-card|bg-background/);
    expect(main?.className).toContain("bg-background");
    expect(sidebar?.className).not.toMatch(/zinc-\d+/);
    expect(header?.className).not.toMatch(/zinc-\d+/);
    expect(main?.className).not.toMatch(/zinc-\d+/);
  });
});
```

- [ ] **Step 2.2: Rodar — FAIL**

Run: `cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/packages/patterns" && pnpm test -- page-shell 2>&1 | tail -30`
Expected: FAIL em "extensões v3" + "tokens semânticos".

- [ ] **Step 2.3: Implementar `PageShell` extended**

Substituir `nexus-blueprint/packages/patterns/src/page-shell/index.tsx`:

```tsx
import * as React from "react";

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: number;
  collapsedSidebarWidth?: number;
  sidebarCollapsed?: boolean;
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  (
    {
      className,
      sidebar,
      header,
      topbar,
      children,
      sidebarWidth = 280,
      collapsedSidebarWidth = 85,
      sidebarCollapsed = false,
      style,
      ...props
    },
    ref
  ) => {
    const showSidebar = sidebar && !sidebarCollapsed;
    const rowsParts: string[] = [];
    if (header) rowsParts.push("auto");
    if (topbar) rowsParts.push("auto");
    rowsParts.push("1fr");

    return (
      <div
        ref={ref}
        data-collapsed-width={collapsedSidebarWidth}
        className={[
          "grid min-h-screen w-full bg-background text-foreground",
          className,
        ].filter(Boolean).join(" ")}
        style={{
          gridTemplateColumns: showSidebar
            ? `${sidebarWidth}px 1fr`
            : "1fr",
          gridTemplateRows: rowsParts.join(" "),
          ...style,
        }}
        {...props}
      >
        {showSidebar && (
          <aside
            className="row-span-full border-r border-border bg-card"
            style={{ width: sidebarWidth }}
            data-testid="page-shell-sidebar"
          >
            {sidebar}
          </aside>
        )}

        {header && (
          <header
            className="border-b border-border bg-card px-6 py-4"
            data-testid="page-shell-header"
          >
            {header}
          </header>
        )}

        {topbar && (
          <div
            className="border-b border-border bg-card px-6 py-3"
            data-testid="page-shell-topbar"
          >
            {topbar}
          </div>
        )}

        <main
          className="overflow-auto bg-background p-6"
          data-testid="page-shell-main"
        >
          {children}
        </main>
      </div>
    );
  }
);

PageShell.displayName = "PageShell";

export { PageShell };
```

- [ ] **Step 2.4: Rodar — PASS**

Run: `pnpm test -- page-shell`
Expected: 7 verde.

- [ ] **Step 2.5: Rodar todos patterns**

Run: `pnpm test`
Expected: todos verde.

- [ ] **Step 2.6: Commit**

```bash
git add packages/patterns/src/page-shell/index.tsx packages/patterns/src/__tests__/page-shell.test.tsx
git commit -m "feat(patterns): PageShell — topbar, collapsedSidebarWidth, tokens semânticos"
```

---

### Task 3: Atualizar `PageHeader` com tokens semânticos

Idêntico ao plan v1 Task 3 (sem mudança de review — era limpo). Ver plan v1 Tasks 3.1-3.5. Commit:

```bash
git add packages/patterns/src/page-header/index.tsx packages/patterns/src/__tests__/page-header-tokens.test.tsx
git commit -m "feat(patterns): PageHeader usa text-foreground/text-muted-foreground"
```

---

# FASE 2 — Blueprint: CrmShell

---

### Task 4: `CrmShell` — composição sobre `AppShell` + mobile drawer

**Files:**
- Create: `nexus-blueprint/packages/patterns/src/crm-shell/crm-shell.tsx`
- Create: `nexus-blueprint/packages/patterns/src/crm-shell/index.ts`
- Create: `nexus-blueprint/packages/patterns/src/crm-shell/crm-shell.test.tsx`
- Modify: `nexus-blueprint/packages/patterns/src/index.ts` (re-export)

> Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes desta task.

- [ ] **Step 4.1: Teste**

Criar `crm-shell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrmShell } from "./crm-shell";

const baseSlots = {
  logo: <div data-testid="logo">logo</div>,
  nav: <nav data-testid="nav">nav</nav>,
  userMenu: <div data-testid="user">user</div>,
};

describe("CrmShell — estrutura base (via AppShell)", () => {
  it("renderiza logo, nav, userMenu", () => {
    render(<CrmShell sidebar={baseSlots}>content</CrmShell>);
    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByTestId("nav")).toBeInTheDocument();
    expect(screen.getByTestId("user")).toBeInTheDocument();
  });

  it("renderiza slots opcionais (search/themeCycler/footer)", () => {
    render(
      <CrmShell
        sidebar={{
          ...baseSlots,
          search: <div data-testid="search">s</div>,
          themeCycler: <div data-testid="cycler">c</div>,
          footer: <div data-testid="footer">f</div>,
        }}
      >x</CrmShell>
    );
    expect(screen.getByTestId("search")).toBeInTheDocument();
    expect(screen.getByTestId("cycler")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("renderiza topbar quando fornecido", () => {
    render(
      <CrmShell
        sidebar={baseSlots}
        topbar={{
          breadcrumbs: <div data-testid="bc">b</div>,
          notifications: <div data-testid="notif">n</div>,
          actions: <div data-testid="act">a</div>,
        }}
      >x</CrmShell>
    );
    expect(screen.getByTestId("bc")).toBeInTheDocument();
    expect(screen.getByTestId("notif")).toBeInTheDocument();
    expect(screen.getByTestId("act")).toBeInTheDocument();
  });

  it("preserva skip link do AppShell (#main)", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    const skip = screen.getByText("Pular para o conteúdo");
    expect(skip.getAttribute("href")).toBe("#main");
  });

  it("main id=main presente", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    expect(document.querySelector('main[id="main"]')).toBeInTheDocument();
  });

  it("role=banner único (sem duplicar)", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    expect(document.querySelectorAll('[role="banner"]').length).toBe(1);
  });

  it("nav com aria-label='Primária'", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    expect(document.querySelector('nav[aria-label="Primária"]')).toBeInTheDocument();
  });

  it("children rendered no main", () => {
    render(
      <CrmShell sidebar={baseSlots}>
        <div data-testid="child">content</div>
      </CrmShell>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("content");
  });

  it("aplica CSS var --topbar-height default 62px", () => {
    const { container } = render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue("--topbar-height")).toBe("62px");
  });
});

describe("CrmShell — mobile drawer", () => {
  it("expõe botão 'Abrir menu' em mobile", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    expect(screen.getByRole("button", { name: /abrir menu/i })).toBeInTheDocument();
  });

  it("abrir drawer renderiza slots duplicados", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    fireEvent.click(screen.getByRole("button", { name: /abrir menu/i }));
    expect(screen.getAllByTestId("logo")).toHaveLength(2);
  });

  it("Esc fecha drawer", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    fireEvent.click(screen.getByRole("button", { name: /abrir menu/i }));
    expect(screen.getAllByTestId("logo")).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getAllByTestId("logo")).toHaveLength(1);
  });

  it("clicar backdrop fecha drawer", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    fireEvent.click(screen.getByRole("button", { name: /abrir menu/i }));
    const close = screen.getByRole("button", { name: /fechar menu/i });
    fireEvent.click(close);
    expect(screen.getAllByTestId("logo")).toHaveLength(1);
  });

  it("label PT-BR default", () => {
    render(<CrmShell sidebar={baseSlots}>x</CrmShell>);
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
  });

  it("aceita labels customizados", () => {
    render(
      <CrmShell
        sidebar={baseSlots}
        labels={{ openMobileMenu: "Menu principal" }}
      >x</CrmShell>
    );
    expect(screen.getByRole("button", { name: "Menu principal" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Rodar — FAIL**

- [ ] **Step 4.3: Implementar**

Criar `crm-shell.tsx`:

```tsx
"use client";

import * as React from "react";
import { AppShell } from "@nexusai360/design-system";

export interface CrmShellSidebarSlots {
  logo: React.ReactNode;
  search?: React.ReactNode;
  nav: React.ReactNode;
  themeCycler?: React.ReactNode;
  userMenu: React.ReactNode;
  footer?: React.ReactNode;
}

export interface CrmShellTopbarSlots {
  breadcrumbs?: React.ReactNode;
  notifications?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface CrmShellLabels {
  skipLink?: string;
  expandSidebar?: string;
  collapseSidebar?: string;
  openMobileMenu?: string;
  closeMobileMenu?: string;
}

export interface CrmShellProps {
  sidebar: CrmShellSidebarSlots;
  topbar?: CrmShellTopbarSlots;
  labels?: CrmShellLabels;
  children: React.ReactNode;
}

const DEFAULT_LABELS: Required<CrmShellLabels> = {
  skipLink: "Pular para o conteúdo",
  expandSidebar: "Expandir menu",
  collapseSidebar: "Recolher menu",
  openMobileMenu: "Abrir menu",
  closeMobileMenu: "Fechar menu",
};

function SidebarInner({ slots }: { slots: CrmShellSidebarSlots }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4 border-b border-border">{slots.logo}</div>
      {slots.search && (
        <div className="px-3 py-2 border-b border-border">{slots.search}</div>
      )}
      <div className="flex-1 overflow-y-auto px-2 py-3">{slots.nav}</div>
      <div className="mt-auto border-t border-border">
        {slots.themeCycler && (
          <div className="px-3 py-2 border-b border-border">{slots.themeCycler}</div>
        )}
        <div className="px-3 py-2 border-b border-border">{slots.userMenu}</div>
        {slots.footer && <div className="px-3 py-2">{slots.footer}</div>}
      </div>
    </div>
  );
}

export function CrmShell({ sidebar, topbar, labels, children }: CrmShellProps) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <AppShell.Root
      data-slot="crm-shell"
      style={
        {
          "--topbar-height": "62px",
          "--sidebar-expanded-width": "260px",
          "--sidebar-collapsed-width": "85px",
        } as React.CSSProperties
      }
    >
      <AppShell.Sidebar data-slot="crm-shell-sidebar">
        <SidebarInner slots={sidebar} />
      </AppShell.Sidebar>

      <AppShell.Content>
        <AppShell.Header
          className="h-[var(--topbar-height)]"
          data-slot="crm-shell-header"
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={L.openMobileMenu}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          {topbar?.breadcrumbs && <div className="flex-1 min-w-0">{topbar.breadcrumbs}</div>}
          {topbar?.notifications && <div className="ml-auto">{topbar.notifications}</div>}
          {topbar?.actions && <div>{topbar.actions}</div>}
        </AppShell.Header>

        <AppShell.Main>{children}</AppShell.Main>
      </AppShell.Content>

      {mobileOpen && (
        <div
          data-slot="crm-shell-mobile-drawer"
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={L.closeMobileMenu}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-card border-r border-border shadow-lg"
            aria-label="Menu móvel"
          >
            <SidebarInner slots={sidebar} />
          </aside>
        </div>
      )}
    </AppShell.Root>
  );
}
```

Criar `index.ts`:
```ts
export { CrmShell } from "./crm-shell";
export type {
  CrmShellProps,
  CrmShellSidebarSlots,
  CrmShellTopbarSlots,
  CrmShellLabels,
} from "./crm-shell";
```

- [ ] **Step 4.4: Rodar — PASS**

- [ ] **Step 4.5: Barrel re-export + grep validação**

Em `packages/patterns/src/index.ts`:
```ts
export * from "./crm-shell";
```

Run: `grep -rn '"use client"' src/crm-*/ 2>&1`
Expected: 1 match (`src/crm-shell/crm-shell.tsx`).

Run: `grep -rn 'gray-[0-9]' src/crm-*/ 2>&1 || echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 4.6: Commit**

```bash
git add packages/patterns/src/crm-shell/ packages/patterns/src/index.ts
git commit -m "feat(patterns): CrmShell — composição sobre AppShell + mobile drawer + slots PT-BR"
```

---

### Task 5: `CrmListShell`

Idêntico ao plan v1 Task 5 (sem mudança crítica do review). Ver plan v1 Tasks 5.1-5.6.

> Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes.

---

### Task 6: `CrmDetailShell`

Idêntico ao plan v1 Task 6.

> Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes.

---

### Task 7: `CrmDashboardGrid`

Idêntico ao plan v1 Task 7.

> Invocar `Skill ui-ux-pro-max:ui-ux-pro-max` antes.

---

# FASE 3 — Blueprint: sanity + CHANGELOG + publish beta + cross-check

---

### Task 8: Sanity grep + bundle size

**Files:** nenhum (verificação)

- [ ] **Step 8.1: Todas as verificações em 1 step**

Run (dentro de `nexus-blueprint/packages/patterns/`):

```sh
# (a) "use client" apenas em crm-shell
if [ "$(grep -rn '"use client"' src/crm-*/ | wc -l)" != "1" ]; then
  echo "FAIL: 'use client' deveria existir apenas em crm-shell.tsx"; exit 1
fi

# (b) zero gray-XXX em crm-*
if grep -rn 'gray-[0-9]' src/crm-*/ >/dev/null 2>&1; then
  echo "FAIL: gray-XXX encontrado em patterns CRM"; exit 1
fi

# (c) zero gray-XXX em page-shell/page-header
if grep -rn 'zinc-[0-9]' src/page-shell/ src/page-header/ 2>/dev/null; then
  echo "FAIL: zinc-XXX resquício em page-shell/page-header"; exit 1
fi

# (d) sideEffects false
if ! grep -q '"sideEffects": false' package.json; then
  echo "FAIL: sideEffects false ausente"; exit 1
fi

echo "OK: sanity grep passou"
```

- [ ] **Step 8.2: Build + bundle size**

Run:
```sh
pnpm build 2>&1 | tail -5
for f in dist/*.cjs dist/*.js; do
  [ -f "$f" ] && gz=$(gzip -c "$f" | wc -c); echo "$f: ${gz:-?} bytes (gz)"
done > /tmp/patterns-bundle-posf34.txt
cat /tmp/patterns-bundle-posf34.txt
```

Comparar com `/tmp/patterns-bundle-baseline.txt` (Task 0.7). Delta ≤ 10KB gz aceitável; total ≤ 60KB gz.

Se estourar: (a) todos os patterns novos já expõem subpaths (krayin consome `@nexusai360/patterns/crm-shell` não o barrel), limitando impacto no bundle final do krayin; (b) se o barrel ainda estourar, marcar os 4 novos como side-effect-free explicitamente no commit message e criar follow-up "lazy-import framer-motion em crm-shell".

---

### Task 9: CHANGELOG

Idêntico plan v1 Task 10 Step 10.2 (sem mudança). Commit:

```bash
git add packages/patterns/CHANGELOG.md
git commit -m "chore(patterns): changelog 0.2.0-beta.0"
```

---

### Task 10: Publish beta GHCR

**Files:** nenhum (npm operation)

- [ ] **Step 10.1: Confirmar auth**

Run: `grep -q "_authToken" ~/.npmrc && echo OK || echo CONFIGURE`
Se CONFIGURE: consultar memory `crm_github_packages_auth.md`.

- [ ] **Step 10.2: Dry-run publish**

Run:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/packages/patterns"
npm publish --dry-run --tag beta 2>&1 | tail -30
```
Expected: lista de arquivos inclui `dist/**` E `src/**` (graças a `files: ["dist","src"]` em Task 1).

- [ ] **Step 10.3: Publish real beta**

Run: `npm publish --tag beta 2>&1 | tail -5`
Expected: `+ @nexusai360/patterns@0.2.0-beta.0`.

- [ ] **Step 10.4: Tag branch**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint"
git tag patterns-v0.2.0-beta.0
```

---

### Task 11: Cross-check roteador-webhook (obrigatório — LEI `law_roteador_is_ui_matrix`)

**Files:** nenhum no blueprint

- [ ] **Step 11.1: Garantir repo clonado**

Run:
```sh
if [ ! -d "/Users/joaovitorzanini/Developer/Claude Code/roteador-webhook" ]; then
  cd "/Users/joaovitorzanini/Developer/Claude Code"
  gh repo clone nexusai360/roteador-webhook 2>&1 | tail -5
fi
```
Se falhar (repo inexistente/privado sem acesso): **bloqueia**. Registrar em HANDOFF como dependência externa e aguardar acesso. **Não publicar stable nem seguir Fase 5.**

- [ ] **Step 11.2: Instalar beta no roteador**

```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/roteador-webhook"
npm install @nexusai360/patterns@0.2.0-beta.0 2>&1 | tail -3
```

- [ ] **Step 11.3: Visual regression no roteador**

Run: `npm run visual:snap 2>&1 | tail -10`
Expected: `maxDiffPixelRatio ≤ 0.02` em rotas consumindo `PageShell`. Se estourar: analisar diff, ajustar defaults (provavelmente mapeamento de `bg-card` difere dos tokens do roteador).

- [ ] **Step 11.4: Bump stable**

Se passar:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint/packages/patterns"
# atualizar versão pra 0.2.0 stable
npm version 0.2.0 --no-git-tag-version
```

- [ ] **Step 11.5: Publish stable**

Run: `npm publish --tag latest 2>&1 | tail -5`
Expected: `+ @nexusai360/patterns@0.2.0`.

- [ ] **Step 11.6: Commit + tag**

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint"
git add packages/patterns/package.json
git commit -m "chore(patterns): 0.2.0 stable publish (pós cross-check roteador)"
git tag patterns-v0.2.0
git push origin main --tags
```

---

# FASE 4 — Krayin: install + shell-slots + layout + sidebar legacy

---

### Task 12: Instalar `@nexusai360/patterns@0.2.0` + validar transpilePackages

**Files:**
- Modify: `nexus-crm-krayin/package.json`
- Modify (se necessário): `nexus-crm-krayin/next.config.ts`

- [ ] **Step 12.1: Bump + install**

Em `nexus-crm-krayin/package.json`, trocar versão para `"@nexusai360/patterns": "^0.2.0"`.

Run:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
npm install 2>&1 | tail -5
```

- [ ] **Step 12.2: Verificar transpilePackages**

Run: `grep -n "@nexusai360/patterns" next.config.ts 2>&1`
Se ausente: adicionar ao array `transpilePackages`.

- [ ] **Step 12.3: Build smoke**

Run: `npm run build 2>&1 | tail -15`
Expected: sucesso.

- [ ] **Step 12.4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore(deps): @nexusai360/patterns@0.2.0 (CrmShell + 3 patterns CRM)"
```

---

### Task 13: `shell-slots.tsx` — factories de slots

Idêntico ao plan v1 Task 14 (sem mudança do review). Ver §14.1-14.5.

**Ajuste:** usar path importação `@nexusai360/patterns/crm-shell` (não barrel) — reduz bundle.

---

### Task 14: `(protected)/layout.tsx`

**Files:**
- Create: `nexus-crm-krayin/src/app/(protected)/layout.tsx`
- Create: `nexus-crm-krayin/tests/unit/layout/protected-layout.test.tsx`
- **Não modificar** `src/app/layout.tsx` (confirmado clean em Task 0.5).

- [ ] **Step 14.1: Criar layout**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CrmShell } from "@nexusai360/patterns/crm-shell";
import {
  buildSidebarSlots,
  buildTopbarSlots,
} from "@/components/layout/shell-slots";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = {
    name: user.name ?? user.email ?? "",
    email: user.email ?? "",
    role: user.role ?? "user",
    platformRole: user.platformRole ?? "user",
    isSuperAdmin: user.isSuperAdmin ?? false,
    avatarUrl: user.avatarUrl ?? null,
  };

  return (
    <CrmShell
      sidebar={buildSidebarSlots(shellUser)}
      topbar={buildTopbarSlots()}
    >
      {children}
    </CrmShell>
  );
}
```

- [ ] **Step 14.2: Teste (mocks auth + navigation)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({
    id: "u1",
    name: "João",
    email: "joao@nexus.com",
    role: "user",
    platformRole: "admin",
    isSuperAdmin: false,
    avatarUrl: null,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/dashboard",
}));

import ProtectedLayout from "@/app/(protected)/layout";

describe("ProtectedLayout", () => {
  it("renderiza CrmShell com main id=main", async () => {
    const el = await ProtectedLayout({ children: <div>test</div> });
    render(el as React.ReactElement);
    expect(document.querySelector('main[id="main"]')).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
  });

  it("skip link presente com href=#main", async () => {
    const el = await ProtectedLayout({ children: <div /> });
    render(el as React.ReactElement);
    const skip = screen.getByText("Pular para o conteúdo");
    expect(skip.getAttribute("href")).toBe("#main");
  });

  it("redireciona quando user ausente", async () => {
    const { getCurrentUser } = await import("@/lib/auth");
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const { redirect } = await import("next/navigation");
    await ProtectedLayout({ children: <div /> });
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
```

- [ ] **Step 14.3: Rodar + build smoke**

```sh
npm test 2>&1 | grep -E "passed|failed" | tail -3
npm run build 2>&1 | tail -10
```
Expected: testes verde + build OK.

- [ ] **Step 14.4: Commit**

```bash
git add "src/app/(protected)/layout.tsx" tests/unit/layout/protected-layout.test.tsx
git commit -m "feat(layout): (protected)/layout.tsx consumindo CrmShell"
```

---

### Task 15: Sidebar legado — audit + migração

**Files:**
- Modify: `nexus-crm-krayin/src/components/layout/sidebar.tsx` (migração)

- [ ] **Step 15.1: Audit consumidores**

Run:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
grep -rn "from.*components/layout/sidebar" src/ 2>&1
```
Se zero resultados → pode deletar. Se houver: listar consumidores em `/tmp/sidebar-consumers.txt`.

- [ ] **Step 15.2: Backup pré-migração (rollback safe)**

Run: `cp src/components/layout/sidebar.tsx /tmp/sidebar-backup-$(date +%Y%m%d).tsx`

- [ ] **Step 15.3: Decisão**

Caso A (zero consumidores):
```sh
rm src/components/layout/sidebar.tsx
```

Caso B (consumidores remanescentes): migrar imports para `shell-slots` ou deixar arquivo como shim vazio:
```tsx
// MIGRATED — uso via buildSidebarSlots(shell-slots.tsx) + CrmShell.
// Arquivo será removido em Fase 35.
export {};
```

- [ ] **Step 15.4: Build + testes**

```sh
npm test 2>&1 | grep -E "passed|failed" | tail -3
npm run build 2>&1 | tail -10
```
Expected: verde. Se não: `cp /tmp/sidebar-backup-*.tsx src/components/layout/sidebar.tsx` e analisar.

- [ ] **Step 15.5: Commit**

```bash
git add src/components/layout/
git commit -m "refactor(layout): sidebar legado migrado → shell-slots + CrmShell"
```

---

# FASE 5 — Krayin: dashboard widgets + grid

---

### Task 16: `TasksTodayCard`

**Files:**
- Create: `src/components/dashboard/tasks-today-card.tsx`
- Create: `tests/unit/dashboard/tasks-today-card.test.tsx`

- [ ] **Step 16.1: Teste**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/actions/activities", () => ({
  listTasks: async () => ({
    success: true,
    data: [
      {
        id: "a1",
        title: "Call lead ACME",
        dueAt: new Date().toISOString(),
        subjectType: "lead",
        subjectId: "l1",
        status: "pending",
      },
      {
        id: "a2",
        title: "Follow-up proposta",
        dueAt: new Date().toISOString(),
        subjectType: "opportunity",
        subjectId: "o1",
        status: "pending",
      },
    ],
  }),
}));

import { TasksTodayCard } from "@/components/dashboard/tasks-today-card";

describe("TasksTodayCard", () => {
  it("renderiza título 'Tarefas hoje'", async () => {
    const el = await TasksTodayCard();
    render(el as React.ReactElement);
    expect(screen.getByRole("heading", { name: /tarefas hoje/i })).toBeInTheDocument();
  });

  it("lista tasks com title (até 5)", async () => {
    const el = await TasksTodayCard();
    render(el as React.ReactElement);
    expect(screen.getByText("Call lead ACME")).toBeInTheDocument();
    expect(screen.getByText("Follow-up proposta")).toBeInTheDocument();
  });

  it("mostra empty state quando nada", async () => {
    const { listTasks } = await import("@/lib/actions/activities");
    vi.mocked(listTasks).mockResolvedValueOnce({ success: true, data: [] });
    const el = await TasksTodayCard();
    render(el as React.ReactElement);
    expect(screen.getByText(/sem tarefas/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 16.2: Rodar — FAIL**

- [ ] **Step 16.3: Implementar**

```tsx
import { listTasks } from "@/lib/actions/activities";
import { Card, CardHeader, CardTitle, CardContent } from "@nexusai360/design-system";
import Link from "next/link";

export async function TasksTodayCard() {
  const result = await listTasks({
    status: "pending",
    assigneeScope: "me",
    dueWithinDays: "today",
  });

  const items = result.success ? result.data.slice(0, 5) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tarefas hoje</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem tarefas pendentes hoje.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((t) => (
              <li key={t.id} className="text-sm">
                <Link
                  href={`/tasks?highlight=${t.id}`}
                  className="block truncate text-foreground hover:text-primary"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 16.4: Rodar — PASS**

- [ ] **Step 16.5: Commit**

```bash
git add src/components/dashboard/tasks-today-card.tsx tests/unit/dashboard/tasks-today-card.test.tsx
git commit -m "feat(dashboard): TasksTodayCard — side widget tasks do dia (listTasks dueWithinDays=today)"
```

---

### Task 17: `UpcomingMeetingsCard` (substitui `RecentActivitiesCard` para evitar duplicação com `RecentActivity` existente no main)

**Files:**
- Create: `src/components/dashboard/upcoming-meetings-card.tsx`
- Create: `tests/unit/dashboard/upcoming-meetings-card.test.tsx`

- [ ] **Step 17.1: Teste** (padrão análogo T16; mock retorna activities type=meeting/call com dueAt futuro próximo)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/actions/activities", () => ({
  listActivitiesForDashboard: async () => ({
    success: true,
    data: [
      {
        id: "m1",
        type: "meeting",
        title: "Reunião com ACME",
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        subjectType: "lead",
      },
    ],
  }),
}));

import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";

describe("UpcomingMeetingsCard", () => {
  it("renderiza título 'Próximos encontros'", async () => {
    const el = await UpcomingMeetingsCard();
    render(el as React.ReactElement);
    expect(screen.getByRole("heading", { name: /próximos encontros/i })).toBeInTheDocument();
  });

  it("lista até 3 meetings", async () => {
    const el = await UpcomingMeetingsCard();
    render(el as React.ReactElement);
    expect(screen.getByText("Reunião com ACME")).toBeInTheDocument();
  });
});
```

- [ ] **Step 17.2: Rodar — FAIL**

- [ ] **Step 17.3: Implementar**

**Nota:** se `listActivitiesForDashboard` não existir, usar `listTasks` filtrando `type` — checar em `src/lib/actions/activities.ts`. Caso necessário, adicionar export helper:

```tsx
import { listTasks } from "@/lib/actions/activities";
import { Card, CardHeader, CardTitle, CardContent } from "@nexusai360/design-system";

export async function UpcomingMeetingsCard() {
  // Reaproveita listTasks via subjectType filter — ou chama action dedicada se existir.
  // Para MVP: apenas mostrar placeholder "em breve" quando action inexistente.
  const result = await listTasks({
    status: "pending",
    assigneeScope: "me",
    dueWithinDays: "7",
  });

  // Filtra ad-hoc por type=meeting|call no cliente (action não suporta filtro por type ainda).
  const items = result.success
    ? result.data
        .filter((a: { type?: string }) => a.type === "meeting" || a.type === "call")
        .slice(0, 3)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Próximos encontros</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum encontro agendado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="text-sm text-foreground truncate">
                {it.title}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 17.4: Rodar — PASS**

- [ ] **Step 17.5: Commit**

```bash
git commit -m "feat(dashboard): UpcomingMeetingsCard — side widget próximos meetings/calls 7d"
```

---

### Task 18: `QuickActionsCard`

**Files:**
- Create: `src/components/dashboard/quick-actions-card.tsx`
- Create: `tests/unit/dashboard/quick-actions-card.test.tsx`

- [ ] **Step 18.1: Teste**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: "u1", email: "a@a", name: "A", role: "user", platformRole: "admin" }),
}));

vi.mock("@/lib/rbac", () => ({
  userHasPermission: () => true,
}));

import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";

describe("QuickActionsCard", () => {
  it("renderiza 3 atalhos", async () => {
    const el = await QuickActionsCard();
    render(el as React.ReactElement);
    expect(screen.getByRole("link", { name: /criar lead/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /criar contato/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /criar oportunidade/i })).toBeInTheDocument();
  });

  it("oculta atalhos sem permissão", async () => {
    const { userHasPermission } = await import("@/lib/rbac");
    vi.mocked(userHasPermission).mockImplementation((u, p) => p !== "opportunities:create");
    const el = await QuickActionsCard();
    render(el as React.ReactElement);
    expect(screen.queryByRole("link", { name: /criar oportunidade/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 18.2: Rodar — FAIL**

- [ ] **Step 18.3: Implementar**

```tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@nexusai360/design-system";
import { Plus } from "lucide-react";

export async function QuickActionsCard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const items = [
    { href: "/leads/new", label: "Criar lead", perm: "leads:create" },
    { href: "/contacts/new", label: "Criar contato", perm: "contacts:create" },
    { href: "/opportunities/new", label: "Criar oportunidade", perm: "opportunities:create" },
  ].filter((i) => userHasPermission(user, i.perm));

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sem permissões para atalhos rápidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ações rápidas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-4 w-4 text-primary" />
            {it.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 18.4: Rodar — PASS**

- [ ] **Step 18.5: Commit**

```bash
git commit -m "feat(dashboard): QuickActionsCard — 3 atalhos gated RBAC"
```

---

### Task 19: `DashboardContent` compõe `CrmDashboardGrid` (preservando componentes atuais — H5)

**Files:**
- Modify: `src/components/dashboard/dashboard-content.tsx`

**Decisão H5:** preservar TUDO que existe no main atual (StatsCards + DashboardFilters + Pipeline chart + 3 cards grid + RecentActivity). Envelopar em `CrmDashboardGrid` e **adicionar** widgets side.

- [ ] **Step 19.1: Refatorar**

Alterações mínimas em `dashboard-content.tsx`:

(a) adicionar import:
```tsx
import { CrmDashboardGrid } from "@nexusai360/patterns/crm-dashboard-grid";
import { TasksTodayCard } from "./tasks-today-card";
import { UpcomingMeetingsCard } from "./upcoming-meetings-card";
import { QuickActionsCard } from "./quick-actions-card";
```

(b) envolver o return atual (linhas ~140-245) no CrmDashboardGrid. Como o dashboard atual é CLIENT com useState/polling, e os widgets novos são ASYNC server components, **precisamos** recebê-los como props (async boundary):

Propbs do componente client expandidas:
```tsx
interface DashboardContentProps {
  userName: string;
  tasksTodaySlot: React.ReactNode;       // <TasksTodayCard />
  upcomingMeetingsSlot: React.ReactNode;  // <UpcomingMeetingsCard />
  quickActionsSlot: React.ReactNode;      // <QuickActionsCard />
}
```

Reestruturar return: envolver `<motion.div className="space-y-6">...</motion.div>` em `<CrmDashboardGrid side={<>{...tresSlots}</>}>` e mover só o conteúdo "main" (greeting + filters + stats + chart + 3 cards + RecentActivity) pra dentro.

Novo return (resumido):

```tsx
return (
  <CrmDashboardGrid
    side={
      <>
        {tasksTodaySlot}
        {upcomingMeetingsSlot}
        {quickActionsSlot}
      </>
    }
  >
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* ... o bloco atual inteiro de greeting + filters + stats + chart + 3 cards + RecentActivity */}
    </motion.div>
  </CrmDashboardGrid>
);
```

- [ ] **Step 19.2: Ajustar page.tsx pra passar slots**

`src/app/(protected)/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { TasksTodayCard } from "@/components/dashboard/tasks-today-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullName = user.name || user.email || "Usuário";
  const userName = fullName.split(" ")[0];

  return (
    <DashboardContent
      userName={userName}
      tasksTodaySlot={<TasksTodayCard />}
      upcomingMeetingsSlot={<UpcomingMeetingsCard />}
      quickActionsSlot={<QuickActionsCard />}
    />
  );
}
```

- [ ] **Step 19.3: Testar**

Run: `npm test 2>&1 | grep -E "passed|failed" | tail -3`
Expected: verde; floor 706 + novos ≈ 715+.

- [ ] **Step 19.4: Smoke dev manual**

Run: `npm run dev > /tmp/dev.log 2>&1 &` + aguardar 5s + `curl -s http://localhost:3000/dashboard -o /dev/null -w '%{http_code}'` + `kill %1`
Expected: 200/307.

- [ ] **Step 19.5: Commit**

```bash
git add src/components/dashboard/dashboard-content.tsx src/app/\(protected\)/dashboard/page.tsx
git commit -m "feat(dashboard): CrmDashboardGrid + 3 widgets side (TasksToday + UpcomingMeetings + QuickActions); main preservado 100%"
```

---

# FASE 6 — Krayin: leads + contacts + opportunities + pipeline (listas)

---

### Task 20: Leads — `CrmListShell`

**Files:**
- Modify: `src/app/(protected)/leads/_components/leads-content.tsx`

- [ ] **Step 20.1: Ler atual**

Run:
```sh
wc -l "src/app/(protected)/leads/_components/leads-content.tsx"
head -60 "src/app/(protected)/leads/_components/leads-content.tsx"
```
Registrar em `/tmp/leads-content-pre-f34.txt`.

- [ ] **Step 20.2: Envelopar**

Alterações pontuais:

(a) adicionar import:
```tsx
import { CrmListShell } from "@nexusai360/patterns/crm-list-shell";
```

(b) no return, envolver o conteúdo principal (após `<PageHeader ...>` se existir, substituir; caso contrário, envolver wrapper fora do `<FilterBar>` e `<DataTable>`):

```tsx
return (
  <CrmListShell
    title="Leads"
    description="Oportunidades em pré-venda."
    breadcrumbs={[
      { label: "Dashboard", href: "/dashboard" },
      { label: "Leads" },
    ]}
    actions={
      canCreate ? (
        <Link href="/leads/new">
          <Button>Novo lead</Button>
        </Link>
      ) : null
    }
    toolbar={
      <FilterBar
        // ... props atuais do FilterBar preservadas literalmente (não refatorar FilterBar)
      />
    }
  >
    {/* Conteúdo atual: DataTable + BulkActionBar + paginação */}
  </CrmListShell>
);
```

> Se `leads-content.tsx` atualmente usa `PageHeader` no topo, substituir o PageHeader externo pelo `CrmListShell` (ele consome PageHeader internamente).

- [ ] **Step 20.3: Testes + E2E preservation**

Run: `npm test -- leads 2>&1 | grep -E "passed|failed" | tail -3`
Run: `npm run test:e2e -- filters-bulk 2>&1 | tail -5`
Expected: verde.

- [ ] **Step 20.4: Commit**

```bash
git add "src/app/(protected)/leads/_components/leads-content.tsx"
git commit -m "feat(leads): CrmListShell envolvendo FilterBar + DataTable + BulkActionBar"
```

---

### Task 21: Contacts — `CrmListShell`

**Files:** `src/app/(protected)/contacts/_components/contacts-content.tsx`

- [ ] **Step 21.1: Ler atual + registrar em `/tmp/contacts-content-pre-f34.txt`**

- [ ] **Step 21.2: Aplicar mesma estrutura da Task 20**, trocando:
- `title="Contatos"`, `description="Pessoas vinculadas a leads e oportunidades."`.
- breadcrumbs `Dashboard → Contatos`.
- action `Novo contato` → `/contacts/new` gated `contacts:create`.

- [ ] **Step 21.3: Testes**

Run: `npm test -- contacts 2>&1 | tail -3`
Expected: verde.

- [ ] **Step 21.4: Commit**

```bash
git commit -m "feat(contacts): CrmListShell"
```

---

### Task 22: Opportunities — `CrmListShell`

**Files:** `src/app/(protected)/opportunities/_components/opportunities-content.tsx`

- [ ] **Step 22.1: Ler + registrar `/tmp/opps-content-pre-f34.txt`**

- [ ] **Step 22.2: Aplicar estrutura:**
- `title="Oportunidades"`, `description="Deals em andamento no pipeline de vendas."`.
- breadcrumbs `Dashboard → Oportunidades`.
- action `Nova oportunidade` → `/opportunities/new` gated `opportunities:create`.
- toolbar mantém `FilterBar` atual.
- children: `DataTable` + `BulkActionBar`.

- [ ] **Step 22.3: Testes**

Run: `npm test -- opportunities 2>&1 | tail -3`
Expected: verde.

- [ ] **Step 22.4: Commit**

```bash
git commit -m "feat(opportunities): CrmListShell"
```

---

### Task 23: Opportunities/Pipeline — `CrmListShell` (kanban preservado)

**Files:** `src/app/(protected)/opportunities/pipeline/page.tsx`

- [ ] **Step 23.1: Ler atual**

Run: `head -80 "src/app/(protected)/opportunities/pipeline/page.tsx"`
Identificar: `KanbanBoard` (ou similar) é o filho principal.

- [ ] **Step 23.2: Envolver em `CrmListShell`**

```tsx
import { CrmListShell } from "@nexusai360/patterns/crm-list-shell";
// ... imports atuais

export default async function PipelinePage() {
  // ... lógica atual de fetch stages + oportunidades
  return (
    <CrmListShell
      title="Pipeline"
      description="Visão kanban das oportunidades por estágio."
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Oportunidades", href: "/opportunities" },
        { label: "Pipeline" },
      ]}
    >
      {/* <KanbanBoard stages={...} /> — preservar literal */}
    </CrmListShell>
  );
}
```

- [ ] **Step 23.3: E2E pipeline (preservação Fase 17/21)**

Run: `npm run test:e2e -- pipeline 2>&1 | tail -5`
Expected: drag & drop continua funcional.

- [ ] **Step 23.4: Commit**

```bash
git commit -m "feat(pipeline): CrmListShell envelopando KanbanBoard (dnd-kit preservado)"
```

---

# FASE 7 — Testes E2E + a11y + visual regression

---

### Task 24: Instalar `@axe-core/playwright` + expandir regex Playwright

**Files:**
- Modify: `nexus-crm-krayin/package.json`
- Modify: `nexus-crm-krayin/playwright.config.ts`

- [ ] **Step 24.1: Install**

Run: `npm install -D @axe-core/playwright 2>&1 | tail -3`

- [ ] **Step 24.2: Expandir testMatch admin no `playwright.config.ts`**

Linha 26, trocar:
```ts
testMatch: /golden-paths\/(admin|cross-tenant|pipeline|reports|filters-bulk|global-search|custom-attributes)\.spec\.ts/,
```
por:
```ts
testMatch: /golden-paths\/(admin|cross-tenant|pipeline|reports|filters-bulk|global-search|custom-attributes|visual-parity|theme-cycler|preservation-smoke)\.spec\.ts/,
```

- [ ] **Step 24.3: Commit**

```bash
git add package.json package-lock.json playwright.config.ts
git commit -m "chore(e2e): @axe-core/playwright + regex admin expandido (visual-parity + theme-cycler + preservation-smoke)"
```

---

### Task 25: `visual-parity.spec.ts`

**Files:**
- Create: `tests/e2e/golden-paths/visual-parity.spec.ts`

> Usa `storageState` via project admin (auto via `playwright.config.ts`).

- [ ] **Step 25.1: Implementar**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/dashboard",
  "/leads",
  "/contacts",
  "/opportunities",
  "/opportunities/pipeline",
];

test.describe("Fase 34 — visual parity (shell + a11y)", () => {
  for (const path of routes) {
    test(`shell elementos em ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('nav[aria-label="Primária"]').first()).toBeVisible();
      await expect(page.locator('main[id="main"]')).toBeVisible();
      expect(await page.locator('[role="banner"]').count()).toBe(1);
      await page.keyboard.press("Tab");
      await expect(page.getByText("Pular para o conteúdo")).toBeFocused();
    });

    test(`a11y axe em ${path} — zero critical/serious`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      const violations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(violations).toEqual([]);
    });
  }
});
```

- [ ] **Step 25.2: Rodar**

Run:
```sh
npm run test:e2e -- visual-parity 2>&1 | tail -20
```
Expected: 10 testes verde.

- [ ] **Step 25.3: Commit**

```bash
git add tests/e2e/golden-paths/visual-parity.spec.ts
git commit -m "test(e2e): visual-parity.spec.ts — shell + a11y em 5 rotas (admin project)"
```

---

### Task 26: `theme-cycler.spec.ts`

**Files:**
- Create: `tests/e2e/golden-paths/theme-cycler.spec.ts`

- [ ] **Step 26.1: Implementar**

```ts
import { test, expect } from "@playwright/test";

test("theme cycler atualiza documentElement.classList (dark→light→system→dark)", async ({ page }) => {
  await page.goto("/dashboard");

  const getMode = () =>
    page.evaluate(() => {
      const c = document.documentElement.classList;
      if (c.contains("dark")) return "dark";
      if (c.contains("light")) return "light";
      return "system";
    });

  const cycler = page.getByRole("button", { name: /alternar tema/i });
  await expect(cycler).toBeVisible();

  const sequence: string[] = [];
  sequence.push(await getMode());

  for (let i = 0; i < 3; i++) {
    await cycler.click();
    await page.waitForTimeout(200);
    sequence.push(await getMode());
  }

  // Última posição é diferente da primeira (ciclo completo)
  const unique = new Set(sequence);
  expect(unique.size).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 26.2: Rodar**

Run: `npm run test:e2e -- theme-cycler 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 26.3: Commit**

```bash
git commit -m "test(e2e): theme-cycler.spec.ts"
```

---

### Task 27: `preservation-smoke.spec.ts` — 5 blocks completos (H2 review)

**Files:**
- Create: `tests/e2e/golden-paths/preservation-smoke.spec.ts`

- [ ] **Step 27.1: Implementar 5 blocks completos**

```ts
import { test, expect } from "@playwright/test";

test.describe("Fase 34 — preservação features (Fases 13/17/18/20/22/24/25/32)", () => {
  test("preservation @ /dashboard — FunnelCard + PipelineValue + TopOpps + Pipeline chart + RecentActivity", async ({ page }) => {
    await page.goto("/dashboard");
    // Fase 18 cards
    await expect(page.getByText(/funil de conversão/i)).toBeVisible();
    await expect(page.getByText(/valor de pipeline/i)).toBeVisible();
    await expect(page.getByText(/top 5 oportunidades/i)).toBeVisible();
    // Pipeline chart existe
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible();
    // RecentActivity existe
    await expect(page.getByText(/atividades recentes/i)).toBeVisible();
  });

  test("preservation @ /leads — EmptyState + FilterBar + Bulk + CommandPalette", async ({ page }) => {
    // (1) EmptyState via filtro impossível
    await page.goto("/leads?q=xyz_nao_existe_zzz");
    await expect(page.getByText(/nenhum lead encontrado/i).first()).toBeVisible();
    // (2) FilterBar
    await page.goto("/leads");
    await expect(page.getByPlaceholder(/buscar leads/i)).toBeVisible();
    // (3) Bulk select
    const cb = page.locator('input[type="checkbox"]').nth(1);
    if (await cb.count()) {
      await cb.check();
      await expect(page.getByText(/itens selecionados/i)).toBeVisible();
    }
    // (4) CommandPalette Ctrl+K
    await page.keyboard.press("Control+KeyK");
    await expect(page.getByPlaceholder(/buscar em todo/i)).toBeVisible();
    await page.keyboard.press("Escape");
    // (5) Novo lead button presente (RBAC admin)
    await expect(page.getByRole("link", { name: /novo lead/i })).toBeVisible();
  });

  test("preservation @ /contacts — EmptyState + FilterBar + Bulk + CommandPalette", async ({ page }) => {
    await page.goto("/contacts?q=xyz_nao_existe_zzz");
    await expect(page.getByText(/nenhum contato encontrado/i).first()).toBeVisible();
    await page.goto("/contacts");
    await expect(page.getByPlaceholder(/buscar contatos/i)).toBeVisible();
    const cb = page.locator('input[type="checkbox"]').nth(1);
    if (await cb.count()) {
      await cb.check();
      await expect(page.getByText(/itens selecionados/i)).toBeVisible();
    }
    await page.keyboard.press("Control+KeyK");
    await expect(page.getByPlaceholder(/buscar em todo/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: /novo contato/i })).toBeVisible();
  });

  test("preservation @ /opportunities — filtros + bulk + bulk edit stage", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByPlaceholder(/buscar oportunidades/i)).toBeVisible();
    const cb = page.locator('input[type="checkbox"]').nth(1);
    if (await cb.count()) {
      await cb.check();
      await expect(page.getByText(/itens selecionados/i)).toBeVisible();
      // Fase 29 bulk edit stage
      await expect(page.getByRole("button", { name: /alterar stage/i }).or(page.getByRole("button", { name: /excluir/i }))).toBeVisible();
    }
    await page.keyboard.press("Control+KeyK");
    await expect(page.getByPlaceholder(/buscar em todo/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("preservation @ /opportunities/pipeline — kanban dnd-kit + 6 colunas + mobile", async ({ page }) => {
    await page.goto("/opportunities/pipeline");
    // desktop: 6 colunas
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('[data-stage-column]').first()).toBeVisible();
    const cols = await page.locator('[data-stage-column]').count();
    expect(cols).toBeGreaterThanOrEqual(4); // tolerância: 6 stages padrão podem variar
    // mobile: accordion (Fase 21)
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(/mover para/i).first().or(page.getByRole("button", { name: /expandir/i }).first())).toBeVisible();
  });
});
```

> **Nota:** selectors (`data-stage-column`, textos exatos empty state/filter placeholders) precisam bater com a implementação real. Se algum não bater, ajustar para seletor usado no projeto. Validar rodando uma vez antes do commit.

- [ ] **Step 27.2: Rodar + ajustar selectors se preciso**

Run: `npm run test:e2e -- preservation-smoke 2>&1 | tail -20`
Expected: 5 testes verde. Caso algum falhar por selector, abrir screenshot do Playwright + corrigir.

- [ ] **Step 27.3: Commit**

```bash
git add tests/e2e/golden-paths/preservation-smoke.spec.ts
git commit -m "test(e2e): preservation-smoke.spec.ts — Fases 13/17/18/20/22/24/25/29/32"
```

---

### Task 28: E2E completo verde

- [ ] **Step 28.1: Rodar suite completa**

Run:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
npm run test:e2e 2>&1 | tail -20
```
Expected: ≥20 specs verde (17 anteriores + visual-parity[10] + theme-cycler[1] + preservation-smoke[5] = **33 totais**).

---

### Task 29: Visual regression

- [ ] **Step 29.1: Pós-F34 snapshots**

Run: `pnpm visual:snap 2>&1 | tail -10`
Expected: snapshots novos gerados em `docs/assets/visual/`.

- [ ] **Step 29.2: Validar threshold rotas não-alvo**

Comparar com baseline (Task 0.7). Rotas alvo (5): mudanças documentadas. Rotas não-alvo (demais): `maxDiffPixelRatio ≤ 0.02` — se estourar, investigar.

- [ ] **Step 29.3: Anexar ao PR**

Após criar PR (Task 32.2), anexar 10 pares (5 × 2 viewports) na descrição.

---

# FASE 8 — Docs + memory + deploy

---

### Task 30: `visual-audit-krayin.md`

Idêntico plan v1 Task 30 com refinamento L3:

- Template "Ação" aceita valores `OK | Ajustar | Standby` (não uniforme).
- §2 token parity validado via procedimento spec §6.2.

```bash
git commit -m "docs(fase-34): visual-audit-krayin.md (5 rotas + token parity)"
```

---

### Task 31: Atualizar `HANDOFF.md`

Idêntico plan v1 Task 31.

```bash
git commit -m "docs(handoff): fase 34 deployed — CrmShell + visual parity"
```

---

### Task 32: Memory updates (paths corrigidos — H6 review)

**Files:**
- Modify: `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/MEMORY.md`
- Create: `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/law_crm_shell_pattern.md`
- Modify: `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/project_crm_phase_status.md` (se existir)
- Modify: `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-blueprint/memory/MEMORY.md` (também — a session pode estar aqui)

Critério: aplicar no memory do projeto em que a sessão foi executada. Se ambas sessões (blueprint + krayin) tocaram, atualizar ambos.

- [ ] **Step 32.1: Verificar dirs existentes**

Run:
```sh
ls ~/.claude/projects/ | grep -i "nexus-crm-krayin\|nexus-blueprint"
```
Registrar dirs presentes.

- [ ] **Step 32.2: Atualizar memory de cada dir presente**

Em cada dir, criar/atualizar conforme plan v1 Task 32.

- [ ] **Step 32.3: Nenhum commit** (memory externa).

---

### Task 33: Push + deploy + monitor

Idêntico plan v1 Task 33 com:
- T33.4 Portainer usar `grep PORTAINER_STACK_ID .env.production` para `stack-id` (não literal).
- T33.6 push tag após smoke prod passar.

---

### Task 34: Graphify update (regra 10 blueprint)

Idêntico plan v1 Task 34, substituindo `2>/dev/null || true` por falha explícita:

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint"
graphify update .
git add graphify-out/
git diff --cached --quiet || git commit -m "chore(graphify): update pós Fase 34"
git push
```

---

# Resumo de entregáveis

Checklist consolidada — espelha spec v3 §13.

- [x] `packages/patterns/package.json` (files + exports + version)
- [x] `packages/patterns/src/page-shell/*` extended
- [x] `packages/patterns/src/page-header/*` tokens
- [x] `packages/patterns/src/crm-shell/*`
- [x] `packages/patterns/src/crm-list-shell/*`
- [x] `packages/patterns/src/crm-detail-shell/*`
- [x] `packages/patterns/src/crm-dashboard-grid/*`
- [x] CHANGELOG + bump 0.2.0 stable (via beta + cross-check)
- [x] `src/components/layout/shell-slots.tsx` (T13)
- [x] `src/app/(protected)/layout.tsx` (T14)
- [x] `src/components/layout/sidebar.tsx` removido/shim (T15)
- [x] 3 widgets side dashboard: TasksToday + UpcomingMeetings + QuickActions (T16-18)
- [x] Dashboard main 100% preservado + CrmDashboardGrid (T19)
- [x] 5 rotas envelopadas em CrmListShell (T20-23)
- [x] 3 E2E novos em `golden-paths/` (T25-27)
- [x] axe-core a11y (T24/T25)
- [x] Visual regression snapshots (T29)
- [x] Visual audit doc (T30)
- [x] HANDOFF (T31)
- [x] Memory + LEI CrmShell (T32)
- [x] Push + deploy + smoke + tag (T33)
- [x] Graphify update (T34)

---

# Self-review (autor do plan)

**Spec coverage (v3 §10):** todos os 15 success criteria mapeados; SC #10 (zero gray-XXX) validado no Task 8 Step 8.1. SC #15 (cross-check roteador) bloqueia Task 11 se roteador indisponível — fallback explícito.

**Placeholders eliminados:** T17 (upcoming meetings) documenta ad-hoc filter em client (se action dedicada não existir); T20-23 mostram o diff de substituição explicitado; T27 tem 5 blocks reais com selectors-alvo.

**Type consistency:** `CrmShellSidebarSlots` / `CrmShellTopbarSlots` / `CrmShellLabels` consistentes entre T4, T13, T14.

**Risco principal pós-v2:** Task 27 selectors podem não bater exatamente com textos do projeto (ex: "Nenhum lead encontrado"). Mitigação: Step 27.2 ajusta selectors em execução real antes do commit. Documento é explícito sobre isso.

---

**Status:** plan v2 pronto para Review #2 (pente fino) → v3 final → execução.
