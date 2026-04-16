# Fase 34 — Visual Parity com Krayin Original (Parte A)

**Data:** 2026-04-16
**Versão:** v1 (primeira redação; revisar v2 com code-reviewer e v3 como pente fino final)
**Fonte de verdade visual:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm` (Laravel/Krayin original — pacote `Webkul/Admin`, 282 Blade templates em `src/Resources/views`).
**Destino:** páginas existentes do `nexus-crm-krayin` + patterns novos no `nexus-blueprint`.
**Escopo desta fase (A):** shell admin + 5 rotas de alto tráfego (dashboard, leads, contacts, opportunities, pipeline).
**Fase B (futura, 35):** aplicar nos 8 módulos restantes (companies, products, tasks, reports, settings, campaigns, segments, workflows).

---

## 1. Contexto

O CRM atual em produção (`crm2.nexusai360.com`) está funcional (Fase 33 finalizada, 706/706 verde), mas visualmente **diverge da referência do Krayin original** (`crm.nexusai360.com`, pacote Laravel `packages/Webkul/Admin`). O usuário quer que as telas fiquem "parecidas com a referência" — skin, não estrutura. Toda lógica (Prisma, auth, Server Actions, RBAC, tenant scope) fica intacta.

**Respeita LEIs:**
- LEI #4 CLAUDE.md krayin — consultar `nexus-blueprint` antes de criar componentes.
- Regra 11 CLAUDE.md blueprint — visual regression obrigatório (`pnpm visual:snap` antes/depois).
- Regra 12 CLAUDE.md blueprint — modularização extrema; o que vira pattern fica no blueprint, páginas compõem.

## 2. Motivação (não-negociável)

- Unificar o shell de admin num pattern reutilizável no blueprint → mudar sidebar/topbar é 1 edit que propaga pro CRM.
- Páginas do CRM devem compor patterns do blueprint, não reinventar layout (débito visual).
- Alinhamento com referência Krayin aumenta reconhecibilidade para usuários que vêm do CRM antigo.

## 3. Fonte de verdade visual (inventário da referência)

### 3.1. Shell (layout principal)
Arquivo: `packages/Webkul/Admin/src/Resources/views/components/layouts/index.blade.php`

```
<body class="h-full font-inter dark:bg-gray-950">
  <x-admin::layouts.header />                     {{-- topbar 62px --}}
  <div class="group/container sidebar-collapsed flex gap-4">
    <x-admin::layouts.sidebar.desktop />            {{-- sidebar colapsável 85px/expandida --}}
    <div class="flex min-h-[calc(100vh-62px)] bg-gray-100 pt-3 dark:bg-gray-950">
      <div class="px-4 pb-6 ltr:lg:pl-[85px]">
        {{ $slot }}
      </div>
    </div>
  </div>
</body>
```

Características:
- **Fonte:** Inter (via Google Fonts).
- **Brand color CSS var:** `--brand-color` (default `#0E90D9` azul). Configurável por tenant em Krayin.
- **Topbar altura:** 62px fixa.
- **Sidebar:** colapsada 85px; expandida ~250px; transição 300ms.
- **Main bg:** `gray-100` light / `gray-950` dark.
- **Padding content:** `px-4 pb-6 pl-[85px]` (deixa espaço da sidebar colapsada).

### 3.2. Dashboard
Arquivo: `packages/Webkul/Admin/src/Resources/views/dashboard/index.blade.php`

Header:
- `mb-5 flex justify-between`
- Título `text-2xl font-semibold`
- Filtros à direita: dois date pickers 140px (start/end).

Grid:
- Left `flex-1 flex-col gap-4`: Revenue Stats → OverAll Stats → Total Leads Stats → (Top Products | Top Persons em 2 col).
- Right `w-[378px] flex-col gap-4`: Open Leads by States → Revenue by Sources → Revenue by Types.
- Mobile: `max-xl:flex-wrap` (quebra em coluna única).

### 3.3. Lead Index (list)
Arquivo: `packages/Webkul/Admin/src/Resources/views/leads/index.blade.php`

Header em card:
- `flex justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-900`
- Left: breadcrumbs + título `text-xl font-bold`
- Right: export + primary-button "Criar"

Content:
- View switcher via `?view_type=table|kanban` (default kanban).
- Kanban subview: `kanban.blade.php`
- Table subview: `table.blade.php` (usa `x-admin::datagrid`)

### 3.4. Lead View (detail)
Arquivo: `packages/Webkul/Admin/src/Resources/views/leads/view.blade.php`

Duas colunas:
- **Left** `min-w-[394px] max-w-[394px] sticky top-[73px] rounded-lg border bg-white`:
  - Info block (`p-4`): breadcrumbs + tags + título h1 + action bar (Mail/File/Note/Activity).
  - Attributes (`leads.view.attributes`).
  - Contact Person (`leads.view.person`).
- **Right** `flex-1 flex-col gap-4`:
  - Stages navigation pill (`leads.view.stages`).
  - Activities tabs (All / Description / Products / Quotes) com timeline.
- Mobile: `max-lg:flex-wrap` — left vira full width.

### 3.5. Outros sinais visuais da referência (aplicáveis transversalmente)
- **Radius:** `rounded-lg` (8px) para cards; `rounded-md` (6px) para inputs/botões.
- **Border:** `border border-gray-200 dark:border-gray-800`.
- **Card bg:** `bg-white dark:bg-gray-900`.
- **Gap padrão:** `gap-4` (16px).
- **Densidade:** `text-sm`, `py-2`, `min-h-[39px]` em inputs.
- **Hover border:** `hover:border-gray-400`.
- **Primary button:** classe `primary-button` (azul brand com hover).

## 4. Escopo (in/out)

### IN — Fase 34 (A)
- Novo pattern **`AdminShell`** no blueprint: topbar 62px + sidebar colapsável 85px + content slot + dark mode + brand color var.
- Novo pattern **`CrmListShell`** no blueprint: header card (breadcrumbs + título + ações) + view switcher + content slot.
- Novo pattern **`CrmDetailShell`** no blueprint: two-column (394px sticky + flex) com slots `left` e `right`.
- Novo pattern **`CrmDashboardGrid`** no blueprint: left flex-1 + right 378px, responsivo.
- Tokens: adicionar/alinhar CSS var `--brand-color` default `#0E90D9` no `@nexusai360/tokens`.
- **Aplicar patterns em 5 rotas:**
  1. `/dashboard` (compor `CrmDashboardGrid`).
  2. `/leads` (compor `CrmListShell` + adicionar view switcher kanban/table — **default kanban** como no original).
  3. `/contacts` (compor `CrmListShell`).
  4. `/opportunities` (compor `CrmListShell`).
  5. `/opportunities/pipeline` (manter kanban existente; só envelopar no `CrmListShell`).
- Refactor `src/components/layout/sidebar.tsx` do krayin → passar a consumir o `AdminShell` do blueprint.
- Audit doc em `nexus-crm-krayin/docs/visual-audit-krayin.md` com lista canônica de discrepâncias vs referência (checklist por tela).
- Visual regression `pnpm visual:snap` antes/depois para as 5 rotas (desktop + mobile).

### OUT — fica para Fase 35 (B) ou follow-ups
- Companies, products, tasks, reports, settings, campaigns, segments, workflows, automation, marketing (Fase 35).
- **Não** reescrever widgets do dashboard para bater 1:1 com widgets do Krayin original (Revenue/OverAll/TotalLeads/TopProducts/TopPersons/OpenLeadsByStates/RevenueBySources/RevenueByTypes). Os widgets atuais do krayin-next (`FunnelCard`, `PipelineValueCard`, `TopOpportunitiesCard`) **permanecem**; só o grid que os contém muda. Se o usuário quiser port de widgets da referência, vira follow-up.
- **Não** mexer em Prisma/Server Actions/RBAC/auth/tenant scope.
- **Não** alterar breaking dos outros consumidores do blueprint (roteador-webhook, outros produtos) — versionar additive (minor).
- **Não** mudar paleta dark mode global — manter (só adicionar `--brand-color`).
- **Não** port dos emails templates/views (out completamente).

## 5. Arquitetura das mudanças

### 5.1. `nexus-blueprint` — patterns novos

```
packages/patterns/src/
  admin-shell/
    admin-shell.tsx         # <AdminShell topbar={...} sidebar={...}>{children}</AdminShell>
    admin-shell.stories.tsx
    admin-shell.test.tsx
    types.ts                # AdminShellProps
    index.ts
  crm-list-shell/
    crm-list-shell.tsx      # <CrmListShell breadcrumbs={} title={} actions={} viewSwitcher={}>{children}</CrmListShell>
    crm-list-shell.stories.tsx
    crm-list-shell.test.tsx
    index.ts
  crm-detail-shell/
    crm-detail-shell.tsx    # <CrmDetailShell left={...} right={...} />
    crm-detail-shell.stories.tsx
    crm-detail-shell.test.tsx
    index.ts
  crm-dashboard-grid/
    crm-dashboard-grid.tsx  # <CrmDashboardGrid sidebar={...}>{mainChildren}</CrmDashboardGrid>
    crm-dashboard-grid.stories.tsx
    crm-dashboard-grid.test.tsx
    index.ts
```

Todos se apoiam em primitivos existentes (`@nexusai360/ui` — sidebar, nav-group, nav-link, card, button, breadcrumb). Sem duplicação.

### 5.2. `nexus-blueprint` — tokens

```
packages/tokens/src/brand.ts   # export const brandColor = 'var(--brand-color, #0E90D9)'
packages/tokens/src/index.css  # :root { --brand-color: #0E90D9; }
```

### 5.3. `nexus-crm-krayin` — composição

Nenhuma rota nova. Apenas edições:

- `src/app/(protected)/layout.tsx` (se existir; senão criar) — consome `AdminShell`.
- `src/app/(protected)/dashboard/page.tsx` (via `DashboardContent`) — compõe `CrmDashboardGrid` com os widgets atuais à esquerda e 3 widgets à direita (reusar `FunnelCard` na sidebar? — decidir no plan).
- `src/app/(protected)/leads/_components/leads-content.tsx` — envelopa em `CrmListShell` + adiciona toggle kanban/table. Kanban novo component (ou reusar `@dnd-kit` do pipeline — **out deste spec** se for custoso; manter só table + link "Pipeline" no header).
- `src/app/(protected)/contacts/_components/*` — envelopa em `CrmListShell`.
- `src/app/(protected)/opportunities/_components/*` — envelopa em `CrmListShell`.
- `src/app/(protected)/opportunities/pipeline/page.tsx` — envelopa em `CrmListShell` (pipeline em si intocado).

### 5.4. Kanban em `/leads` — decisão

A referência Krayin tem kanban como default em `/leads`. Criar kanban de leads do zero em Fase 34 é escopo separado (drag, colunas por `status`, server actions de move). **Decisão:** entregar na Fase 34 **apenas o `CrmListShell` com view switcher preparado** (prop `viewSwitcher?: { table: ReactNode; kanban?: ReactNode }`). Se `kanban` undefined, switcher renderiza só "Tabela" e um link "Ver pipeline" (pipeline existente em `/opportunities/pipeline`). Kanban real de leads = Fase 35 ou follow-up dedicado.

Registrar isso em `docs/HANDOFF.md` como standby documentado (não-bloqueador).

## 6. Audit visual (entregável intermediário)

Produzir `nexus-crm-krayin/docs/visual-audit-krayin.md` com:
- Tabela por tela: **[rota] | [screenshot krayin original] | [screenshot krayin-next atual] | [diffs identificados] | [ação planejada]**.
- Screenshots do Krayin original **não** vêm do scraping — vêm de leitura das Blade + inferência (ou, se necessário, screenshot manual tirado pelo usuário/browser dev). O `dembrandt` **não** é usado nesta fase.
- Discrepâncias categorizadas: (i) shell, (ii) header/título, (iii) tabela/densidade, (iv) cores/tokens, (v) empty states, (vi) dark mode.

## 7. Visual regression

- Baseline antes: `pnpm visual:snap` em `main` pré-fase.
- Captura depois: `pnpm visual:snap` após cada tela aplicada.
- Output em `docs/assets/visual/{desktop,mobile}-NN-rota.png`.
- PR da fase não fecha sem anexar antes/depois das 5 rotas (desktop + mobile).

## 8. Testes

- Unit (Vitest) para cada pattern novo do blueprint: render sem crash, slots funcionam, dark mode aplica classe, brand color respeita CSS var (jsdom + `getComputedStyle` fallback: verificar className/attr). Target: 4 specs × 3-5 casos = ~16 testes.
- Integration (Vitest) no krayin: páginas refatoradas continuam renderizando (snapshot light) e ações RBAC permanecem gatedas (extender testes existentes, não reescrever).
- E2E (Playwright): 1 spec novo `visual-parity.spec.ts` — admin navega dashboard → leads → contacts → opportunities → pipeline, verifica presença de elementos do shell (sidebar, topbar, header card).
- Regressão: `npm test` + `npm run test:e2e` verde pré-merge. Target mínimo 722/722 (706 atual + ~16 novos).

## 9. Documentação / handoff

- Atualizar `nexus-crm-krayin/docs/HANDOFF.md` com Fase 34 entregue + standby kanban leads.
- Atualizar `nexus-blueprint/architecture.md` + `patterns/` docs com novos patterns.
- Atualizar `nexus-blueprint/CHANGELOG.md` (minor bump — additive).
- Memory update: `project_crm_phase_status.md` + novas laws se aplicável (`law_admin_shell_pattern.md`).

## 10. Success criteria (medidos, não achismo)

1. 4 novos patterns no blueprint com stories/testes verde e publicados (`@nexusai360/patterns@X.Y.0`).
2. 5 rotas do krayin-next consumindo esses patterns; nenhuma rota com layout custom ad-hoc.
3. `pnpm visual:snap` antes/depois anexado no PR; diff visual só em áreas refatoradas.
4. 722/722 Vitest verde; E2E verde (17+ existentes + novo `visual-parity`).
5. `docs/visual-audit-krayin.md` existe e cobre 5 rotas.
6. Deploy em `crm2.nexusai360.com` sem regressão (health/ready/login OK; smoke prod).
7. Tag `phase-34-deployed` aplicada.

## 11. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dual React por novo pattern (vide incidente 2026-04-14) | Consumir patterns via `next.config.ts` `transpilePackages` já configurado; adicionar `@nexusai360/patterns` se não estiver. Smoke `/login` pós-deploy. |
| Breaking no blueprint para outros consumidores | Additive-only; bump minor; exports novos sem tocar existentes. |
| Sidebar do krayin-next difere do padrão novo | Migrar como componente em `_components/` se tiver domínio (nav items custom); shell fica no blueprint. |
| Visual regression com falso-positivo em fontes/AA | Configurar `maxDiffPixelRatio 0.01` nos testes já existentes; revisar antes de falhar. |
| Bundle size blueprint > budget (60KB gz total) | Patterns novos apontam para ui primitivos já bundled; net delta esperado < 8KB gz. Medir com `pnpm size`. |

## 12. Não-objetivos (anti-scope explícito)

- Não port 1:1 de widgets do dashboard Krayin original.
- Não implementação de kanban novo de leads (standby documentado).
- Não mudanças em Prisma, Server Actions, RBAC, tenant scope, auth.
- Não mudança de paleta dark mode.
- Não port de emails templates.
- Não consumir dembrandt nesta fase (fica opcional futuro).

## 13. Entregáveis (lista canônica para review)

- [ ] `nexus-blueprint/packages/patterns/src/admin-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-list-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-detail-shell/*`
- [ ] `nexus-blueprint/packages/patterns/src/crm-dashboard-grid/*`
- [ ] `nexus-blueprint/packages/tokens/src/brand.ts` + css var
- [ ] `nexus-blueprint` publish minor + CHANGELOG
- [ ] `nexus-crm-krayin` `layout.tsx` consome AdminShell
- [ ] `nexus-crm-krayin` 5 rotas compõem patterns
- [ ] `nexus-crm-krayin/docs/visual-audit-krayin.md`
- [ ] `nexus-crm-krayin/docs/HANDOFF.md` atualizado (Fase 34 deployed + standby kanban)
- [ ] Visual regression snapshots antes/depois
- [ ] Testes Vitest + Playwright verde
- [ ] Deploy + smoke prod + tag

## 14. Próxima versão

- **v2** — após Review #1 via `Agent superpowers:code-reviewer` (checklist: esquecimento, repetição, violação identidade visual/componentes existentes, cobertura, clareza escopo in/out, não acoplar A+B).
- **v3** — pente fino profundo (segunda passada, definitiva).
