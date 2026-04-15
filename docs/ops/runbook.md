# Runbook — Nexus CRM

**Versão:** 1.0 (Fase 12.5)
**Última revisão:** 2026-04-14

---

## 1. Deploy

### 1.1. Procedure

1. Merge PR para `main`.
2. Push dispara GitHub Actions: `test → build → push GHCR → deploy Portainer`.
3. Portainer rollout automático (quando webhook configurado) ou manual via UI.
4. Migrations: aplicar via psql diretamente no container `db` (Prisma v7 não suporta `migrate deploy` no runtime).

**Comandos:**

```sh
# Migration apply (dentro do container db)
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin \
  < prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql

# Verificar se migration foi aplicada
docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

**Verificação pós-deploy:**

```sh
# Liveness
curl -f https://crm2.nexusai360.com/api/health

# Readiness (DB + Redis)
curl -f https://crm2.nexusai360.com/api/ready
```

### 1.2. Rollback

1. Identifique tag anterior: `git tag --list | grep phase`.
2. No Portainer UI: selecione o serviço `nexus-crm-app` → "Update" → altere a imagem para a tag anterior do GHCR.
3. Migration down (se aplicável):
   ```sh
   docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin \
     < prisma/migrations/YYYYMMDDHHMMSS_name/down.sql
   ```
4. Verifique `/api/ready` retornando 200.

---

## 2. LEI ABSOLUTA #1 — Debug via Portainer logs

> **Ao debugar erro em prod/deploy, PRIMEIRA ação = puxar logs do container
> via Portainer API.** Nunca sair de commit em commit adivinhando. Esta lei
> é consagrada em `CLAUDE.md` §LEIS ABSOLUTAS.

**Por quê:** em 2026-04-14 perdemos ~4h em fixes especulativos (Sentry, TS
types, DS transpilePackages) para um bug de dual React. Os logs do container
mostraram em 5 segundos:
> `TypeError: Cannot read properties of null (reading 'useContext')` → dual React

Após adotar a lei, o debug do login 500 pós-Fase 12.4 levou ~15min (identificou
migrations pendentes + dual React em vendor UI).

**Comando canônico (para serviço app):**

```sh
export PTOKEN=$(grep '^PORTAINER_TOKEN=' .env.production | sed 's/^PORTAINER_TOKEN=//')
export PURL=$(grep '^PORTAINER_URL=' .env.production | cut -d= -f2)

TASK=$(/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/tasks?filters=%7B%22service%22%3A%5B%22nexus-crm-krayin_app%22%5D%7D")
CID=$(echo "$TASK" | python3 -c "import json,sys; d=json.load(sys.stdin); r=[t for t in d if t.get('Status',{}).get('State')=='running']; print(r[0]['Status']['ContainerStatus']['ContainerID'][:12] if r else '')")

/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/containers/$CID/logs?stdout=1&stderr=1&tail=400&timestamps=1" \
  | tail -200
```

**Variações por serviço:** trocar o filtro `nexus-crm-krayin_app` por:

- `nexus-crm-krayin_worker` — BullMQ worker (automation, email, reminders)
- `nexus-crm-krayin_db` — PostgreSQL
- `nexus-crm-krayin_redis` — Redis cache/queue

**Quando aplicar (ordem de precedência):**

1. Antes de qualquer novo commit de fix quando prod retorna 500/erro opaco.
2. Antes de criar debug endpoints `/api/debug/*`.
3. Após cada rollout novo quando causa anterior não identificada.

**Anti-padrão:** commits especulativos em sequência tentando adivinhar causa.
Se 2 pushes não resolveram, parar e buscar logs.

**Exemplo real (2026-04-14):**

```
⨯ TypeError: Cannot read properties of null (reading 'useState')
    at ignore-listed frames { digest: '612042259' }
⨯ Error [PrismaClientKnownRequestError]: 
Invalid `prisma.lead.findMany()` invocation:
The column `leads.consent_marketing` does not exist in the current database.
```

→ dois problemas distintos identificados de uma vez: dual React + schema
desatualizado. Fix em 2 commits específicos (sem chute).

**Referências:**

- `CLAUDE.md` §LEIS ABSOLUTAS
- Memory: `law_debug_via_container_logs`

---

## 3. On-call triage

### 3.1. App caiu (`/api/health` falha)

1. Verificar Portainer: container `nexus-crm-app` está `running`?
2. Verificar logs recentes:
   ```sh
   docker logs nexus-crm-app --tail 100
   ```
3. Verificar DB:
   ```sh
   docker exec nexus-crm-db pg_isready -U nexus -d nexus_crm_krayin
   ```
4. Verificar Redis:
   ```sh
   docker exec nexus-crm-redis redis-cli ping
   ```
5. Se todos os serviços estão up, verificar memória/disco:
   ```sh
   docker stats --no-stream
   df -h
   ```
6. Reiniciar app como último recurso:
   ```sh
   docker restart nexus-crm-app
   ```

### 3.2. Worker não processa (reminders/emails atrasam)

1. Verificar logs do worker:
   ```sh
   docker logs nexus-crm-worker --tail 100
   ```
2. Verificar filas Redis acumuladas:
   ```sh
   docker exec nexus-crm-redis redis-cli KEYS "bull:*"
   docker exec nexus-crm-redis redis-cli LLEN "bull:email-queue:waiting"
   ```
3. Se fila grande acumulada e worker travado, reiniciar:
   ```sh
   docker restart nexus-crm-worker
   ```
4. Se persistir, verificar se SMTP/Resend está respondendo e se `RESEND_API_KEY` está configurada.

### 3.3. Migration falhou em deploy

1. Verificar logs do step de migration no GitHub Actions ou Portainer.
2. Tentar migration manual via psql:
   ```sh
   docker exec -i nexus-crm-db psql -U nexus -d nexus_crm_krayin \
     < prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql
   ```
3. Se migration tem erro irreversível (constraint violation, etc.):
   - Rollback imagem para versão anterior (ver §1.2).
   - Aplicar migration `down.sql` se disponível.
   - Investigar causa raiz antes de nova tentativa.
4. Registrar incidente no Slack `#deploys`.

### 3.4. `/api/ready` retorna 503

- **DB unreachable:** verificar `DATABASE_URL` env no Portainer + container `nexus-crm-db` up.
- **Redis unreachable:** verificar `REDIS_URL` env + container `nexus-crm-redis` up.
- Se for falha transiente, o healthcheck do Portainer deve reiniciar automaticamente (aguardar 1–2 min).
- Verificar rede Docker:
  ```sh
  docker network inspect rede_nexusAI
  ```

### 3.5. Automation loop (quota exceeded / notification spam)

1. Acessar `/automation/workflows` no CRM.
2. Identificar workflow com mais execuções recentes (ordenar por `lastRunAt`).
3. Pausar manualmente via toggle para `paused`.
4. Investigar conditions/actions — há ciclo entre workflows? (ex: workflow A triggera evento que ativa workflow B que triggera A).
5. Corrigir a lógica antes de reativar.

### 3.6. Login 500 (rota SSR quebrada, api/health 200)

1. Aplicar LEI #1 (§2) — logs do container `_app`.
2. Procurar por `TypeError: Cannot read properties of null` → ver Playbook 4.1.
3. Procurar por `PrismaClientKnownRequestError ColumnNotFound` → ver Playbook 4.3.
4. Procurar por `Missing API key` / `new Resend` → ver Playbook 4.2.

---

## 4. Playbooks de incidentes resolvidos

Case studies dos incidentes resolvidos em sessões autônomas. Servem de
referência rápida para reconhecer padrões parecidos no futuro.

### 4.1. Login 500 / dual React em vendor UI packages (2026-04-14)

**Sinais:**

- `/login` retorna 500.
- `/api/health`, `/api/ready` retornam 200 (DB + Redis OK).
- Log do container `_app`:
  > `TypeError: Cannot read properties of null (reading 'useState')` com `digest: '612042259'`

**Causa raiz:** vendor UI packages (`@nexusai360/profile-ui`, `settings-ui`,
`users-ui`, `companies-ui`, `design-system`, etc.) estavam em
`serverExternalPackages`. Next standalone copia o pacote para node_modules e
o `require()` em runtime cria **segunda instância de React** — um de dentro
do bundle Next (via turbopack alias), outro do node_modules copiado.

**Fix:** mover todos os vendor UI packages de `serverExternalPackages` para
`transpilePackages` em `next.config.ts`. `turbopack.resolveAlias` já garantia
instância única para o bundle; com transpile, vendor packages passam pelo
mesmo bundle e compartilham a instância.

**Validação local:** `npm run build && node .next/standalone/server.js` +
`curl /login` retorna 200.

**Commit:** `67358a1` — `fix(prod): vendor @nexusai360/* em transpilePackages (resolve dual React)`.

### 4.2. Build falha "Missing API key" em `new Resend()` (2026-04-14)

**Sinais:**

- CI Docker build log:
  > `Error: Missing API key. Pass it to the constructor 'new Resend("re_123")'`
- Falha durante "Collecting page data for /profile" no `next build`.

**Causa raiz:** `src/lib/email.ts` e `src/lib/worker/index.ts` instanciavam
`new Resend(process.env.RESEND_API_KEY)` em top-level. Resend v4 valida
API key no construtor; quebra quando env var ausente (CI build container
não tem `RESEND_API_KEY`).

**Fix:** lazy `getResend()` que só chama `new Resend()` na primeira invocação:

```ts
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing_key");
  }
  return _resend;
}
```

**Commit:** `3a6482e` — `fix(build): lazy-load Resend client`.

### 4.3. Schema DB desatualizado / `ColumnNotFound` (2026-04-14)

**Sinais:**

- Log app `_app`:
  > `Invalid 'prisma.lead.findMany()' invocation: The column 'leads.consent_marketing' does not exist in the current database`

**Causa raiz:** migrations 20260415..20260424 estavam no repo mas nunca
aplicadas em prod. Prisma v7 **não suporta `migrate deploy` em runtime** —
o script pre-start foi removido em sessões anteriores por problemas de compat.

**Fix:** aplicar `prisma db push` dentro do container app via Portainer exec:

```sh
# ver comando completo em §5.1
npx prisma db push --url "$DATABASE_URL" --accept-data-loss
```

`db push` sincroniza schema sem depender de `_prisma_migrations` table.

### 4.4. System user ausente (automation actions quebram) (2026-04-14)

**Sinais:**

- Automation action `create-task` falha com FK violation em `createdBy`.
- `SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000'` retorna 0 rows.

**Causa raiz:** `npx prisma db seed` não foi executado em prod após o push
do schema. `prisma/seed.ts` cria o system user (UUID nil) usado como
`createdBy` em ações automáticas.

**Fix:** INSERT direto via psql no container db (standalone não tem `tsx`
nem `ts-node` — seed completo requer toolchain ausente). Ver §5.2.

---

## 5. Procedimentos DB avançados

### 5.1. Aplicar migrations em prod (Prisma v7 + Portainer exec)

Prisma v7 removeu `prisma migrate deploy` em runtime standalone. Usar
`prisma db push` do container app via Portainer API:

```sh
export PTOKEN=$(grep '^PORTAINER_TOKEN=' .env.production | sed 's/^PORTAINER_TOKEN=//')
export PURL=$(grep '^PORTAINER_URL=' .env.production | cut -d= -f2)

# Obter CID do container app (ver §2 LEI #1 para o one-liner completo)
TASK=$(/usr/bin/curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/tasks?filters=%7B%22service%22%3A%5B%22nexus-crm-krayin_app%22%5D%7D")
APPCID=$(echo "$TASK" | python3 -c "import json,sys; d=json.load(sys.stdin); r=[t for t in d if t.get('Status',{}).get('State')=='running']; print(r[0]['Status']['ContainerStatus']['ContainerID'][:12])")

# Criar exec
EXEC=$(/usr/bin/curl -s -X POST -H "X-API-Key: $PTOKEN" -H "Content-Type: application/json" \
  "$PURL/api/endpoints/1/docker/containers/$APPCID/exec" \
  -d '{"AttachStdout":true,"AttachStderr":true,"Cmd":["sh","-c","npx prisma db push --url \"$DATABASE_URL\" --accept-data-loss"]}')
EID=$(echo "$EXEC" | python3 -c "import json,sys; print(json.load(sys.stdin)['Id'])")

# Start exec
/usr/bin/curl -s -X POST -H "X-API-Key: $PTOKEN" -H "Content-Type: application/json" \
  "$PURL/api/endpoints/1/docker/exec/$EID/start" \
  -d '{"Detach":false,"Tty":false}'
```

**Cuidados:**

- `--accept-data-loss` aceita mudanças destrutivas; revisar schema antes.
- Em produção com dados vivos, **sempre** fazer backup antes (`scripts/ops/backup-postgres.sh`).
- `db push` não atualiza `_prisma_migrations` — monitorar via `\dt` no psql
  se preciso auditar migrations applied.

### 5.2. Criar/atualizar system user via SQL direto

Caso seed não rode em prod (standalone sem tsx), criar manualmente:

```sh
# 1. Gerar hash bcrypt local (não usar a senha em lugar nenhum)
HASH=$(node -e "console.log(require('bcryptjs').hashSync('system-'+Date.now(), 12))")

# 2. Escrever SQL
cat > /tmp/system_user.sql <<EOF
INSERT INTO users (id, name, email, password, platform_role, is_super_admin, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Sistema',
  'system@nexuscrm.internal',
  '$HASH',
  'super_admin',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  is_active = true,
  platform_role = 'super_admin';
EOF

# 3. Executar via Portainer exec no container db (CID via tasks?service=...db)
# Payload: psql -U nexus -d nexus_crm_krayin -c "<conteúdo do SQL>"
```

### 5.3. Restore de backup `age`

Ver `docs/ops/backup.md`. Resumo:

```sh
age -d -i ~/.ssh/age-key /path/to/backup.sql.age | psql -U nexus -d nexus_crm_krayin
```

### 5.4. Parar writes para manutenção

```sh
# Via Portainer API — scale app to 0
curl -X POST -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/services/<svc-id>/update" \
  -d '{"Mode":{"Replicated":{"Replicas":0}}}'

# Obter <svc-id>:
curl -s -H "X-API-Key: $PTOKEN" \
  "$PURL/api/endpoints/1/docker/services" | \
  python3 -c "import json,sys; [print(s['ID'], s['Spec']['Name']) for s in json.load(sys.stdin) if 'nexus-crm-krayin_app' in s['Spec']['Name']]"
```

Worker e DB continuam up. Re-scale para 1 quando terminar:

```sh
curl -X POST ... -d '{"Mode":{"Replicated":{"Replicas":1}}}'
```

---

## 6. Onboarding de novo dev

### 6.1. Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- npm (preferível ao pnpm — CI usa `npm ci`)
- Acesso ao repo `github.com/jvzanini/nexus-crm-krayin`
- (Opcional para prod) acesso Portainer `$PORTAINER_URL` (ver `.env.production`)

### 6.2. Setup local

```sh
git clone git@github.com:jvzanini/nexus-crm-krayin.git
cd nexus-crm-krayin
npm install

# DB local
docker compose up -d  # db + redis (ver docker-compose.yml)

cp .env.example .env.local
# Editar .env.local preenchendo DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET

npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

npm run dev
# → abrir http://localhost:3000
```

### 6.3. Primeira leitura obrigatória (ordem)

1. `docs/HANDOFF.md` — estado atual da prod, ações pendentes
2. `CLAUDE.md` — leis absolutas, convenções, stack
3. `memory/MEMORY.md` (em `.claude/projects/.../memory/`) — 16+ memories
4. Este runbook
5. `docs/superpowers/specs/` — último spec deployed (entender onde paramos)
6. `docs/ops/security.md` — controles, threat model, runbook de incidente

### 6.4. Workflow de contribuição

- **Commits:** português, imperativo, conventional commits
  (`feat|fix|chore|docs|ci|test|refactor`)
- **Branches:** `feat/<topico>`, `fix/<topico>`, ou commit direto em `main`
  para fixes pequenos de prod
- **Pre-push check:**
  ```sh
  npm run lint && npm run test && npm run build
  ```
- **PR para main:** aguardar CI green (`Build and Push`, `E2E Tests`, `Security`)
- **Squash merge** preferível para histórico limpo

### 6.5. Skills Superpowers (OBRIGATÓRIO)

Todo trabalho não-trivial segue o fluxo:

1. `superpowers:brainstorming` — entender intent
2. `superpowers:writing-plans` — planejar tasks
3. `superpowers:subagent-driven-development` OU
   `superpowers:executing-plans` — implementar
4. `superpowers:verification-before-completion` — validar antes de claim done

Para UI/frontend: sempre `ui-ux-pro-max:ui-ux-pro-max`.

---

## 7. Contatos

| Categoria | Contato |
|-----------|---------|
| Plataforma / app | `@tech-on-call` (Slack) |
| DB (PostgreSQL) | `@dba-on-call` (Slack) |
| Provider email (Resend) | https://resend.com/support |
| Provider email (Gmail/Outlook OAuth) | Suporte Google/Microsoft |
| DNS | `@it-on-call` (Slack) |
| Portainer / infra | `@tech-on-call` (Slack) |

---

## 8. Infraestrutura

- **Portainer:** `$PORTAINER_URL` (ver `.env.production`)
- **App produção:** `https://crm2.nexusai360.com`
- **GHCR:** `ghcr.io/jvzanini/nexus-crm-krayin`
- **Containers:** `nexus-crm-app`, `nexus-crm-worker`, `nexus-crm-db`, `nexus-crm-redis`
- **Rede Docker:** `rede_nexusAI` (externa, compartilhada)
- **Logs agregados:** TODO Fase 12 — configurar Loki/ELK
- **Métricas:** TODO Fase 12.2 — configurar Grafana

---

## 9. Secrets management

- **Local:** `.env.production` (NÃO comitar — gitignored).
- **Produção:** Portainer env vars (editar via UI do stack).
- **Rotação de secret:**
  1. Atualizar no Portainer env vars.
  2. Redeploy do stack para aplicar.
  3. Documentar rotação em PR fechado + Slack `#security`.
- **Nunca** colocar secrets em variáveis `NEXT_PUBLIC_*`.

---

## 10. Observabilidade

| Sinal | Endpoint / Ferramenta |
|-------|-----------------------|
| Liveness | `GET /api/health` → 200 |
| Readiness (DB + Redis) | `GET /api/ready` → 200 |
| Logs estruturados | JSON NDJSON via pino (stdout) |
| Error tracking | Sentry — `SENTRY_DSN` env |
| Request tracing | Header `x-request-id` propagado |
| Notificações in-app | Feed `/notifications` + SSE |

---

## 11. Go-live checklist

- [ ] `/api/health` e `/api/ready` retornam 200 em produção
- [ ] Migrations aplicadas e verificadas
- [ ] Backup drill executado com sucesso (Fase 12.3)
- [ ] Security audit checklist revisado (`docs/ops/security-audit-checklist.md`)
- [ ] Lighthouse budgets verdes (Fase 12.1)
- [ ] Secrets configurados no Portainer (sem `.env.production` exposto)
- [ ] DNS apontando para `crm2.nexusai360.com`
- [ ] HTTPS funcionando (certificado válido)
- [ ] Sentry DSN configurado e capturando erros de teste
- [ ] Notificar `@tech-on-call` do go-live
