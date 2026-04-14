# Fase 18 — Dashboard Funnel & Métricas Avançadas

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fase 17 (pipeline kanban) e Fase 15 (RBAC)

## 1. Contexto

Dashboard atual (`src/components/dashboard/dashboard-content.tsx`) mostra:
- Stats cards (totalLeads, contacts, openOpportunities, conversionRate)
- LineChart de leads/opportunities por período
- Feed de atividades recentes

Gaps percebidos pelo usuário final:
- Sem visão de **funnel de conversão** (onde leads param).
- Sem **valor pipeline por stage** (quanto $ está em cada etapa).
- Sem **top opportunities** por valor ou probabilidade.

## 2. Objetivo

Adicionar 3 visualizações novas ao dashboard (abaixo do LineChart existente,
sem remover nada):

1. **FunnelCard** — barras horizontais diminuindo: All Leads → Qualified
   (contacts) → Opportunities → Won. Usa counts totais do período.
2. **PipelineValueCard** — bar chart horizontal com valor R$ total por stage
   (6 stages). Reusa STAGE_LABELS/COLORS da Fase 17.
3. **TopOpportunitiesCard** — lista das top 5 oportunidades por valor, com
   nome, contato, valor R$, probabilidade, stage.

Critérios de sucesso:

- Dashboard carrega sem layout shift.
- Queries adicionais respeitam tenant scope (usa `requireActiveCompanyId`).
- Responsivo: 3 cards em grid 3-col desktop, 1-col mobile.

Fora de escopo:

- Configurar período dos novos cards (segue filtro global do dashboard).
- Exportar CSV.
- Drill-down click.
- Mudar stats cards existentes.

## 3. Arquitetura

### 3.1 Server Action — estender `getDashboardData`

Adicionar 3 campos ao retorno:

```ts
interface DashboardData {
  // ... existentes
  funnel: { stage: "leads" | "contacts" | "opportunities" | "won"; count: number }[];
  pipelineByStage: { stage: OpportunityStage; count: number; valueCents: number }[];
  topOpportunities: {
    id: string;
    title: string;
    value: number | null;
    probability: number | null;
    stage: OpportunityStage;
    contactName: string | null;
  }[];
}
```

Queries:
- funnel: 4 counts agregados (leads.count, contacts.count, opps.count,
  opps where stage=closed_won).
- pipelineByStage: `groupBy stage` com `_count` e `_sum.value`.
- topOpportunities: `findMany orderBy value desc, take 5`, filter stage ≠ closed_lost.

### 3.2 Componentes novos (client)

3 cards usando shadcn Card + Recharts:

```tsx
<FunnelCard data={data.funnel} />
<PipelineValueCard data={data.pipelineByStage} />
<TopOpportunitiesCard data={data.topOpportunities} />
```

Layout: grid `md:grid-cols-3 gap-6` abaixo do LineChart existente.

Cores: usar STAGE_COLORS da Fase 17 (via lib/opportunities/stage-config.ts)
para consistência.

### 3.3 Blueprint compliance

Consultado `core/design-system.md` — seguir tokens já usados no dashboard
atual: cards `border-border bg-card/50 rounded-xl p-6`, heading `text-base
font-semibold`, valores destaque `text-2xl font-bold`.

## 4. Componentes afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/actions/dashboard.ts` | adiciona funnel/pipelineByStage/topOpportunities |
| `src/components/dashboard/dashboard-content.tsx` | renderiza 3 cards novos |
| `src/components/dashboard/cards/funnel-card.tsx` | novo |
| `src/components/dashboard/cards/pipeline-value-card.tsx` | novo |
| `src/components/dashboard/cards/top-opportunities-card.tsx` | novo |

## 5. Testes

- Unit: mock prisma, validar shape do retorno de `getDashboardData`.
- E2E: admin dashboard renderiza cards (test já existe `/dashboard renderiza`,
  só verificar que não quebra).

## 6. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Query pesada (top 5 ordenando por value) | baixa | index em opportunities.value existe; limit 5 |
| Empty state quando sem dados | média | cada card tem fallback "Sem dados ainda" |
| Mobile layout quebrado | baixa | grid responsive + max-width |

## 7. Entregáveis

1. 3 componentes novos + server action estendida.
2. Commits atômicos (1 por card + 1 server).
3. Tag `phase-18-dashboard-funnel-deployed`.
