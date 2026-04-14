# Plan: Fase 1a — Foundation A (DS Core v0.3.0)

**Data:** 2026-04-14
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda)

### Changelog v2 → v3
- T21a: validação obrigatória via PR em branch `ci/ds-quality-check` (não permite commit direto `main` sem CI verde).
- T21b explicitamente movido para *depois* de T27 (depende das specs Playwright + baselines commitados).
- T23 ganha subtask: configurar `setup-node` com `registry-url` + `NODE_AUTH_TOKEN` (secret `GITHUB_TOKEN`) no workflow CI do CRM, evitando 401 no `pnpm install` do pacote privado.
- T22 dry-run audit com comando verificável: `pnpm publish --dry-run --json | jq '.files[].path' | grep -E '\.(map|env|npmrc)$' && exit 1 || true`.
- T29 aceite ganha comando concreto de log check: `docker logs --since 5m <container> 2>&1 | grep -iE 'level=error|ERROR' | wc -l → deve ser 0 (ou investigar)`.
- Convenção de commits explícita (seção nova §Convenção de commits).
- T1 coverage threshold com `thresholdAutoUpdate: false` + possibilidade de per-file override em utils triviais.
- T20 screen-reader smoke: fallback para `@guidepup/playwright` em modo autônomo quando VO/NVDA manual não é acessível.
- T27 baseline snapshot policy documentada.

### Changelog v1 → v2

### Changelog v1 → v2
- T20 (accessibility.md) dividida: matriz por componente passa a ser aceite obrigatório dentro de cada T4–T17; T20 consolidado + seção screen-reader smoke.
- T21 dividida em T21a (quality no pacote, blocks T22) e T21b (axe+lighthouse no CRM, blocks T29).
- Coverage threshold ≥80% configurado em T1 (`vitest.config.ts`); checado em T21a.
- T22 aceite explicita auditoria do dry-run tarball (sem `.map`, `.env`, `.npmrc`).
- T27 aceite inclui commit das screenshots baseline.
- Seção "Ordem" simplificada (T13–T17 dependem só de T4).
- T29 aceite mensurável: health 200 + preview renderiza + zero error logs em 5min.
- T30 aceite lista keys de memória específicas + atualiza Appendix A do roadmap.
**Spec:** `docs/superpowers/specs/2026-04-14-fase-1a-foundation-ds-core-design.md` (v3 final).
**Repo alvo do pacote:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-blueprint`
**Repo alvo do consumo:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin`

---

## Sequência de tasks

### Prerequisites (blueprint)

**T1. Setup Vitest + RTL + jsdom no pacote design-system**
- Arquivos: `packages/design-system/vitest.config.ts`, `packages/design-system/test/setup.ts`, `package.json` devDeps.
- Scripts: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`.
- Config `jsdom`, `@testing-library/jest-dom` matchers.
- **`vitest.config.ts` coverage thresholds:** lines 80, branches 80, functions 80, statements 80.
- **Aceite:** `pnpm --filter @nexusai360/design-system test` roda (ainda sem specs = 0 tests, mas sem erro); `test:coverage` falha se threshold descumprido (após componentes).

**T2. Setup size-limit no pacote**
- Arquivo: `packages/design-system/.size-limit.json`.
- Budget: total ≤ 60KB gz; cada subpath (theme-provider, tokens, animations, utils) ≤ 15KB gz.
- Ignore peer deps (`react`, `react-dom`, `@base-ui/react`, `framer-motion`, `lucide-react`, `sonner`, `tailwindcss`, `next`).
- Script: `"size": "size-limit"`.
- **Aceite:** `pnpm --filter @nexusai360/design-system size` reporta sizes atuais sem erro.

**T3. tsup config — sourcemap off + clean**
- Editar `packages/design-system/tsup.config.ts`: `sourcemap: false`.
- Adicionar verificação CI: `find dist -name "*.map" | grep -q . && exit 1`.
- **Aceite:** `pnpm build` produz `dist/` sem `.map`.

### Novos componentes (blueprint/packages/design-system/src/components/)

Cada componente T4–T17 tem aceite adicional obrigatório: **linha correspondente na matriz de `packages/design-system/docs/accessibility.md` preenchida** (contraste, focus, aria, reduced-motion, SR).

**T4. IconTile** — server-safe, `data-color` + CSS custom properties, sizes sm/md/lg, 8 colors. + CSS em `styles.css` para todos os `[data-color=X]` (usa `@theme` vars já existentes).
- **Aceite:** spec §4.8; unit test cobre todas variantes; renderizado em preview; linha a11y preenchida.

**T5. Skeleton** — primitive, variants rect/circle/text, `aria-hidden=true`, `data-slot="skeleton"`, `prefers-reduced-motion`.
- **Aceite:** spec §4.1; unit test.

**T6. LoadingSpinner** — server-safe, sizes sm/md/lg, `role="status"`, `label` visible em lg.
- **Aceite:** spec §4.2; unit test.

**T7. Separator** — wrapper `@base-ui/react` Separator, orientation horizontal/vertical.
- **Aceite:** spec §4.9; unit test.

**T8. Avatar (compound)** — Avatar.Root/Image/Fallback, sizes xs/sm/md/lg/xl.
- **Aceite:** spec §4.10; unit test (image + fallback).

**T9. Tooltip (compound)** — wrapper `@base-ui/react` Tooltip, delay 500ms.
- **Aceite:** spec §4.11; unit test com user-event.

**T10. Tabs (compound)** — wrapper `@base-ui/react` Tabs.
- **Aceite:** spec §4.12; unit test (navegação por teclado).

**T11. DropdownMenu (compound)** — wrapper `@base-ui/react` Menu, com `destructive` variant em Item.
- **Aceite:** spec §4.13; unit test (open/close + item click).

**T12. ScrollArea** — wrapper `@base-ui/react` ScrollArea.
- **Aceite:** spec §4.14; unit smoke.

**T13. EmptyState (compound)** — Root/Icon (IconTile neutral)/Title/Description/Action.
- **Aceite:** spec §4.3; unit test.

**T14. ErrorState (compound)** — Root/Icon (IconTile red)/Title/Description/Details (collapsible)/Action. Details NÃO renderiza stack em `NODE_ENV === "production"`.
- **Aceite:** spec §4.4; unit test cobre prod/dev behavior.

**T15. Breadcrumb (compound)** — Root (`<nav><ol>`)/Item (link or current com `aria-current=page`)/Separator. Disclosure pattern para overflow mobile.
- **Aceite:** spec §4.7; unit test.

**T16. PageHeader (compound)** — Root/Breadcrumb/Row/Icon (via IconTile)/Heading (Title+Description)/Actions.
- **Aceite:** spec §4.6; unit test.

**T17. AppShell (compound, "use client")** — Root/Sidebar (`<nav aria-label=Primária>`)/Header (`<header role=banner>`)/Main (`<main id=main>`). Skip-link no Root. Mobile: sidebar em Dialog com nav interno.
- **Aceite:** spec §4.5; unit test (SSR + mobile breakpoint com `window.matchMedia` mock).

### Barrel, README, Accessibility

**T18. Barrel export** — `packages/design-system/src/index.ts` exporta os 14 novos componentes e suas subpartes. `data-slot` em todos.
- **Aceite:** imports funcionam: `import { Skeleton, AppShell, ... } from "@nexusai360/design-system"`.

**T19. README.md do pacote** — atualizar com seções para cada novo componente + exemplos. Documentar camadas (primitives → composites → shell) e política de telemetria (none).
- **Aceite:** README revisado.

**T20. docs/accessibility.md — consolidação**
- Estrutura inicial do arquivo (cabeçalho, tabela vazia, seção screen-reader smoke) criada no começo, antes dos componentes.
- Linhas por componente são preenchidas em T4–T17 (aceite de cada task).
- T20 consolida: revisão de consistência, tooling (axe, Lighthouse) configurado, screen-reader smoke VoiceOver/NVDA executado e documentado.
- **Aceite:** matriz completa (14 linhas), seção tooling preenchida, evidência SR (audio/texto) linkada.

### CI no blueprint

**T21a. Quality workflow no pacote (blueprint) — blocks T22**
- `.github/workflows/design-system-quality.yml`: roda `pnpm lint`, `tsc --noEmit`, `pnpm test:coverage` (com threshold ≥80%), `size`, `build`, check `dist/*.map` ausente.
- Validação: criar branch `ci/ds-quality-check`, abrir PR draft para disparar o workflow, confirmar verde; só então T22 pode prosseguir. Commit direto em `main` sem CI verde NÃO é aceito.
- **Aceite:** workflow YAML committed; PR draft `ci/ds-quality-check` verde (todos steps green).

**T21b. CRM quality: axe + lighthouse CI — blocks T29**
- `.github/workflows/crm-a11y.yml` (ou extensão do e2e existente): job que sobe o CRM com `DS_PREVIEW=true`, roda `@axe-core/playwright` em `/__ds-preview` em 3 viewports × 2 temas, e `@lhci/cli` autorun em `/__ds-preview`.
- **Aceite:** workflow YAML committed; zero violations axe critical/serious; Lighthouse a11y ≥ 95.

**T22. Publicar v0.3.0**
- `pnpm build` → `pnpm publish --dry-run` → audit programático:
  ```bash
  pnpm --filter @nexusai360/design-system publish --dry-run --json \
    | jq -r '.files[].path' \
    | grep -E '\.(map|env|npmrc)$|secret|\.git' && exit 1 || echo "audit ok"
  ```
- Commit `chore(design-system): release v0.3.0` → tag `v0.3.0-design-system` → push → workflow de publish executa.
- **Aceite:** pacote disponível em GitHub Packages; versão 0.3.0; audit script retornou "audit ok".

### Integração no CRM (nexus-crm-krayin)

**T23. Adicionar dep + `.npmrc` + CI auth**
- `.npmrc` (repo): apenas `@nexusai360:registry=https://npm.pkg.github.com` (sem token).
- Dev local: `~/.npmrc` com `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}`.
- `package.json`: `"@nexusai360/design-system": "^0.3.0"`.
- **CI do CRM** (`.github/workflows/*.yml` que rodam `pnpm install`): adicionar step `actions/setup-node@v4` com `registry-url: "https://npm.pkg.github.com"` + env `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Alternativa: criar `.npmrc` runtime no CI com `//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}`.
- `pnpm install`.
- **Aceite:** `pnpm install` local e CI resolvem o pacote; `node_modules/@nexusai360/design-system/dist/` existe; zero 401 no CI.

**T24. Importar CSS no root layout**
- `src/app/layout.tsx`: `import "@nexusai360/design-system/styles.css"` antes do `./globals.css`.
- **Aceite:** `pnpm build` do CRM passa; estilos continuam.

**T25. Feature flag DS_V3_ENABLED**
- `src/lib/flags.ts`: `export const DS_V3_ENABLED = process.env.DS_V3_ENABLED !== "false"` (default ligado).
- **Aceite:** flag exportada e referenciável.

**T26. Middleware gate + rota /__ds-preview**
- `src/middleware.ts` (criar ou ampliar): matcher `/__ds-preview/:path*`; 404 se `process.env.DS_PREVIEW !== "true"`.
- `src/app/__ds-preview/page.tsx`: `export const dynamic = "force-dynamic"`; renderiza todos os 14 componentes em todas as variantes; import de `@nexusai360/design-system`.
- **Aceite:** `DS_PREVIEW=true pnpm dev` → abrir `/__ds-preview` renderiza; sem flag → 404.

**T27. Playwright smoke (CRM)**
- `tests/e2e/ds-preview.spec.ts`: 3 viewports (390, 768, 1440) × 2 temas (dark/light) abrem `/__ds-preview`, injetam `@axe-core/playwright`, assertam zero violations critical/serious, screenshot baseline.
- Screenshots baseline commitadas em `tests/e2e/ds-preview.spec.ts-snapshots/`.
- Integrar em CI do CRM (T21b cobre; este task produz os specs + baselines).
- **Aceite:** `pnpm test:e2e -- ds-preview` verde local; baselines commitadas.

**T28. Atualizar CLAUDE.md do CRM**
- Remover instruções sobre componentes locais duplicados.
- Adicionar: "UI components vêm de `@nexusai360/design-system` v0.3.0+; componentes locais só para especificidades do CRM (Popover, Checkbox atuais)."
- **Aceite:** CLAUDE.md atualizado.

### Deploy

**T29. Verificação final + deploy**
- Rodar em ambos os repos: `pnpm lint`, `tsc --noEmit`, `test` (com coverage), `build`.
- `pnpm test:e2e -- ds-preview` verde.
- Abrir `/__ds-preview` em staging (se disponível) com `DS_PREVIEW=true` → checks manuais dark/light em mobile/desktop.
- Git tag CRM `phase-1a-deployed` (antes do deploy).
- Deploy Portainer (atualizar imagem Docker do CRM).
- **Aceite:**
  - `curl -fsS https://<prod>/api/health` retorna 200.
  - `/__ds-preview` renderiza em staging (`DS_PREVIEW=true`).
  - Comando verificação logs:
    ```bash
    docker logs --since 5m <crm-container> 2>&1 | grep -iE 'level=error|"level":"error"|ERROR' | wc -l
    ```
    Resultado deve ser 0; se > 0, investigar antes de marcar task como concluída.

**T30. Atualizar memória + Appendix roadmap**
- Registrar em `memory/`:
  - `design-system.iconTile.dataColorPattern` — usa CSS custom properties + `data-color`, não classes Tailwind dinâmicas.
  - `design-system.bundleBudget` — 60KB gz total, 15KB gz por subpath, ignore peer deps.
  - `design-system.dsPreview.middlewareGate` — `/__ds-preview` gated em middleware do CRM, não apenas em page.
  - `design-system.versioning` — bump minor ao adicionar componente; patch para bug fix; deprecate + patch para rollback.
- Atualizar Appendix A do roadmap mestre (`docs/superpowers/specs/2026-04-14-roadmap-mestre-design.md`): marcar itens da Fase 1a como `parity` quando aplicável.
- **Aceite:** 4 memory files criados/atualizados; roadmap Appendix reflete realidade.

---

## Ordem sugerida de execução

1. **Setup (T1, T2, T3)** — paralelo possível.
2. **T4 (IconTile) primeiro** — bloqueia T13/T14/T16.
3. **Componentes base paralelos (T5, T6, T7, T8, T9, T10, T11, T12)** — subagentes em paralelo; cada um produz arquivo(s) + teste + linha na matriz a11y.
4. **Componentes compostos (T13, T14, T15, T16, T17)** — dependem só de T4; usam primitives já existentes em v0.2.0.
5. **Barrel + docs (T18, T19, T20)** — após todos os componentes.
6. **T21a + T22 (quality + publish pacote)** — após T18–T20.
7. **Integração CRM (T23, T24, T25, T26, T27, T28)** — após T22.
8. **T21b (CI a11y CRM)** — depois de T27 (precisa dos specs Playwright + baselines).
9. **Deploy (T29) + memória (T30)** — final.

## Estimativa

- Paralelizado otimisticamente: ~1 dia de engenharia.
- Serial conservador: ~2.5 dias.
- Em modo autônomo com subagents: meio dia a 1 dia.

## Rollback

- Pacote bugado pós-publish: `npm deprecate @nexusai360/design-system@0.3.0` + publish `0.3.1`.
- CRM bugado por causa do consumo: `DS_V3_ENABLED=false` no runtime (kill-switch), ou pin `0.2.0` + redeploy da imagem pré-1a.
- Git tag `phase-1a-deployed` → Portainer rollback rápido.

## Convenção de commits

Todos os commits desta fase seguem Conventional Commits:
- Novos componentes no pacote: `feat(design-system): add <Component>` (ex: `feat(design-system): add IconTile`).
- Infra do pacote: `chore(design-system): <descrição>` (ex: `chore(design-system): setup vitest`).
- Publicação: `chore(design-system): release v0.3.0`.
- Integração CRM: `feat(crm): integrate design-system v0.3.0` / `chore(crm): <descrição>`.
- Documentação: `docs(<scope>): <descrição>`.

Subagents devem seguir esta convenção sem exceção. Cada commit usa HEREDOC com `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` na última linha (prática do repo).

## Dependências externas

- GitHub Packages (publish).
- Token `GITHUB_TOKEN` nativo do CI; `NPM_TOKEN` em dev local via `~/.npmrc`.
- Nenhuma nova dep externa além das já listadas na spec.
