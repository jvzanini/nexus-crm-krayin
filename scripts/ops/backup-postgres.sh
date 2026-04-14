#!/usr/bin/env sh
# Nexus CRM — backup diário do Postgres.
# Pipeline: pg_dump (format custom) → gzip -9 → age encrypt → aws s3 cp.
# Rodado via cron do Portainer (03:00 UTC). Retention S3 lifecycle: 30 dias.
#
# Secrets esperadas no container:
#   DATABASE_URL            postgresql://…
#   BACKUP_S3_BUCKET        nome do bucket (ex: nexus-crm-backups-prod)
#   BACKUP_S3_PREFIX        prefixo (default: crm/daily)
#   BACKUP_AGE_RECIPIENT    chave pública age (formato age1...)
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
#
# Dependências no container ops: pg_dump (postgres:16-alpine), gzip, age, aws-cli.

set -eu

: "${DATABASE_URL:?DATABASE_URL obrigatório}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET obrigatório}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT obrigatório}"

PREFIX="${BACKUP_S3_PREFIX:-crm/daily}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
FILE="$WORKDIR/crm-$TS.sql.gz.age"

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "[backup] $TS start bucket=$BACKUP_S3_BUCKET prefix=$PREFIX"

pg_dump --no-owner --no-privileges --format=custom --compress=0 "$DATABASE_URL" \
  | gzip -9 \
  | age -r "$BACKUP_AGE_RECIPIENT" \
  > "$FILE"

SIZE="$(wc -c < "$FILE" | tr -d ' ')"
echo "[backup] encrypted artifact size=${SIZE}B"

aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/$PREFIX/crm-$TS.sql.gz.age" \
  --storage-class STANDARD_IA

echo "[backup] $TS ok → s3://$BACKUP_S3_BUCKET/$PREFIX/crm-$TS.sql.gz.age"
