# Plan v2 — Fase 5 Custom Attributes

**Status:** v2 (pós Review 1 — 6 críticos + 11 importantes endereçados; pronto para Review 2)
**Base:** plan v1 (`2026-04-15-fase-5-custom-attributes-v1.md`) — este v2 substitui v1 nos pontos listados e mantém o resto.

## Deltas v1 → v2

### Críticos resolvidos

**C1 — Jobs movidos para padrão worker/queues.** Paths:
- `src/lib/worker/queues/custom-attr-index.ts` — queue + enqueue helpers.
- `src/lib/worker/processors/custom-attr-create-index.ts`
- `src/lib/worker/processors/custom-attr-drop-index.ts`
- `src/lib/worker/processors/custom-attr-purge-values.ts`
- `src/lib/worker/boot.ts` — **modificado** para registrar os 3 processors.
- Nova task **T9.0** "Queue registration" antes de T9/T10/T11.

**C2 — Migration Prisma workflow correto.** T1 reescrito:
1. Editar `prisma/schema.prisma` (models + enums + `custom Json`). **Nenhum `@@index([custom], type: Gin)`.**
2. `npx prisma migrate dev --name custom_attributes --create-only` — gera migration.sql minimalista (sem GIN, porque o schema não declara).
3. **Escrever do zero** (append) no final do `migration.sql`:
   ```sql
   CREATE INDEX idx_lead_custom ON leads USING gin (custom jsonb_ops);
   CREATE INDEX idx_contact_custom ON contacts USING gin (custom jsonb_ops);
   CREATE INDEX idx_opportunity_custom ON opportunities USING gin (custom jsonb_ops);
   ```
4. `npx prisma migrate dev` aplica. Rodar 2ª vez para confirmar drift-free: `npx prisma migrate status`.
5. Rollback: `prisma/migrations/<ts>_custom_attributes/migration.down.sql` (comentário — aplicado manual via `psql`).

Aceite de T1 **removido** "18 colunas" (I8). Novo aceite:
- `npx prisma migrate status` limpo após apply.
- `\d+ custom_attributes` em psql mostra todas colunas declaradas no schema.
- `\di+ idx_lead_custom` confirma GIN + jsonb_ops.
- Rodar `migrate dev` pela 2ª vez NÃO propõe alteração.

**C3 — `DIRECT_URL` para CONCURRENTLY.** T9/T10 atualizados:
- Usar `new PgClient({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })`.
- Justificativa: pgBouncer em transaction-pooling mode incompatível com `CREATE/DROP INDEX CONCURRENTLY`.
- Nova seção no aceite: "índice criado com `DIRECT_URL` válido; se apenas `DATABASE_URL` disponível, falha loud com erro claro".
- Validar em staging.

**C4 — Purge retomável sem OFFSET.** T11 reescrito:
```typescript
const tableName = `${entity}s`;
while (true) {
  const { count } = await prisma.$executeRaw`
    UPDATE ${Prisma.raw(tableName)}
    SET custom = custom - ${key}
    WHERE id IN (
      SELECT id FROM ${Prisma.raw(tableName)}
      WHERE company_id = ${companyId} AND custom ? ${key}
      LIMIT 500
    )`;
  if (count === 0) break;
  progressCallback({ purged: totalPurged += count });
}
```
- Sem OFFSET: cada iteração seleciona rows que AINDA matcham. Quando chega 0, fim.
- BullMQ job idempotency key: `purge:<entity>:<key>:<companyId>`.
- Aceite novo: "purge sobrevive crash — kill pod no meio → retomar job → zero rows duplicadas/puladas".

**C5 — TDD declarado por task.** Cabeçalho do plan agora traz regra global:
> Cada task de impl segue TDD: (1) escrever teste falhando; (2) impl mínima; (3) verde; (4) refactor. Invocar `superpowers:test-driven-development` skill antes de cada task de impl. Tasks marcadas **(TDD)** abaixo.

Aplicado em: T3, T4, T5, T6, T7, T8a/b/c, T9, T10, T11, T13a/b/c, T15, T16, T17, T18, T19.

**C6 — Cobertura spec v3 gaps.**
- T8a: aceite adiciona "audit-log do create não persiste `custom` valor; só `{resourceType, action, resourceId, changes: keys-diff}`".
- T9/T21: aceite "CREATE INDEX CONCURRENTLY sob carga — integration test insere 1000 rows durante o CREATE; sem erros".
- T15/T16/T17: aceite novo "capturar `P2002` Prisma em createLead/updateLead → retornar `{success:false, error: 'Valor duplicado em <label>'}`; label obtido via `listCustomAttributes`".
- T-Workers (novo): teste que workers NÃO importam `next/cache`; usam Prisma direto.

### Importantes resolvidos

**I1 — T13 quebrada:**
- T13a — `CustomFieldInput.tsx` + `CustomFieldsSection.tsx` (form).
- T13b — `CustomColumnsRenderer.tsx` (tabelas).
- T13c — `CustomFiltersSection.tsx` (filter-bar).

T15/T16/T17 dependem de T13a+T13b. T18 depende de T13c.

**I2 — T8 quebrada:**
- T8a — `listCustomAttributesAction`, `getCustomAttribute`, `createCustomAttribute`.
- T8b — `updateCustomAttribute`, `deleteCustomAttribute` (encadeamento purge→drop).
- T8c — `reorderCustomAttributes`.

**I3 — T12 reposicionada:** movida para entre T2 e T3 (flag seed é pré-requisito de T14 page renderer).

**I4 — T14 aceite atualizado:** adiciona "unit test: flag `feature.custom_attributes=false` → rota 404; `=true` → 200".

**I5 — Paralelismo T15/T16/T17 especificado:** dependem de `T4+T5+T7+T8a+T13a+T13b`. Declarado no grafo.

**I6 — T6 teste de regressão underscore:**
- Caso específico: key `total_eq_value` + op `eq` → `cf_total_eq_value_eq=5` resolve `{key: "total_eq_value", op: "eq", value: "5"}`.

**I7 — T9 aceite sob carga:** adicionado (ver C6 acima).

**I8 — T1 aceite "18 colunas"** removido (ver C2).

**I9 — Rollback explicitado (política global no cabeçalho):**
> Todas as tasks aditivas (novos arquivos): rollback = `git revert`. Tasks de migration/DB: rollback SQL documentado em migration.down.sql. Tasks de UI: rollback = feature flag OFF. Tasks de jobs: drain queue + `DROP INDEX IF EXISTS`.

**I10 — T12 seed append:** "se `prisma/seed.ts` existe, append bloco; senão criar. Evitar sobrescrever seed existente".

**I11 — T19 DSAR aceite:** "anonymize preserva keys não-PII; `piiMasked:true` keys zerados".

### Sugestões aplicadas

**S2 — T0 baseline:** nova task T0 "rodar `npm run test && npm run build && npm run lint` antes de T1; registrar baseline 464/464 Vitest + build time".

**S3 — T23 extended:** adicionar `npx prisma migrate status` + `npx prisma format --check`.

**S6 — UI-UX Pro Max:** T13a e T14 invocam `ui-ux-pro-max:ui-ux-pro-max` skill antes da impl.

**S8 — Commit strategy:** 1 commit por task (`feat(custom-attrs): T<n>/<total> — <slug>`). Squash opcional no fim.

**S9 — Index naming util:** novo arquivo `src/lib/custom-attributes/index-naming.ts` (T3.5 — sub-task). Testa truncamento 63 chars PG.

**S10 — Cross-tenant unique teste:** T21 adiciona caso "tenant A e B ambos `cpf:123` `isUnique:true` — ambos inserem sem violação".

## Grafo atualizado

```
T0 baseline
 └─ T1 schema+migration
     ├─ T2 rbac permissions
     ├─ T12 flag seed
     └─ T3 types+limits
         ├─ T3.5 index-naming util
         ├─ T4 validator (TDD)
         ├─ T5 query-builder (TDD)
         └─ T6 custom-parser (TDD)
             └─ T7 list cached (TDD)
                 ├─ T8a list/get/create action (TDD)
                 ├─ T8b update/delete action (TDD)
                 ├─ T8c reorder action (TDD)
                 ├─ T9.0 queue registration
                 │   ├─ T9 create-unique-index processor (TDD)
                 │   ├─ T10 drop-unique-index processor (TDD)
                 │   └─ T11 purge-values processor (TDD)
                 ├─ T13a Input+Section (TDD + ui-ux-pro-max)
                 ├─ T13b ColumnsRenderer (TDD)
                 └─ T13c FiltersSection (TDD)
T7+T8a+T8b+T13a → T14 settings UI (+ ui-ux-pro-max)
T4+T5+T7+T8a+T13a+T13b → T15 leads integration
                        ├─ T16 contacts integration
                        └─ T17 opportunities integration
T13c → T18 filter-bar extension
T7 → T19 DSAR + logger PII
T4..T19 → T20 unit tests pass (≥45 testes)
T8+T9+T10+T11 → T21 integration tests
T14..T18 → T22 E2E tests
T20+T21+T22 → T23 build+lint+audit+migrate status
T23 → T24 docs + memória
T24 → T25 commits por task + push + CI
T25 → T26 tag phase-5-deployed
```

## Tasks totais

31 tasks (T0 + T1–T26 com T3.5, T8a–c, T9.0, T13a–c sub-tasks).

## Paralelismo

- **Wave A (após T3):** T4, T5, T6 em paralelo (independentes).
- **Wave B (após T7+T3):** T8a+T8c, T9.0+T13a+T13b+T13c.
- **Wave C (após T13a+T13b+T8a+T8b):** T15+T16+T17 em paralelo.
- **Wave D:** T21+T22 em paralelo (após impl completa).

## Duração autônoma (subagents paralelos)
- Wave A: 30min
- Wave B: 1h
- Wave C: 1h
- Wave D: 45min
- Docs + ship: 30min
- **Total ~3h30 em paralelo autônomo.**

## Ordem de execução recomendada (subagent-driven-development)

1. Spawn 1 agent: T0 + T1 + T2 + T12 (sequential, single thread).
2. Spawn 1 agent: T3 → T3.5.
3. Spawn 3 agents paralelos: T4, T5, T6.
4. Join → Spawn agent T7.
5. Join → Spawn 5 agents paralelos: T8a, T8c, T9.0, T13b, T13c.
6. Join → Spawn 2 agents: T8b (encadeamento delete→purge→drop), T13a.
7. Join → Spawn 3 agents paralelos: T15, T16, T17.
8. Spawn 3 agents paralelos: T9, T10, T11 (jobs implementados após T9.0).
9. Spawn 2 agents paralelos: T18, T19.
10. Spawn 1 agent: T14.
11. Join → Spawn 3 agents paralelos: T20, T21, T22.
12. Join → Spawn 1 agent: T23 (verification).
13. Spawn 1 agent: T24 (docs).
14. Spawn 1 agent: T25 (commits + push + CI monitor).
15. Spawn 1 agent: T26 (tag + deploy).

## Detalhes mantidos de v1

Tasks T1–T26 mantêm contratos, aceites (ajustados conforme deltas acima), e arquivos. Ver v1 para full details — este v2 é **apêndice de deltas**, não substituto integral.
