# Spec v2 — Fase 26: Bulk Delete em Products (iteração piloto)

**Status:** v2 (review #1 aplicado: escopo reduzido)
**Data:** 2026-04-15

## Review #1 conclusões

Entrega massa única dos 5 módulos é arriscada em modo autônomo — cada módulo tem UI com particularidades (Activity polimórfico, Workflow JSON blocks, Campaign com FK CampaignRecipient). Melhor entregar iterativamente.

## Escopo reduzido (Fase 26)

**APENAS products.** Demais módulos viram fases subsequentes (27 segments+campaigns, 28 workflows+tasks).

### Incluído

- Server action `deleteProductsBulk(ids): ActionResult<{deletedCount}>` com RBAC `products:delete` + tenant scope `companyId`.
- Checkbox column (head + rows) visível somente para `canDelete`.
- `BulkActionBar` componente compartilhado (violeta ↑ slide-in).
- `AlertDialog` confirm ("Excluir N produtos selecionados").
- Integração com `selectedIds: Set<string>`.

### Fora de escopo

- URL sync de filtros (adiar — products já tem filtros locais funcionais; URL sync em 26b).
- Bulk edit (Fase futura).
- Exportação CSV.

## Arquivos tocados

1. `src/lib/actions/products.ts` — adiciona `deleteProductsBulk`.
2. `src/app/(protected)/products/_components/products-content.tsx` — state + UI + AlertDialog bulk.

## Riscos

- Product tem relação 1-N `ProductPrice`. `deleteMany` pode falhar por FK. **Mitigação:** Prisma schema aparenta `onDelete: Restrict` default → cascade manual via transaction se falhar. Testar.
- Se houver `OpportunityProduct` (ou tabela de linha de oportunidade) referenciando product → não poderá excluir produto vinculado. Cliente vê erro agregado no toast.

## Aceite

- [ ] Admin seleciona 2 produtos → BulkActionBar aparece → confirma → 2 produtos removidos.
- [ ] Viewer (sem `products:delete`) não vê checkbox nem BulkActionBar.
- [ ] Tentativa com 0 ids → erro gracioso.
- [ ] Build prod clean, TypeScript sem erros novos.
