# Spec: Fase 1a — Foundation A (Design System Core + Shell)

**Data:** 2026-04-14
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda)
**Status:** aprovada para implementação.
**Escopo:** Fechar o Design System do Nexus Blueprint para consumo produtivo pelo CRM, incluindo primitives faltantes (Skeleton, LoadingSpinner, EmptyState, ErrorState, AppShell, PageHeader, Breadcrumb, IconTile, Separator, Avatar, Tooltip, Tabs, DropdownMenu, ScrollArea) e publicá-lo como `@nexusai360/design-system` **v0.3.0**.

### Changelog v2 → v3
- `IconTile` muda de classes Tailwind para **CSS custom properties + `data-color` attribute** (Tailwind v4 + pacote distribuído não suporta `@source inline`). CSS fica em `styles.css` compilado; server-safe sem condicional de classe.
- `Breadcrumb` abandona DropdownMenu para overflow; adota **disclosure pattern** (`<button aria-expanded>` revela itens ocultos inline). Segue WAI-ARIA APG.
- `AppShell` mobile: `<nav aria-label="Primária">` fica **dentro** do `Dialog`, não o Dialog como nav. Dialog ganha `aria-label="Menu de navegação"`. Foco inicial no primeiro link.
- Rota `/__ds-preview` gated em **`src/middleware.ts`** com matcher — retorna 404 quando `process.env.DS_PREVIEW !== "true"` (defesa primária, antes do render). Page `export const dynamic = "force-dynamic"` para Lighthouse CI medir hidratado.
- `size-limit` configurado com `ignore` para peer deps (react, react-dom, @base-ui/react, framer-motion, lucide-react, sonner, tailwindcss, next). Budget mede só código próprio do DS.
- `Skeleton` individual: `aria-hidden="true"` apenas (sem `role="status"`). Container loading recebe `aria-busy="true"` + único `<span role="status" className="sr-only">Carregando…</span>`. `TableSkeleton` existente ajustada ao mesmo contrato.
- tsup build: `sourcemap: false`; CI falha se `.map` estiver em `dist/`.
- Vitest + RTL + jsdom adicionados como **prerequisite** (setup é primeira task do plan).
- `.npmrc` do repo contém só `registry`; token via env `NPM_TOKEN` (CI usa `GITHUB_TOKEN`); `pnpm publish --dry-run` verifica ausência de vazamento. Em dev local: `~/.npmrc` do desenvolvedor.

### Changelog v1 → v2
- Versão corrigida: **v0.3.0** (SemVer minor bump obrigatório por adicionar 14 novos componentes). Roadmap mestre será atualizado: Fase 1d → v0.4.0.
- API padronizada: compound components onde faz sentido (`PageHeader.Root/.Icon/.Title/.Description/.Actions`, `EmptyState.Root/.Icon/.Title/.Description/.Action`, `Breadcrumb.Root/.Item/.Separator`). `data-slot` em todos.
- Novos primitives adicionados à fase: Separator, Avatar, Tooltip, Tabs, DropdownMenu, ScrollArea.
- WCAG com tooling obrigatório (axe-core CI + Lighthouse CI) + critérios por componente + screen-reader smoke documentado.
- Bundle budget (`size-limit`) no CI do pacote.
- Safelist explícito de accent colors no CSS do pacote.
- Playwright smoke no CRM com 3 viewports × 2 temas.
- Feature flag `DS_V3_ENABLED` no CRM.
- Rollback com patch bumps, `npm deprecate`, tag `phase-1a-deployed` separada da tag do pacote.
- Cobertura ≥80% para novos componentes.
- Matriz de composição documentada.

---

## 1. Contexto

**Estado do pacote `@nexusai360/design-system` hoje (v0.2.0 em dist/build):** Button, Input, Card, Label, Badge, Table, Dialog, AlertDialog, Switch, CustomSelect, BadgeSelect, PasswordInput, Sonner, TableSkeleton, tokens completos, ThemeProvider, animations, styles.css WCAG baseline.

**Gap Fase 1a:** primitives de estado, shell de layout, ícones padronizados, e vários outros primitives exigidos pelas fases seguintes (identificados na Review 1).

**CRM (nexus-crm-krayin):** componentes locais em `src/components/ui/` ainda não migrados. Shell próprio em `src/components/layout/` permanece intocado nesta fase (migração é 1b).

## 2. Objetivos

1. Publicar **`@nexusai360/design-system` v0.3.0** no GitHub Packages.
2. Adicionar ao pacote:
   - **Primitives de estado:** `Skeleton`, `LoadingSpinner`, `EmptyState`, `ErrorState`.
   - **Shell de layout:** `AppShell`, `PageHeader`, `Breadcrumb`, `IconTile`.
   - **Primitives base adicionais (exigidos por fases seguintes):** `Separator`, `Avatar`, `Tooltip`, `Tabs`, `DropdownMenu`, `ScrollArea`.
3. Audit WCAG AA com tooling automático (axe-core + Lighthouse CI) + smoke manual VoiceOver/NVDA documentado.
4. Bundle budget no CI (`size-limit`): DS total ≤ 60KB gz; cada subpath export ≤ 15KB gz. Configuração ignora peer deps (`react`, `react-dom`, `@base-ui/react`, `framer-motion`, `lucide-react`, `sonner`, `tailwindcss`, `next`) — budget mede só código próprio do DS.
5. Accent colors via CSS custom properties + `data-color` attribute no `IconTile` (Tailwind v4 + pacote distribuído não suporta `@source inline`). CSS fica em `styles.css` do pacote, compilado no build.
6. Integração preliminar no CRM com rota smoke `/__ds-preview` + Playwright smoke automatizado (3 viewports × dark/light).
7. Atualizar Appendix do roadmap mestre: Fase 1a = DS v0.3.0; Fase 1d = DS v0.4.0.

## 3. Não-objetivos (Fase 1a)

- Migrar telas existentes do CRM (Fase 1b).
- Componentes de domínio compostos (Kanban, PDF preview, RichText, Charts) — Fase 1d v0.4.0.
- Alterar sidebar/command-palette/notification-bell do CRM (Fase 1b).
- Observability/feature flags/backup/RBAC (Fase 1c — exceto a flag `DS_V3_ENABLED` do CRM que já é útil aqui).

## 4. API dos novos componentes

Convenção: todos com `data-slot`, props typed via TS, wrappers de `@base-ui/react` onde aplicável, `"use client"` apenas quando necessário, server-safe por default.

### 4.1. Skeleton (server-safe)
```tsx
<div aria-busy="true">
  <span role="status" className="sr-only">Carregando leads</span>
  <Skeleton variant="rect" className="h-4 w-full" />
  <Skeleton variant="text" lines={3} />
</div>
```
- Variants: `rect` (default), `circle`, `text`.
- Individual: `aria-hidden="true"`; SEM `role="status"` (evita tempestade de anúncios em listas). O container pai orquestra `aria-busy` e o `<span role="status">` único.
- Respeita `prefers-reduced-motion`.
- `data-slot="skeleton"`.

### 4.2. LoadingSpinner (server-safe)
```tsx
<LoadingSpinner size="sm" />
<LoadingSpinner size="lg" label="Carregando leads..." />
```
- Sizes: `sm` (16px), `md` (24px, default), `lg` (40px).
- `role="status"` + `aria-live="polite"`; `label` visible em `lg`, sr-only em outros.
- Reduz rotação em `prefers-reduced-motion`.

### 4.3. EmptyState — compound (server-safe)
```tsx
<EmptyState.Root>
  <EmptyState.Icon icon={Inbox} color="neutral" />
  <EmptyState.Title>Nenhum lead cadastrado</EmptyState.Title>
  <EmptyState.Description>Comece criando seu primeiro lead.</EmptyState.Description>
  <EmptyState.Action><Button>Novo lead</Button></EmptyState.Action>
</EmptyState.Root>
```

### 4.4. ErrorState — compound (server-safe)
```tsx
<ErrorState.Root>
  <ErrorState.Icon /* default AlertTriangle red */ />
  <ErrorState.Title>Não foi possível carregar</ErrorState.Title>
  <ErrorState.Description>Verifique sua conexão.</ErrorState.Description>
  <ErrorState.Details error={err} /* colapsado, sem stack em prod */ />
  <ErrorState.Action><Button onClick={retry}>Tentar de novo</Button></ErrorState.Action>
</ErrorState.Root>
```

### 4.5. AppShell — compound ("use client" pelo colapso mobile)
```tsx
<AppShell.Root stickyHeader>
  <AppShell.Sidebar><Sidebar /></AppShell.Sidebar>
  <AppShell.Header><Header /></AppShell.Header>
  <AppShell.Main id="main">{children}</AppShell.Main>
</AppShell.Root>
```
- Landmarks desktop: `<nav aria-label="Primária">` (sidebar), `<header role="banner">`, `<main id="main">`.
- Skip-link no topo (`<a href="#main">Ir para o conteúdo</a>`).
- Mobile (< 1024px): sidebar renderizada dentro de `<Dialog aria-label="Menu de navegação">` com `<nav aria-label="Primária">` **interno** (landmark preservado). Foco inicial no primeiro link ao abrir.
- `prefers-reduced-motion` respeitado na transição.
- Camadas internas documentadas no README: primitives → composites → shell (sem dep circular).

### 4.6. PageHeader — compound (server-safe)
```tsx
<PageHeader.Root>
  <PageHeader.Breadcrumb items={[...]} />
  <PageHeader.Row>
    <PageHeader.Icon icon={Users} color="violet" />
    <PageHeader.Heading>
      <PageHeader.Title>Leads</PageHeader.Title>
      <PageHeader.Description>Oportunidades em fase inicial</PageHeader.Description>
    </PageHeader.Heading>
    <PageHeader.Actions><Button>Novo lead</Button></PageHeader.Actions>
  </PageHeader.Row>
</PageHeader.Root>
```
- `color` via accent colors (violet/emerald/blue/amber/red/purple/zinc) — via `IconTile` interno.

### 4.7. Breadcrumb — compound (server-safe)
```tsx
<Breadcrumb.Root>
  <Breadcrumb.Item href="/dashboard">Dashboard</Breadcrumb.Item>
  <Breadcrumb.Separator />
  <Breadcrumb.Item href="/leads">Leads</Breadcrumb.Item>
  <Breadcrumb.Separator />
  <Breadcrumb.Item current>Acme Corp</Breadcrumb.Item>
</Breadcrumb.Root>
```
- `<nav aria-label="Breadcrumb">` com `<ol>` interno (WAI-ARIA APG).
- Item `current` tem `aria-current="page"` e sem `href`.
- **Truncamento mobile (disclosure pattern):** itens do meio ficam `aria-hidden` com elipse visível; `<button aria-expanded>` opcional revela itens ocultos inline. SEM DropdownMenu (breadcrumb é link-only).

### 4.8. IconTile (server-safe)
```tsx
<IconTile icon={Users} color="violet" size="md" />
```
- Sizes: `sm` (h-8 w-8 + icon h-4), `md` (h-10 w-10 + icon h-5, default), `lg` (h-12 w-12 + icon h-6).
- Colors: `violet|emerald|blue|amber|red|purple|zinc|neutral`.
- **Implementação:** atributo `data-color={color}` + CSS no `styles.css` do pacote usando custom properties:
  ```css
  [data-slot="icon-tile"][data-color="violet"] {
    --tile-bg: oklch(0.63 0.19 301 / 0.1);
    --tile-border: oklch(0.63 0.19 301 / 0.2);
    --tile-icon: oklch(0.68 0.18 301);
  }
  /* repetir para cada accent color */
  ```
  CSS é compilado no build do DS e independe do scan do Tailwind do consumidor.

### 4.9. Separator (server-safe)
```tsx
<Separator />
<Separator orientation="vertical" />
```
- Base-UI `Separator`; `data-slot="separator"`.

### 4.10. Avatar — compound ("use client" por fallback dinâmico)
```tsx
<Avatar.Root size="md">
  <Avatar.Image src={url} alt={name} />
  <Avatar.Fallback>MV</Avatar.Fallback>
</Avatar.Root>
```
- Sizes: `xs|sm|md|lg|xl`.

### 4.11. Tooltip — compound ("use client")
```tsx
<Tooltip.Root>
  <Tooltip.Trigger asChild={false}><Button /></Tooltip.Trigger>
  <Tooltip.Content>Detalhes</Tooltip.Content>
</Tooltip.Root>
```
- Base-UI `Tooltip`; delay 500ms; `aria-describedby` auto.

### 4.12. Tabs — compound ("use client")
```tsx
<Tabs.Root defaultValue="a">
  <Tabs.List>
    <Tabs.Trigger value="a">A</Tabs.Trigger>
    <Tabs.Trigger value="b">B</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="a">...</Tabs.Panel>
  <Tabs.Panel value="b">...</Tabs.Panel>
</Tabs.Root>
```
- Base-UI `Tabs`; foco via setas.

### 4.13. DropdownMenu — compound ("use client")
```tsx
<DropdownMenu.Root>
  <DropdownMenu.Trigger>...</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item>...</DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item destructive>Apagar</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```
- Base-UI `Menu`.

### 4.14. ScrollArea ("use client")
```tsx
<ScrollArea className="h-64">
  {children}
</ScrollArea>
```
- Base-UI `ScrollArea`.

### Matriz de composição

| Primitive | Usa internamente |
|-----------|------------------|
| EmptyState.Icon | IconTile (neutral default) |
| ErrorState.Icon | IconTile (red default) |
| PageHeader.Icon | IconTile |
| Breadcrumb overflow | DropdownMenu |
| AppShell mobile sidebar | Dialog |
| Avatar fallback | — |

## 5. Audit WCAG AA

### 5.1. Tooling automático (CI obrigatório)
- `@axe-core/react` rodado em Playwright contra rota `/__ds-preview` em 3 viewports × 2 temas. Zero violações críticas/seriaws permitidas.
- `lhci` (Lighthouse CI) smoke em `/__ds-preview`: acessibilidade ≥ 95.
- `size-limit` confirma bundle budget.

### 5.2. Critérios por componente
Checklist específico por componente (contraste, foco, aria, redução de movimento, composição semântica) consolidado em `packages/design-system/docs/accessibility.md`, com tabela:

| Componente | Contraste | Focus ring | ARIA | Reduced motion | Screen reader OK |
|------------|-----------|------------|------|----------------|------------------|
| ... | ... | ... | ... | ... | ... |

Linha por componente preenchida durante a implementação; falha bloqueia publish.

### 5.3. Screen-reader smoke manual
VoiceOver (macOS) + NVDA (Windows sob WSL/VM): ler `/__ds-preview` e registrar captura de tela/áudio de:
- Navegação por landmarks (AppShell).
- Anúncio de Skeleton/LoadingSpinner (role="status").
- Breadcrumb atual com `aria-current`.
- Dialog abrindo/fechando com foco correto.

## 6. Publicação

- Build `pnpm build` (tsup): `sourcemap: false` em prod; CI falha se `dist/*.map` existir.
- `size-limit` passa (medindo só código próprio do DS).
- `pnpm publish --dry-run` verifica que nada sensível vai no tarball (nenhum `.env*`, `.npmrc` com token, `.map`).
- Versão: `0.3.0`. Tag: `v0.3.0-design-system` (seguindo convenção blueprint).
- Workflow `.github/workflows/publish-design-system.yml` publica via `pnpm --filter @nexusai360/design-system publish` no GitHub Packages.
- README do pacote atualizado com exemplos dos 14 novos componentes + matriz.

## 7. Integração preliminar no CRM

1. `.npmrc` com `@nexusai360:registry=https://npm.pkg.github.com` + token via env no CI (nunca em git).
2. `package.json` do CRM: `"@nexusai360/design-system": "^0.3.0"`.
3. `src/app/layout.tsx`: `import "@nexusai360/design-system/styles.css"` (fica ao lado do `./globals.css` existente).
4. Flag `DS_V3_ENABLED` (env) default `true`; permite rollback do consumo sem revert de `package.json`.
5. Rota smoke `/__ds-preview` atrás de flag `DS_PREVIEW` (default `false` em prod). **Gate primário em `src/middleware.ts`** com matcher `/__ds-preview/:path*` retornando 404 quando `process.env.DS_PREVIEW !== "true"`. Page tem `export const dynamic = "force-dynamic"` (Lighthouse/axe medem versão hidratada). Defense-in-depth: page.tsx também faz early return.
6. Playwright smoke:
   - 3 viewports: 390 (mobile), 768 (tablet), 1440 (desktop).
   - 2 temas: `.dark` e light.
   - Screenshot diff baseline committed.
   - `axe-core` em cada render.

## 8. Testes

- **Unit (Vitest + React Testing Library):** cada componente ≥ 80% coverage — renderização, props, acessibilidade básica via `getByRole`, variantes.
- **Integration:** `AppShell.Root` com mock de sidebar/header em SSR + CSR; Breadcrumb truncamento em mobile.
- **E2E smoke (Playwright):** conforme §7.
- **Type-check:** `pnpm tsc --noEmit` no pacote e no CRM.
- **Lint:** `pnpm lint` em ambos.

## 9. Deploy / Rollback

**Deploy:**
- Após publicação do pacote e verde no CRM CI: deploy Portainer.
- Tag git separada no CRM: `phase-1a-deployed` (distinto da tag do pacote).

**Rollback:**
- Pacote tem bug crítico: `npm deprecate @nexusai360/design-system@0.3.0 "buggy release"` + publish `0.3.1` patch.
- CRM tem bug por causa do consumo: setar `DS_V3_ENABLED=false` em runtime (kill-switch) OU pin em `0.2.0` no `package.json` + redeploy da imagem anterior.
- Git revert sempre disponível: `phase-1a-deployed` permite rollback rápido via Portainer (redeploy da tag anterior).
- Política: nunca "unpublish" versão do GitHub Packages — usar deprecate + patch.

## 10. Pacotes do Blueprint consumidos

- `@nexusai360/design-system` (próprio — esta fase o completa e publica).
- Nenhum outro pacote `@nexusai360/*` é tocado.

## 11. Observability

- Pacote não emite telemetria por default (evita runtime cost no consumidor).
- Documentar no README: "consumidor pode wrappar em instrumentação own" (ex: `data-slot` + `data-variant` facilitam query analytics client-side no CRM).

## 12. Critérios de conclusão

- [ ] 14 novos componentes implementados, com `data-slot`, `"use client"` só quando necessário, API em compound quando aplicável.
- [ ] Barrel export `src/index.ts` atualizado.
- [ ] README do pacote e `accessibility.md` preenchidos (matriz por componente).
- [ ] `size-limit` CI passa nos budgets definidos.
- [ ] `axe-core` CI zero violações crit/sério em `/__ds-preview`.
- [ ] Lighthouse a11y ≥ 95 em `/__ds-preview`.
- [ ] Pacote publicado como `v0.3.0` no GitHub Packages; tag `v0.3.0-design-system`.
- [ ] CRM consome o pacote; `/__ds-preview` renderiza; Playwright smoke passa em 3 viewports × 2 temas.
- [ ] `pnpm lint` + `tsc --noEmit` passam em ambos.
- [ ] Unit coverage ≥ 80% novos componentes.
- [ ] VoiceOver/NVDA smoke documentado em `accessibility.md`.
- [ ] Deploy Portainer verde; tag `phase-1a-deployed` criada.
- [ ] Roadmap mestre atualizado (Fase 1a = v0.3.0; Fase 1d reservada para v0.4.0).
