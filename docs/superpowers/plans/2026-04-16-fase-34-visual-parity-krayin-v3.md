# Fase 34 — Visual Parity com Krayin Original (Parte A) — Plan v3 FINAL

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Este documento é auto-suficiente. Plans v1/v2 ficam como histórico.

**Goal:** Alinhar visualmente 5 rotas do `nexus-crm-krayin` (dashboard, leads, contacts, opportunities, pipeline) ao Krayin original via 4 patterns novos no `nexus-blueprint` + 2 extensões additive. Preserva 100% das features de Fases 13/17/18/20/22/24/25/32.

**Architecture:** Patterns blueprint são composição sobre primitivos existentes (`AppShell` do DS, `PageHeader` do patterns). `CrmShell` encapsula motion do mobile drawer; slots são nós inertes. Brand violeta Nexus via `--primary` do DS. Krayin consome via `(protected)/layout.tsx` + factory `shell-slots.tsx`. Páginas preservam estrutura atual; apenas envelopam em wrapper pattern.

**Tech Stack:** Next 16 (App Router, RSC), React 19, TypeScript, Tailwind CSS, Radix, `@nexusai360/design-system@0.3.0`, `@nexusai360/patterns@0.2.0` (publish desta fase), `@nexusai360/ui`, Vitest, Playwright + `@axe-core/playwright`, framer-motion (krayin-side).

**Spec:** `docs/superpowers/specs/2026-04-16-fase-34-visual-parity-krayin-v3.md` (skip link ID canônico `#main` — corrigido pós Review #2 PF1).

**Diffs aplicados neste v3 vs v2 (Review #2 pente fino):**

| # | Review findings | Localização | Fix |
|---|---|---|---|
| PF1 | Spec `#conteudo` → `#main` | Spec v3 §5.3/§8/§10 | Spec patchada (concluído antes do v3). |
| PF2 | `setViewportSize` após `goto` | Task 27 preservation-smoke | Reordenar viewport ANTES de goto; split em 2 testes quando necessário. |
| PF3 | Async RSC como slot sem Suspense | Task 19 `page.tsx` dashboard | Envelopar cada slot async em `<Suspense fallback={<CardSkeleton/>}>`. |
| PF4 | Tag beta órfã | Task 11 publish stable | Pós-stable: `git tag -d patterns-v0.2.0-beta.0`. |
| PF5 | T5/T6/T7 sem clause tokens | Tasks 5/6/7 testes | Tests incluem `not.toMatch(/\bbg-white\b/)` e `toMatch(/bg-card\|bg-background/)`. |
| PF6 | Fallback bundle cita framer-motion erradamente | Task 8 | framer-motion é client-only no krayin; pattern blueprint NÃO usa. Fallback reescrito. |
| PF7 | T14.2 sem assert nav | Task 14 test | `expect(document.querySelector('nav[aria-label="Primária"]')).toBeInTheDocument()`. |
| PF8 | T15.1 sem grep `getNavItems` | Task 15.1 | Adicionar `grep -rn "import.*getNavItems" src/`. |
| PF9 | `waitForTimeout(200)` antipattern | Task 26 theme-cycler | Substituir por `waitForFunction` sobre `documentElement.classList`. |
| PF10 | T27 selectors adivinhados | Task 27 preservation-smoke | Step 27.0 novo: grep textos reais no codebase. |
| PF11 | Target Playwright uniforme | Task 28 / Success criteria | Declarar: "**33 target, ≥33 required**". |

---

## Estrutura + pré-requisitos

Idênticos ao plan v2 §"Estrutura de arquivos afetados" + §"Pré-requisitos". Não reproduzir aqui para economia; executor consulta plan v2 se faltar contexto.

---

# FASE 0 — Audits pré-execução

**Tasks 0.1 a 0.8** idênticas ao plan v2. Nenhum diff pós Review #2.

---

# FASE 1 — Blueprint: PageShell + PageHeader + package.json

**Tasks 1 (package.json bump + files + exports), 2 (PageShell extended), 3 (PageHeader tokens)** — idênticas ao plan v2.

---

# FASE 2 — Blueprint: CrmShell + CrmListShell + CrmDetailShell + CrmDashboardGrid

### Task 4: `CrmShell`
Idêntica ao plan v2 Task 4 (já cobre mobile drawer + landmarks únicos + `#main` via AppShell).

### Task 5: `CrmListShell` — **DIFF v3 (PF5):**

Adicionar ao teste de Step 5.1 os asserts de token (dentro do bloco `describe("CrmListShell", ...)`):

```tsx
it("header card usa bg-card, NÃO bg-white", () => {
  const { container } = render(<CrmListShell title="x">y</CrmListShell>);
  const card = container.querySelector('[data-slot="crm-list-header"]');
  expect(card?.className).toMatch(/bg-card|bg-background/);
  expect(card?.className).not.toMatch(/\bbg-white\b/);
});
```

Implementação Step 5.3 permanece `bg-card` (já estava correto). Restante idêntico v2.

### Task 6: `CrmDetailShell` — **DIFF v3 (PF5):**

Adicionar ao teste Step 6.1:

```tsx
it("left panel usa bg-card, NÃO bg-white", () => {
  const { container } = render(<CrmDetailShell left={<span />} right={<span />} />);
  const aside = container.querySelector('aside[data-slot="crm-detail-left"]');
  expect(aside?.className).toMatch(/bg-card/);
  expect(aside?.className).not.toMatch(/\bbg-white\b/);
});
```

Restante idêntico v2.

### Task 7: `CrmDashboardGrid` — **DIFF v3 (PF5):**

Adicionar ao teste Step 7.1:

```tsx
it("grid não hardcoda cores brancas", () => {
  const { container } = render(<CrmDashboardGrid>x</CrmDashboardGrid>);
  expect(container.innerHTML).not.toMatch(/\bbg-white\b/);
});
```

Restante idêntico v2.

---

# FASE 3 — Blueprint: sanity + CHANGELOG + publish beta + cross-check

### Task 8: Sanity grep + bundle — **DIFF v3 (PF6):**

Step 8.2 fallback reescrito:

> Se bundle blueprint estourar 60KB gz:
> 1. Confirmar que krayin consome via subpaths (`@nexusai360/patterns/crm-shell` etc.) — o barrel não afeta bundle runtime do krayin.
> 2. Validar tree-shaking com `sideEffects: false` (já presente).
> 3. **Nota:** `framer-motion` NÃO é dep do pattern CRM — ele vive no krayin (`shell-slots.tsx` client). Portanto "lazy-import framer-motion" não aplica ao pattern.
> 4. Se apesar de (1) e (2) o barrel ainda estourar: investigar imports indiretos via `@nexusai360/ui` e abrir follow-up específico (fase dedicada a barrel split).

### Tasks 9 (CHANGELOG), 10 (publish beta) — idênticas v2.

### Task 11: Cross-check roteador — **DIFF v3 (PF4):**

Step 11.6 expandido:

```bash
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint"
git add packages/patterns/package.json
git commit -m "chore(patterns): 0.2.0 stable publish (pós cross-check roteador)"
# Cleanup tag beta após stable promover com sucesso
git tag -d patterns-v0.2.0-beta.0 2>/dev/null || true
git tag patterns-v0.2.0
git push origin main --tags
```

Restante idêntico v2.

---

# FASE 4 — Krayin: install + shell-slots + layout + sidebar legacy

### Task 12: Install patterns@0.2.0 — idêntica v2.

### Task 13: `shell-slots.tsx` — idêntica v2.
Nota informativa adicionada: framer-motion é import client-only neste arquivo do krayin — não propaga pro bundle do pattern blueprint.

### Task 14: `(protected)/layout.tsx` — **DIFF v3 (PF7):**

Step 14.2 teste expandido: adicionar no bloco `describe`:

```tsx
it("renderiza nav Primária (slots montados)", async () => {
  const el = await ProtectedLayout({ children: <div /> });
  render(el as React.ReactElement);
  expect(document.querySelector('nav[aria-label="Primária"]')).toBeInTheDocument();
});
```

Restante idêntico v2.

### Task 15: Sidebar legado — **DIFF v3 (PF8):**

Step 15.1 ampliado:

```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
# (a) Audit consumidores de sidebar.tsx
grep -rn "from.*components/layout/sidebar" src/ 2>&1 > /tmp/sidebar-consumers.txt

# (b) Audit de getNavItems (garantir shell-slots.tsx é consumer único pós-migração)
grep -rn "import.*getNavItems" src/ | wc -l
# Esperado: 1 match (shell-slots.tsx) após Task 13. Se >1: auditar consumidores restantes.

# (c) Backup
cp src/components/layout/sidebar.tsx /tmp/sidebar-backup-$(date +%Y%m%d).tsx
```

Restante idêntico v2.

---

# FASE 5 — Krayin: dashboard

### Task 16: `TasksTodayCard` — idêntica v2.
### Task 17: `UpcomingMeetingsCard` — idêntica v2.
### Task 18: `QuickActionsCard` — idêntica v2.

### Task 19: `DashboardContent` + `page.tsx` — **DIFF v3 (PF3):**

Step 19.2 atualizado — adicionar `<Suspense fallback>` envolvendo cada slot async:

```tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { TasksTodayCard } from "@/components/dashboard/tasks-today-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { Card, CardContent, CardHeader } from "@nexusai360/design-system";

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-3 w-2/4 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullName = user.name || user.email || "Usuário";
  const userName = fullName.split(" ")[0];

  return (
    <DashboardContent
      userName={userName}
      tasksTodaySlot={
        <Suspense fallback={<CardSkeleton />}>
          <TasksTodayCard />
        </Suspense>
      }
      upcomingMeetingsSlot={
        <Suspense fallback={<CardSkeleton />}>
          <UpcomingMeetingsCard />
        </Suspense>
      }
      quickActionsSlot={
        <Suspense fallback={<CardSkeleton />}>
          <QuickActionsCard />
        </Suspense>
      }
    />
  );
}
```

Restante idêntico v2.

---

# FASE 6 — Krayin: leads + contacts + opportunities + pipeline

### Tasks 20-23 — idênticas v2.

---

# FASE 7 — Testes E2E + a11y + visual regression

### Task 24: Playwright config + axe — idêntica v2.

### Task 25: `visual-parity.spec.ts` — idêntica v2.

### Task 26: `theme-cycler.spec.ts` — **DIFF v3 (PF9):**

Step 26.1 reescrito sem `waitForTimeout`:

```ts
import { test, expect } from "@playwright/test";

test("theme cycler atualiza documentElement.classList", async ({ page }) => {
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
    const current = sequence[sequence.length - 1];
    await cycler.click();
    // Aguarda a classList mudar — NÃO usar waitForTimeout (flaky)
    await page.waitForFunction(
      (prev) => {
        const c = document.documentElement.classList;
        const now = c.contains("dark")
          ? "dark"
          : c.contains("light")
            ? "light"
            : "system";
        return now !== prev;
      },
      current,
      { timeout: 3000 },
    );
    sequence.push(await getMode());
  }

  const unique = new Set(sequence);
  expect(unique.size).toBeGreaterThanOrEqual(2);
});
```

### Task 27: `preservation-smoke.spec.ts` — **DIFF v3 (PF10 + PF2):**

**Step 27.0 (novo) — pré-validação de selectors:**

```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
# Extrai os textos reais usados por EmptyState/FilterBar/BulkAction em cada módulo
grep -rn "Nenhum lead\|Nenhum contato\|Nenhuma oportunidade" src/app/\(protected\)/ > /tmp/empty-texts.txt
grep -rn "Buscar leads\|Buscar contatos\|Buscar oportunidades" src/app/\(protected\)/ > /tmp/search-placeholders.txt
grep -rn "selecionado\|selecionados" src/components/tables/ > /tmp/bulk-texts.txt
grep -rn 'data-stage-column\|data-stage' src/app/\(protected\)/opportunities/pipeline/ > /tmp/pipeline-selectors.txt
cat /tmp/empty-texts.txt /tmp/search-placeholders.txt /tmp/bulk-texts.txt /tmp/pipeline-selectors.txt
```

Popular os selectors do `preservation-smoke.spec.ts` com os textos exatos obtidos. Se algum grep vier vazio (componente não tem texto esperado), avaliar substituir selector por testid.

**Step 27.1 (ajustado PF2) — `setViewportSize` antes de `goto`:**

No bloco "/opportunities/pipeline", usar dois testes separados (desktop + mobile):

```ts
test("preservation @ /opportunities/pipeline desktop — kanban dnd-kit + 6 colunas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/opportunities/pipeline");
  await expect(page.locator('[data-stage-column]').first()).toBeVisible();
  const cols = await page.locator('[data-stage-column]').count();
  expect(cols).toBeGreaterThanOrEqual(4);
});

test("preservation @ /opportunities/pipeline mobile — accordion Fase 21", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/opportunities/pipeline");
  await expect(
    page.getByText(/mover para/i).first().or(
      page.getByRole("button", { name: /expandir/i }).first(),
    ),
  ).toBeVisible();
});
```

Total preservation-smoke: **6 testes** (1 dashboard + 1 leads + 1 contacts + 1 opportunities + 2 pipeline).

Restante idêntico v2.

### Task 28: E2E completo — **DIFF v3 (PF11):**

Target: **≥34 specs verde** (17 existentes + visual-parity[10] + theme-cycler[1] + preservation-smoke[6] = 34). Spec v3 §10.4 "≥20" é piso soft; plan alvo é **34 required**.

### Task 29: Visual regression — idêntica v2.

---

# FASE 8 — Docs + memory + deploy

### Task 30: `visual-audit-krayin.md` — idêntica v2.
### Task 31: HANDOFF — idêntica v2.

### Task 32: Memory updates — **DIFF v3 (refinamento template):**

Step 32.2 expandido com template de memory entry:

Criar `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/law_crm_shell_pattern.md`:

```markdown
---
name: Lei — CrmShell é shell canônico de apps Nexus
description: LEI ABSOLUTA pós Fase 34. Apps Nexus consomem CrmShell do @nexusai360/patterns/crm-shell como shell administrativo. Slots estáticos (logo/search/nav/themeCycler/userMenu/footer + topbar.breadcrumbs/notifications/actions). Motion mobile drawer vive internamente. Brand violeta Nexus (--primary DS). Skip link #main via AppShell.
type: feedback
---

# Lei — CrmShell é shell canônico de apps Nexus

Apps Nexus consomem `CrmShell` de `@nexusai360/patterns/crm-shell` como shell administrativo canônico. Slots sidebar: `{ logo, search?, nav, themeCycler?, userMenu, footer? }`. Slots topbar: `{ breadcrumbs?, notifications?, actions? }`. Motion do mobile drawer vive internamente (state + framer-motion opcional); consumidor entrega apenas nós inertes via factories (`buildSidebarSlots(user)` + `buildTopbarSlots()`).

**Why:** Fase 34 (2026-04-16) unificou shell admin em 1 pattern. Mudar sidebar/topbar = 1 edit no blueprint, propaga pros consumidores. Reinventar shell viola LEI #4 CLAUDE.md krayin e regra 12 blueprint (modularização extrema). Brand violeta Nexus (`--primary` do DS) — nunca azul Krayin (`#0E90D9`). Skip link `#main` é canônico (fornecido por `AppShell.Root` do DS; não duplicar).

**How to apply:**
- Novo app Nexus → importa `CrmShell` via subpath; escreve suas factories de slots; aplica em `(protected)/layout.tsx`.
- Novo módulo em CRM existente → usa `CrmListShell`/`CrmDetailShell`/`CrmDashboardGrid` em vez de layout custom.
- Tokens: zero `gray-\d+`, zero `bg-white`/`text-zinc-*` hardcoded. Sempre `bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`.
- A11y: landmark `role=banner` único (AppShell.Header); `aria-label="Primária"` na nav; skip link `#main` preservado; `<main id="main">` do AppShell.Main.
- Publish: minor additive bump; `sideEffects: false`; `files: ["dist","src"]` em package.json; `"use client"` apenas em `crm-shell.tsx` (drawer precisa de state).
```

Adicionar em `MEMORY.md` do projeto:
```markdown
- [Lei: CrmShell shell canônico](law_crm_shell_pattern.md) — LEI ABSOLUTA pós-F34: apps Nexus consomem CrmShell do patterns; nunca reinventam sidebar/topbar; brand violeta; skip link #main.
```

Restante idêntico v2.

### Task 33: Push + deploy + monitor — idêntica v2 (Portainer via `PORTAINER_STACK_ID` env var).
### Task 34: Graphify update — idêntica v2.

---

# Success criteria (binários) — v3 consolidado

1. ✅ 4 patterns novos + 2 extensions; `@nexusai360/patterns@0.2.0` published.
2. ✅ 5 rotas krayin consomem patterns; zero layout custom ad-hoc.
3. ✅ Visual regression anexado no PR; não-alvo `maxDiffPixelRatio ≤ 0.02`.
4. ✅ Vitest ≥742 verde; E2E **≥34 specs verde** (target 34, floor 20 per spec soft).
5. ✅ `docs/visual-audit-krayin.md` com §2 Token parity vs `manual-visual.html`.
6. ✅ Deploy prod smoke OK.
7. ✅ Tag `phase-34-deployed`.
8. ✅ Bundle ≤60KB gz; pattern ≤15KB gz.
9. ✅ axe-core zero critical/serious.
10. ✅ Zero `gray-\d+` + zero `bg-white` em `packages/patterns/src/{crm-*,page-shell,page-header}/`.
11. ✅ preservation-smoke 6 testes verde (Fases 13/17/18/20/22/24/25/29/32).
12. ✅ theme-cycler verde (com `waitForFunction`, sem `waitForTimeout`).
13. ✅ Skip link `#main` (AppShell canônico); test unit + e2e confirmam.
14. ✅ `"use client"` apenas em `crm-shell.tsx`.
15. ✅ Cross-check roteador-webhook visual regression ≤ 0.02 (ou follow-up documentado se repo inacessível).
16. ✅ Dashboard main 100% preservado (StatsCards + DashboardFilters + Pipeline chart + 3 cards grid + RecentActivity).
17. ✅ Memory `law_crm_shell_pattern.md` criada.
18. ✅ Graphify atualizado em ambos repos.

---

# Resumo diffs v3 (referência rápida)

- Spec v3 patchada: `#conteudo` → `#main` (3 ocorrências).
- Task 5/6/7 tests: asserts anti-`bg-white` (PF5).
- Task 8 fallback: sem menção errônea a framer-motion (PF6).
- Task 11.6: `git tag -d patterns-v0.2.0-beta.0` pós-stable (PF4).
- Task 14.2: assert nav Primária (PF7).
- Task 15.1: grep getNavItems (PF8).
- Task 19 page.tsx: `<Suspense fallback={<CardSkeleton/>}>` em cada slot (PF3).
- Task 26: `waitForFunction` em vez de `waitForTimeout` (PF9).
- Task 27.0: pré-validação selectors via grep (PF10).
- Task 27.1 pipeline: split desktop/mobile, viewport antes de goto (PF2).
- Task 28: target `≥34 specs` uniforme (PF11).
- Task 32: template completo memory entry (refinamento).

---

# Self-review v3

**Spec coverage:** todos os 18 success criteria têm task(s) associada(s).
**Placeholders:** zero. Todas as referências a "idêntica v2" têm path plan v2 auto-suficiente.
**Type consistency:** interfaces `CrmShell*` consistentes T4→T13→T14→T19.
**Riscos pós-v3:** T27.0 depende de grep retornar textos reais. Se componentes usarem i18n, textos vivem em messages/locale — ampliar grep para `src/locale/` e `messages/`.

---

**Status:** plan v3 FINAL. Aprovado no triplo-review. Pronto para execução via `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`.
