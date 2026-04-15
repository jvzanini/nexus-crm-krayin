# Fase 23 — Reports/Analytics Avançado

**Data:** 2026-04-15
**Status:** spec v3
**Depends on:** Fase 18 (dashboard funnel), Fase 17 (pipeline), Fase 15 (RBAC).

## 1. Contexto

Dashboard atual (Fase 18) mostra métricas básicas: stats cards, LineChart
trend, FunnelCard, PipelineValueCard, TopOpportunitiesCard. Bom para visão
geral, mas não responde perguntas mais profundas tipo:

- Qual minha receita prevista para os próximos 90 dias?
- Quais leads têm maior taxa de conversão por fonte?
- Quem da equipe tem melhor performance de fechamento?
- Como evoluiu o pipeline mês a mês?

Blueprint consultado: sem pattern dedicado de Reports em
`/nexus-blueprint/patterns/`. Seguir design tokens de
`core/design-system.md` + composição tipo dashboard-content.

## 2. Objetivo

Nova rota `/reports` com 4 relatórios iniciais:

1. **Receita Prevista** (Revenue Forecast) — gráfico area stacked por mês
   × stage (next 6 meses), baseado em `value × probability` das opps abertas
   com `closeDate`.
2. **Oportunidades por Source** — bar chart ranqueando fontes de origem das
   opportunities (`Opportunity.source` é campo opcional) pelo valor total
   ganho + taxa de conversão para `closed_won`. `Lead.source` não existe no
   schema atual.
3. **Performance por Owner** — ranking dos 10 top performers com # opps
   fechadas + valor total ganho + taxa de conversão (stages open vs won).
   "Owner" = `Opportunity.createdBy` (não há campo `ownerId` dedicado ainda;
   considerar adicionar em follow-up).
4. **Pipeline Evolution** — LineChart com evolução do valor total do pipeline
   (agregado de todas as opps não-fechadas) nos últimos 12 meses (snapshots
   semanais preservados via audit-log/log separado).

Critérios de sucesso:

- `/reports` acessível para admin, manager, viewer (somente `audit:view` ou
  implícito — todos veem).
- 4 cards de report com skeletons loading.
- Export CSV em cada report.
- Filtros de período (últimos 7d, 30d, 90d, 365d, custom) globais.
- Responsivo (mobile = vertical stack, desktop = 2×2 grid).

Fora de escopo:

- Report builder customizado (Fase 11 dedicada).
- Relatórios agendados por email.
- Dashboards pré-configurados por role.
- Integração com Google Analytics/Mixpanel.
- Métricas que requerem feature novo (ex: source tracking — usar só se já existir).

## 3. Arquitetura

### 3.1 Rota + Page

```
src/app/(protected)/reports/
  page.tsx              # Server Component, busca todos os datasets
  loading.tsx           # Skeleton 4 cards
  _components/
    reports-content.tsx        # Client, orquestra filtros + 4 cards
    revenue-forecast-card.tsx  # AreaChart Recharts
    leads-by-source-card.tsx   # BarChart Recharts
    owner-performance-card.tsx # tabela ranking
    pipeline-evolution-card.tsx # LineChart Recharts
    period-filter.tsx          # select "últimos Xd" + custom date range
```

### 3.2 Server Action

**`src/lib/actions/reports.ts`** (novo arquivo), com:

```ts
export async function getReportsData(filter: {
  periodDays?: number; // 7, 30, 90, 365
  customStart?: string;
  customEnd?: string;
}): Promise<ReportsData> {
  const user = await requirePermission("audit:view");
  const companyId = await requireActiveCompanyId(user.id);
  // 4 queries em paralelo:
  return {
    revenueForecast: await buildRevenueForecast(companyId, filter),
    leadsBySource: await buildLeadsBySource(companyId, filter),
    ownerPerformance: await buildOwnerPerformance(companyId, filter),
    pipelineEvolution: await buildPipelineEvolution(companyId, filter),
  };
}
```

**RBAC:** `audit:view` já está na matriz — permite admin, super_admin, manager
(não viewer). Se quisermos permitir viewer, criar permission `reports:view`.

Decisão MVP: reusar `audit:view`. Follow-up pode criar perm dedicado.

### 3.3 CSV Export

Função shared `src/lib/reports/csv-export.ts`:

```ts
export function toCSV<T extends object>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(","));
  }
  return lines.join("\n");
}
```

Cada card expõe botão "Exportar CSV" que gera blob + `a.download`.

### 3.4 Pipeline Evolution — persistência

Fase MVP: calcular on-the-fly via snapshots derivados do `audit_logs` (ações
`opportunity.stage.changed`). Em dev: mock 12 semanas.

Fase follow-up: cronjob que salva snapshot semanal em tabela `pipeline_snapshots`.

Para não bloquear MVP: gerar curva suave a partir do valor atual do pipeline
com variação ±15% aleatória estável (seeded por `companyId`). **Decisão:** é
aceitável para MVP mas documentar como placeholder que será substituído por
dados reais na Fase 23b.

## 4. Navegação

Adicionar em `src/lib/constants/navigation.ts`:

```ts
{ label: "Relatórios", href: "/reports", icon: BarChart3, allowedRoles: ["super_admin", "admin", "manager"] },
```

Inserir entre "Pipeline" e "Empresas" (agrupamento lógico por conteúdo
analítico).

## 5. Testes

- E2E: `golden-paths/reports.spec.ts` — admin/manager acessam `/reports` 200,
  viewer redirect (ou 403).
- Unit: mock prisma, validar shape do `getReportsData`.

## 6. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Queries pesadas (groupBy + aggregates) | média | paginar topOwners em 10; limitar data range |
| CSV com >10k linhas trava browser | baixa | limit 5000 per export; alertar usuário |
| Recharts + SSR hidration mismatch | baixa | já usado em dashboard-content sem issue |
| Pipeline Evolution placeholder enganoso | alta | mostrar banner "dados estimados" no card |

## 7. Entregáveis

1. Rota `/reports` + page + loading.
2. 4 cards de report.
3. `getReportsData` server action + RBAC + tenant-scope.
4. CSV export shared util.
5. Item "Relatórios" na sidebar (restricted admin/manager).
6. E2E spec reports.
7. Tag `phase-23-reports-deployed`.

## 8. Não-objetivos explícitos

- Reports configuráveis por user.
- Cron de snapshots (follow-up 23b).
- Gráficos com drilldown interativo.
- Comparação entre períodos (deixar para Fase 23c).
