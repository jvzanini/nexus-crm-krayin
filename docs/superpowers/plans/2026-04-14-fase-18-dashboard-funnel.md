# Plan — Fase 18 Dashboard Funnel

**Spec:** `docs/superpowers/specs/2026-04-14-fase-18-dashboard-funnel-design.md`
**Branch:** `main`
**Tag:** `phase-18-dashboard-funnel-deployed`

## Tasks

### T1 — Estender `getDashboardData` em `src/lib/actions/dashboard.ts`

Adicionar 3 queries dentro da função:

```ts
// Funnel
const [leadsCount, contactsCount, oppsCount, wonCount] = await Promise.all([
  prisma.lead.count({ where: { companyId, createdAt: { gte: periodStart } } }),
  prisma.contact.count({ where: { companyId, createdAt: { gte: periodStart } } }),
  prisma.opportunity.count({ where: { companyId, createdAt: { gte: periodStart } } }),
  prisma.opportunity.count({
    where: { companyId, stage: "closed_won", createdAt: { gte: periodStart } },
  }),
]);

// Pipeline by stage
const pipelineRaw = await prisma.opportunity.groupBy({
  by: ["stage"],
  where: { companyId },
  _count: { _all: true },
  _sum: { value: true },
});

// Top opportunities
const topOpps = await prisma.opportunity.findMany({
  where: {
    companyId,
    stage: { notIn: ["closed_won", "closed_lost"] },
  },
  orderBy: { value: "desc" },
  take: 5,
  include: { contact: { select: { firstName: true, lastName: true } } },
});
```

Retornar `funnel`, `pipelineByStage`, `topOpportunities` normalizados.

### T2 — 3 cards novos

Estrutura: `src/components/dashboard/cards/{funnel,pipeline-value,top-opportunities}-card.tsx`

Cada um recebe props de dados, renderiza Card + título + body com visualização.

**FunnelCard:**
```tsx
<Card className="border-border bg-card/50 rounded-xl p-6">
  <h3 className="text-base font-semibold mb-4">Funil de conversão</h3>
  <div className="space-y-2">
    {data.map((step, i) => {
      const widthPct = data[0].count > 0 ? (step.count / data[0].count) * 100 : 0;
      return (
        <div key={step.stage}>
          <div className="flex justify-between text-sm mb-1">
            <span>{STAGE_LABELS[step.stage]}</span>
            <span className="font-semibold">{step.count}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 rounded-full"
              style={{ width: `${widthPct}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
</Card>
```

**PipelineValueCard:** similar com BarChart horizontal da Recharts, cores por
STAGE_COLORS.

**TopOpportunitiesCard:** lista simples com avatar iniciais, nome, valor R$,
badge stage colorido.

### T3 — Integrar em dashboard-content

Adicionar após LineChart existente:

```tsx
<div className="grid gap-6 md:grid-cols-3">
  <FunnelCard data={data.funnel} />
  <PipelineValueCard data={data.pipelineByStage} />
  <TopOpportunitiesCard data={data.topOpportunities} />
</div>
```

### T4 — Build + smoke + commit + push

- `npm run build` passa.
- Commits atômicos (1 por arquivo novo + 1 para action + 1 para integração).
- Push.
- Tag após CI success.

## Rollback

Cada commit isolado. Se funnel quebra, revert só do card.

## Coordenação

Executar após Fase 17 CI verde (evita conflito em dashboard-content se tiver
mudanças pendentes).
