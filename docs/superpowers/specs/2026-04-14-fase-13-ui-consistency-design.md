# Fase 13 — UI Consistency

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fases 12.4/12.5/12.6 deployed

## 1. Contexto

Auditoria visual (2026-04-14) identificou 4 tipos de inconsistência entre
o CRM e o padrão blueprint/design-system:

1. **13 páginas sem `PageHeader` do DS** — todas fazem header custom com
   `motion.div` + ícone inline. Users e Companies (que vêm de vendor UI
   packages) usam PageHeader corretamente e destoam visualmente do resto.
2. **Stagger 0.05 em 3 arquivos** — Leads, Contacts, Opportunities usam
   0.05 enquanto padrão é 0.08 (CLAUDE.md).
3. **Dashboard `space-y-8` outlier** — único arquivo fora do `space-y-6`
   padrão.
4. **tasks-content usa `useTranslations()` next-intl** — outlier; demais
   módulos usam strings PT-BR hardcoded.

## 2. Objetivo

Uniformizar visual do CRM com blueprint. Critério: abrir cada tela lado-a-lado
com Users/Companies e ver o mesmo padrão de header, spacing e animação.

Sucesso:

- Todas as 13 telas usam `<PageHeader.Root>` do `@nexusai360/design-system`.
- Stagger 0.08 unificado em 100% dos `containerVariants` do `(protected)`.
- Dashboard `space-y-6`.
- tasks-content sem `useTranslations()` (strings PT-BR diretas).
- Build passa, login 200 local e prod, headers presentes.

Fora de escopo:

- Mudar o design do PageHeader em si (já vem pronto do DS).
- Traduzir strings para inglês ou manter i18n (CLAUDE.md: texto em PT-BR).
- Redesign de tabelas, dialogs, forms.

## 3. Arquitetura

### 3.1 PageHeader API (do DS)

```tsx
<PageHeader.Root>
  <PageHeader.Row>
    <PageHeader.Icon icon={Target} color="violet" />
    <PageHeader.Heading>
      <PageHeader.Title>Leads</PageHeader.Title>
      <PageHeader.Description>{count} leads cadastrados</PageHeader.Description>
    </PageHeader.Heading>
  </PageHeader.Row>
  <PageHeader.Actions>
    <Button ...>Novo Lead</Button>
  </PageHeader.Actions>
</PageHeader.Root>
```

### 3.2 Telas a migrar

| Tela | Arquivo |
|---|---|
| Leads | `src/app/(protected)/leads/_components/leads-content.tsx` |
| Contatos | `src/app/(protected)/contacts/_components/contacts-content.tsx` |
| Oportunidades | `src/app/(protected)/opportunities/_components/opportunities-content.tsx` |
| Produtos | `src/app/(protected)/products/_components/products-content.tsx` |
| Tarefas | `src/app/(protected)/tasks/_components/tasks-content.tsx` |
| Automações (lista) | `src/app/(protected)/automation/workflows/_components/workflows-list-content.tsx` |
| Automações (form) | `src/app/(protected)/automation/workflows/[id]/_components/workflow-edit-content.tsx` (se existir) |
| Campaigns (lista) | `src/app/(protected)/marketing/campaigns/_components/campaigns-list-content.tsx` |
| Campaigns (new/edit) | idem [id], new |
| Segments (lista) | `src/app/(protected)/marketing/segments/_components/segments-list-content.tsx` |
| Segments (new/edit) | idem |
| Mailboxes | `src/app/(protected)/settings/mailboxes/_components/mailboxes-content.tsx` |
| Feature Flags | `src/app/(protected)/settings/flags/_components/flags-content.tsx` (se existir) |

Priorizar 9 telas principais listadas; sub-rotas (`[id]`, `new`) podem
reutilizar PageHeader mas com dados contextuais.

### 3.3 Stagger fix

Trocar `delay: index * 0.05` → `delay: index * 0.08` em:

- `leads-content.tsx`
- `contacts-content.tsx`
- `opportunities-content.tsx`

### 3.4 Dashboard spacing

`dashboard-content.tsx` L142: `space-y-8` → `space-y-6`.

### 3.5 tasks i18n

Remover `const t = useTranslations("tasks")`; substituir `t("...")` por
literais PT-BR equivalentes. Remover import de `next-intl`.

## 4. Testes

- Build local: `npm run build` passa.
- Smoke local: `node .next/standalone/server.js` + `curl /login` 200.
- Visual: abrir cada tela no navegador local e conferir PageHeader idêntico
  a Users/Companies.

## 5. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| PageHeader.Description quebra se `description` é JSX complexo | baixa | usar texto simples; actions ficam em `PageHeader.Actions` |
| Ícone `color` não cobrir violet | baixa | API aceita IconTileColor; validar tipo |
| tasks i18n remoção quebrar fallback | baixa | strings PT-BR estáticas, não há fallback dinâmico |

## 6. Entregáveis

1. 9+ telas migradas para PageHeader.
2. 3 arquivos com stagger 0.08.
3. Dashboard `space-y-6`.
4. tasks sem next-intl.
5. Build + login local + prod validados.
6. Tag `phase-13-ui-consistency-deployed`.
