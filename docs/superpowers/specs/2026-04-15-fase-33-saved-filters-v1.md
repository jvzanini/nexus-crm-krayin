# Spec Fase 33 — Saved Filters (v1 rascunho)

## Objetivo
Opção **I** do HANDOFF. Permitir ao usuário salvar conjunto de filtros (URL query) com nome + marcar como padrão por módulo.

## Modelo proposto
`SavedFilter`: id, userId, companyId, moduleKey enum, name, filters JSON, isDefault, createdAt, updatedAt. Unique `(userId, companyId, moduleKey, name)`. Índice `(userId, companyId, moduleKey)`.

## UI
Dropdown no FilterBar: lista filtros salvos do user no módulo; "Salvar filtros atuais" abre dialog com nome; menu de ações (renomear/excluir/marcar padrão). Quando `isDefault=true` e sem query params, aplica automaticamente no load.

## Server Actions
list/save/update/delete/setDefault. RBAC: só user dono (+tenant). companyId sempre.

## Escopo
8 módulos cobertos (leads/contacts/opps Fase 24 + products/tasks/campaigns/segments/workflows Fase 32).

## Fora de escopo
Compartilhamento entre users. Filtros globais da company. Sync cross-device além do DB.
