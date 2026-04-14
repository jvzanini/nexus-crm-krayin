# Plan — Fase 13 UI Consistency

**Spec:** `docs/superpowers/specs/2026-04-14-fase-13-ui-consistency-design.md`
**Branch:** `main`
**Tag:** `phase-13-ui-consistency-deployed`

## Estratégia

2 tasks paralelizáveis via subagent-driven-development, 1 sequencial.

### T1 — Fixes triviais (sem UI mudança de estrutura)

Commit único:

- `leads-content.tsx`, `contacts-content.tsx`, `opportunities-content.tsx`:
  `* 0.05` → `* 0.08` em containerVariants.staggerChildren OU em
  delay={index * 0.05}. Fazer grep preciso antes.
- `dashboard-content.tsx` L142: `space-y-8` → `space-y-6`.
- `tasks-content.tsx`: remover `useTranslations`, substituir `t(...)` por
  strings PT-BR.

Commit: `fix(ui): unificar stagger 0.08 + spacing dashboard + remover next-intl tasks (Fase 13 T1)`.

### T2 — Migrar 13 telas para PageHeader DS

Lista ordenada por módulo:

1. `leads-content.tsx`
2. `contacts-content.tsx`
3. `opportunities-content.tsx`
4. `products-content.tsx`
5. `tasks-content.tsx`
6. `automation/workflows/_components/workflows-list-content.tsx`
7. `automation/workflows/_components/workflow-editor-content.tsx`
8. `marketing/campaigns/_components/campaigns-list-content.tsx`
9. `marketing/campaigns/_components/campaign-editor-content.tsx`
10. `marketing/campaigns/_components/campaign-detail-content.tsx`
11. `marketing/segments/_components/segments-list-content.tsx`
12. `marketing/segments/_components/segment-editor-content.tsx`
13. `settings/mailboxes/_components/mailboxes-content.tsx`

Para cada arquivo:

a) Importar `PageHeader, Button` de `@nexusai360/design-system` (o que já
existir, reaproveitar).
b) Substituir o bloco `motion.div` de header pelo `<PageHeader.Root>...`.
c) Mover ações (botões Novo/Editar) para `<PageHeader.Actions>`.
d) Ícone: escolher da paleta IconTileColor (violet, emerald, blue, amber,
red, purple, zinc, neutral). Sugestões:
   - Leads → Target, violet
   - Contatos → Contact, emerald
   - Oportunidades → TrendingUp, amber
   - Produtos → Package, blue
   - Tarefas → CheckSquare, emerald
   - Automações → Workflow, purple
   - Campaigns → Megaphone, violet
   - Segments → Layers, blue
   - Mailboxes → Mail, blue

Commits atômicos por tela (13 commits) ou agrupar 4-5 por commit (3-4
commits). Preferir atômicos para granular rollback.

### T3 — Validação e deploy

1. `npm run build` local.
2. Standalone local + curl /login 200 + abrir cada tela no browser.
3. Push main → CI build+deploy.
4. Validar prod: `/leads`, `/dashboard`, etc retornando 307 (redirect p/ login).
5. Tag `phase-13-ui-consistency-deployed`.

## Execução paralela

Subagent-driven: dispatch 3 agentes em paralelo, cada um pegando 4-5 arquivos.
Cada agente segue exatamente o template PageHeader (spec §3.1) preservando
lógica de estado/handlers existente. Só muda o bloco de header.

## Rollback

Commits atômicos permitem revert granular. Se uma tela quebrar, revert só
daquela. Se PageHeader do DS quebrar (versão), revert todo o T2.

## Cuidados

- **Não alterar** dialogs, forms, tables, lógica de estado.
- **Preservar** Suspense, Skeleton, Error boundaries.
- Preservar `motion.div` para a **lista/grid** (apenas o header vira PageHeader).
- Manter containerVariants/itemVariants para stagger dos items.
