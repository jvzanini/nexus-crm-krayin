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

## 2. On-call triage

### 2.1. App caiu (`/api/health` falha)

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

### 2.2. Worker não processa (reminders/emails atrasam)

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

### 2.3. Migration falhou em deploy

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

### 2.4. `/api/ready` retorna 503

- **DB unreachable:** verificar `DATABASE_URL` env no Portainer + container `nexus-crm-db` up.
- **Redis unreachable:** verificar `REDIS_URL` env + container `nexus-crm-redis` up.
- Se for falha transiente, o healthcheck do Portainer deve reiniciar automaticamente (aguardar 1–2 min).
- Verificar rede Docker:
  ```sh
  docker network inspect rede_nexusAI
  ```

### 2.5. Automation loop (quota exceeded / notification spam)

1. Acessar `/automation/workflows` no CRM.
2. Identificar workflow com mais execuções recentes (ordenar por `lastRunAt`).
3. Pausar manualmente via toggle para `paused`.
4. Investigar conditions/actions — há ciclo entre workflows? (ex: workflow A triggera evento que ativa workflow B que triggera A).
5. Corrigir a lógica antes de reativar.

---

## 3. Contatos

| Categoria | Contato |
|-----------|---------|
| Plataforma / app | `@tech-on-call` (Slack) |
| DB (PostgreSQL) | `@dba-on-call` (Slack) |
| Provider email (Resend) | https://resend.com/support |
| Provider email (Gmail/Outlook OAuth) | Suporte Google/Microsoft |
| DNS | `@it-on-call` (Slack) |
| Portainer / infra | `@tech-on-call` (Slack) |

---

## 4. Infraestrutura

- **Portainer:** `https://portainer.nexusai360.com`
- **App produção:** `https://crm2.nexusai360.com`
- **GHCR:** `ghcr.io/jvzanini/nexus-crm-krayin`
- **Containers:** `nexus-crm-app`, `nexus-crm-worker`, `nexus-crm-db`, `nexus-crm-redis`
- **Rede Docker:** `rede_nexusAI` (externa, compartilhada)
- **Logs agregados:** TODO Fase 12 — configurar Loki/ELK
- **Métricas:** TODO Fase 12.2 — configurar Grafana

---

## 5. Secrets management

- **Local:** `.env.production` (NÃO comitar — gitignored).
- **Produção:** Portainer env vars (editar via UI do stack).
- **Rotação de secret:**
  1. Atualizar no Portainer env vars.
  2. Redeploy do stack para aplicar.
  3. Documentar rotação em PR fechado + Slack `#security`.
- **Nunca** colocar secrets em variáveis `NEXT_PUBLIC_*`.

---

## 6. Observabilidade

| Sinal | Endpoint / Ferramenta |
|-------|-----------------------|
| Liveness | `GET /api/health` → 200 |
| Readiness (DB + Redis) | `GET /api/ready` → 200 |
| Logs estruturados | JSON NDJSON via pino (stdout) |
| Error tracking | Sentry — `SENTRY_DSN` env |
| Request tracing | Header `x-request-id` propagado |
| Notificações in-app | Feed `/notifications` + SSE |

---

## 7. Go-live checklist

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
