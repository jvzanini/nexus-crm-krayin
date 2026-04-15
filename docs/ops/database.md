# Runbook — Database (PostgreSQL)

Operação do Postgres no CRM. Tópicos cobrem migrations, índices assíncronos
(CONCURRENTLY) e mitigação de pools (pgBouncer) que interferem em DDL
long-running.

## pgBouncer e CONCURRENTLY

### Contexto

`CREATE INDEX CONCURRENTLY` e `DROP INDEX CONCURRENTLY` **não podem rodar
dentro de uma transação**. Connection poolers em modo *transaction*
(pgBouncer, PgPool em session mode curto) quebram essas operações em
múltiplas sessões distintas, o que invalida a premissa de "mesma sessão
do início ao fim".

A Fase 5 (Custom Attributes) cria/dropa unique indexes dinâmicos quando
usuários habilitam `isUnique=true` em um attr. Os jobs desses índices
**devem** conectar ao Postgres via conexão direta (sem pool).

### Quando configurar `DIRECT_URL`

Configure `DIRECT_URL` no ambiente quando **qualquer** das condições abaixo
for verdadeira:

- `DATABASE_URL` aponta para um pooler (pgBouncer, Supabase transaction
  pooler, Neon pooled endpoint etc).
- A instância Postgres está atrás de um proxy que faz multiplexing de
  conexões em nível de transação.
- Observa-se erro `ERROR: cannot run inside a transaction block` ou
  `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction` em
  jobs de índice.

Em **dev local** (Postgres direto em `localhost:5432`), `DIRECT_URL` pode
permanecer vazio — os jobs caem no fallback `DATABASE_URL`.

### Formato

`DIRECT_URL` deve ser uma connection string Postgres padrão apontando para
a porta não-pooled:

```
DIRECT_URL=postgresql://user:pass@db-primary.internal:5432/nexus_crm?sslmode=require
```

### Onde é usado

- `prisma.config.ts` → `datasource.shadowDatabaseUrl` (Prisma 7 movida do
  schema para config).
- Jobs `custom-attr-create-index` e `custom-attr-drop-index`
  (`src/lib/jobs/custom-attrs/*`) — abrem `new pg.Client({ connectionString:
  process.env.DIRECT_URL || process.env.DATABASE_URL })`.
- Migrations rodadas via `prisma migrate deploy` em deploy.

### Verificação

Após configurar, valide:

```bash
# Migrations conseguem rodar contra shadow DB
npx prisma migrate status

# Diff contra schema retorna 0 (ou 2 se houve mudança real)
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code

# Job de create-index não bloqueia insert concorrente (teste de staging)
CI_SKIP_HEAVY=false npx vitest run tests/integration/custom-attrs/concurrent-index-under-load.integration.test.ts
```

## Migrations baseline

- Todas as migrations em `prisma/migrations/` são aplicadas em ordem
  cronológica (timestamp).
- Cada migration tem (convenção adotada a partir da Fase 5) um par
  `migration.sql` (Prisma-executed) e `migration.down.sql` (rollback
  manual via `psql`, **não** executado por Prisma).
- Rollback de produção: coordenar janela de manutenção, criar backup via
  `pg_dump`, executar `migration.down.sql` com `psql`, depois remover o
  diretório da migration e o registro em `_prisma_migrations`.
