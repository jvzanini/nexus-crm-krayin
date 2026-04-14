# Backup e Restore — Nexus CRM

**Pipeline:** `pg_dump --format=custom` → `gzip -9` → `age` (chave pública) → `aws s3 cp`.

**Retenção:** 30 dias via lifecycle rule no bucket S3 (configurada fora do repo).

**Frequência:** diária, 03:00 UTC via cron do Portainer.

## Setup inicial

### 1. Chave age

```sh
age-keygen -o nexus-crm-backup.key
# Guardar nexus-crm-backup.key em cofre (1Password/Vault) — NUNCA no repo.
# Público: linha "public key: age1..."
```

### 2. Bucket S3

```sh
aws s3api create-bucket --bucket nexus-crm-backups-prod --region us-east-1
aws s3api put-bucket-versioning --bucket nexus-crm-backups-prod \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket nexus-crm-backups-prod \
  --lifecycle-configuration file://s3-lifecycle.json
```

`s3-lifecycle.json`:
```json
{
  "Rules": [{
    "ID": "expire-30d",
    "Status": "Enabled",
    "Prefix": "crm/daily/",
    "Expiration": { "Days": 30 }
  }]
}
```

### 3. Container ops (Portainer stack)

Adicionar serviço `crm-backup` ao stack:

```yaml
services:
  crm-backup:
    image: alpine:3.20
    restart: "no"
    command: >
      sh -c "apk add --no-cache postgresql16-client aws-cli age &&
             /opt/scripts/backup-postgres.sh"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      BACKUP_S3_BUCKET: ${BACKUP_S3_BUCKET}
      BACKUP_AGE_RECIPIENT: ${BACKUP_AGE_RECIPIENT}
      AWS_ACCESS_KEY_ID: ${BACKUP_AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${BACKUP_AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${BACKUP_AWS_DEFAULT_REGION}
    volumes:
      - ./scripts/ops:/opt/scripts:ro
    networks:
      - rede_nexusAI
```

Schedule via Portainer: "Edge/Scheduler" → cron `0 3 * * *`.

### 4. Drill mensal (staging)

`./scripts/ops/restore-drill.sh` roda em runner local contra bucket de staging.
Anexar log da execução ao PR mensal `ops/<mês>-backup-drill`.

## Restore emergencial

1. Identifique o snapshot:
   ```sh
   aws s3 ls s3://nexus-crm-backups-prod/crm/daily/ | tail
   ```
2. Download + decrypt:
   ```sh
   aws s3 cp s3://nexus-crm-backups-prod/crm/daily/crm-<TS>.sql.gz.age ./
   age -d -i nexus-crm-backup.key crm-<TS>.sql.gz.age | gunzip > crm-<TS>.sql
   ```
3. Restore (em DB limpo):
   ```sh
   pg_restore --no-owner --no-privileges --dbname="$DATABASE_URL" crm-<TS>.sql
   ```
4. Validate: `psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"`.

## Aceite Fase 1c.2

- `backup-postgres.sh` executa contra staging e arquivo .age aparece no bucket.
- `restore-drill.sh` roda end-to-end e registra smoke OK (users > 0).
- Runbook de restore testado 1x em staging antes do tag `phase-1c-deployed`.
