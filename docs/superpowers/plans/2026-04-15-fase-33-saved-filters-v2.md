# Plan Fase 33 — Saved Filters (v2 pós-review #1)

Intermediário entre v1 (rascunho) e v3 (final). Review #1 findings:
- v1 com tasks agregadas demais.
- Sem dependências entre grupos explícitas.
- Sem procedimento migration psql detalhado.
- Sem critério sucesso por task.

v2 adiciona:
- Grupos A (actions+tests) / B (UI) / C (integração 8 módulos) / D (E2E+deploy).
- Dependências A/B → C → D.
- Migration psql documentada.
- Testes Vitest mínimos listados.

Ver v3 para forma final com paralelização explícita e riscos de concorrência no default.
