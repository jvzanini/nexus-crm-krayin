# Plan — Fase 12.5 Runbook Expansion

**Spec:** `docs/superpowers/specs/2026-04-14-fase-12-5-runbook-expansion-design.md`
**Branch:** `main`
**Tag final:** `phase-12-5-deployed`

## Visão geral

Doc-only. Edit único em `docs/ops/runbook.md`. 4 seções novas inseridas na
ordem planejada. Plan executado em uma sessão (não precisa decompor em tasks
paralelas).

## Tasks

### T1 — Adicionar seção "LEI ABSOLUTA #1 — Debug via Portainer logs"

Inserir **após §1 Deploy, antes da §2 On-call triage atual** (renumerando).

Conteúdo:

- Enunciado: "Ao debugar erro em prod/deploy, puxar logs do container PRIMEIRO."
- Por quê (incidente 2026-04-14 perdeu ~4h especulando commits).
- Comando canônico (copy do CLAUDE.md).
- Variações por serviço: `_app`, `_worker`, `_db`, `_redis`.
- Exemplo real: output abreviado do log que identificou dual React.
- Links: `CLAUDE.md` §LEIS ABSOLUTAS, memory `law_debug_via_container_logs`.

### T2 — Adicionar seção "Playbooks de incidentes resolvidos"

Inserir após §3 On-call triage (renumerado).

Sub-seções:

#### 4.1 Login 500 (2026-04-14)
- Sinais: `/login` 500; `/api/health` 200; log `Cannot read properties of null (reading 'useState')`
- Causa raiz: dual React — vendor UI packages fora de transpilePackages
- Fix: `next.config.ts` — mover `@nexusai360/profile-ui`, `settings-ui`,
  `users-ui`, `companies-ui`, `design-system`, `api-keys`, `core`,
  `multi-tenant`, `audit-log` para `transpilePackages` (não `serverExternal`)
- Commit: `67358a1`

#### 4.2 Build falha "Failed to collect page data for /profile" (2026-04-14)
- Sinais: CI Docker build log `Error: Missing API key. Pass it to the constructor 'new Resend("re_123")'`
- Causa raiz: `new Resend()` top-level em `src/lib/email.ts` valida API key
  em Resend v4, quebra quando env var ausente no build container
- Fix: lazy `getResend()` que instancia só na primeira chamada
- Commit: `3a6482e`

#### 4.3 Schema DB desatualizado / "column consent_marketing does not exist" (2026-04-14)
- Sinais: log `PrismaClientKnownRequestError ColumnNotFound` após rollout
- Causa raiz: migrations nunca aplicadas (Prisma v7 não tem migrate deploy runtime)
- Fix: `npx prisma db push --url $DATABASE_URL --accept-data-loss` dentro do
  container app via Portainer exec (ver §5.1)

#### 4.4 System user ausente (automation actions quebram) (2026-04-14)
- Sinais: automation `create-task` falha com FK violation em `createdBy`
- Causa raiz: seed não executado em prod; UUID nil não existe na tabela users
- Fix: INSERT direto via psql no container db (ver §5.2)

### T3 — Adicionar seção "Procedimentos DB avançados"

Inserir após §4 Playbooks.

Sub-seções:

#### 5.1 Aplicar migrations em prod (Prisma v7 + Portainer)

Script Python-ish via Portainer API exec no container app:

```python
import json, urllib.request
PTOKEN = "<from .env.production>"
PURL = "<from .env.production>"
APPCID = "<curl GET tasks + filter running>"

payload = {
  "AttachStdout": True, "AttachStderr": True,
  "Cmd": ["sh","-c","npx prisma db push --url \"$DATABASE_URL\" --accept-data-loss"]
}
req = urllib.request.Request(
  f"{PURL}/api/endpoints/1/docker/containers/{APPCID}/exec",
  data=json.dumps(payload).encode(),
  headers={"X-API-Key": PTOKEN, "Content-Type": "application/json"},
  method="POST"
)
eid = json.loads(urllib.request.urlopen(req).read())["Id"]
# Start com {"Detach": False}
```

Alternativa simplificada (bash + curl):

```sh
# Obter CID do container app
CID=$(...)  # ver LEI #1
# Exec prisma db push
EXEC=$(curl -s -X POST -H "X-API-Key: $PTOKEN" -H "Content-Type: application/json" \
  "$PURL/api/endpoints/1/docker/containers/$CID/exec" \
  -d '{"AttachStdout":true,"AttachStderr":true,"Cmd":["sh","-c","npx prisma db push --url \"$DATABASE_URL\" --accept-data-loss"]}')
EID=$(echo "$EXEC" | jq -r .Id)
curl -s -X POST -H "X-API-Key: $PTOKEN" -H "Content-Type: application/json" \
  "$PURL/api/endpoints/1/docker/exec/$EID/start" \
  -d '{"Detach":false,"Tty":false}'
```

#### 5.2 Criar/atualizar system user via SQL direto

```sh
# dentro do container db via psql
INSERT INTO users (id, name, email, password, platform_role, is_super_admin, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Sistema',
  'system@nexuscrm.internal',
  '<bcrypt hash gerado local>',
  'super_admin',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  is_active = true,
  platform_role = 'super_admin';
```

Gerar hash local: `node -e "console.log(require('bcryptjs').hashSync('random-'+Date.now(), 12))"`.

#### 5.3 Restore de backup `age`

Referir `docs/ops/backup.md`. Resumo:

```sh
age -d -i ~/.ssh/age-key backup.sql.age | psql -U nexus -d nexus_crm_krayin
```

#### 5.4 Stop writes para manutenção

```sh
# Scale app to 0 (keep db + redis up)
curl -X POST -H "X-API-Key: $PTOKEN" "$PURL/api/endpoints/1/docker/services/<svc-id>/update" \
  -d '{"Mode":{"Replicated":{"Replicas":0}}}'
```

### T4 — Adicionar seção "Onboarding"

Inserir antes da §7 Contatos.

Estrutura:

1. **Pré-requisitos:** Node 20, Docker, pnpm/npm, acesso ao repo, conta Portainer
   (opcional para prod access).
2. **Setup local:**
   ```sh
   git clone git@github.com:jvzanini/nexus-crm-krayin.git
   cd nexus-crm-krayin
   npm install
   # DB local via docker compose
   docker compose up -d  # db + redis (ver docker-compose.yml)
   cp .env.example .env.local
   npx prisma generate
   npx prisma db push
   npx tsx prisma/seed.ts
   npm run dev
   ```
3. **Primeira leitura obrigatória:**
   - `docs/HANDOFF.md`
   - `CLAUDE.md`
   - `memory/MEMORY.md`
   - este runbook
   - `docs/superpowers/specs/` último spec deployed
4. **Workflow de contribuição:**
   - Criar branch `feat/<topico>` ou `fix/<topico>`
   - Commits em português, conventional commits
   - `npm run lint && npm run test && npm run build` antes de push
   - PR para `main`, aguardar CI green
   - Squash merge

## T5 — Push e tag

```sh
git add docs/ops/runbook.md docs/superpowers/specs/2026-04-14-fase-12-5-runbook-expansion-design.md docs/superpowers/plans/2026-04-14-fase-12-5-runbook-expansion.md
git commit -m "docs(ops): runbook expansion — Fase 12.5"
git push origin main
# CI roda mas nada muda em prod (doc-only)
git tag phase-12-5-deployed
git push origin phase-12-5-deployed
```

## Validação

- Ler o runbook inteiro top-to-bottom.
- Conferir que cada comando é copy-paste executável (variáveis externas
  referenciadas via `$VAR`).
- Links cruzados funcionam (markdown relative paths válidos).

## Rollback

N/A — doc-only, sem impacto runtime.
