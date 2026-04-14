#!/usr/bin/env sh
# Nexus CRM — drill de restore do backup mais recente em DB ephemeral.
# Objetivo: validar periodicamente que backups são recuperáveis (defesa contra
# backups corrompidos/encriptados com chave perdida). Roda em staging.
#
# Secrets esperadas:
#   BACKUP_S3_BUCKET, BACKUP_S3_PREFIX (default crm/daily)
#   BACKUP_AGE_IDENTITY   path ou conteúdo de chave privada age (AGE-SECRET-KEY-...)
#   AWS_* creds
#
# Requer: age, aws-cli, docker. DB ephemeral sobe em port 55432 local.

set -eu

: "${BACKUP_S3_BUCKET:?}"
: "${BACKUP_AGE_IDENTITY:?}"

PREFIX="${BACKUP_S3_PREFIX:-crm/daily}"
WORKDIR="$(mktemp -d)"
EPHEMERAL_DB_NAME="drill_$(date -u +%s)"
PGPORT=55432

cleanup() {
  echo "[drill] cleanup"
  docker rm -f "$EPHEMERAL_DB_NAME" 2>/dev/null || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "[drill] descobrindo backup mais recente em s3://$BACKUP_S3_BUCKET/$PREFIX/"
LATEST_KEY="$(aws s3api list-objects-v2 \
  --bucket "$BACKUP_S3_BUCKET" \
  --prefix "$PREFIX/" \
  --query 'sort_by(Contents, &LastModified)[-1].Key' \
  --output text)"

test -n "$LATEST_KEY" -a "$LATEST_KEY" != "None" || { echo "nenhum backup encontrado"; exit 1; }

echo "[drill] baixando $LATEST_KEY"
aws s3 cp "s3://$BACKUP_S3_BUCKET/$LATEST_KEY" "$WORKDIR/backup.sql.gz.age"

echo "[drill] decrypt + decompress"
if [ -f "$BACKUP_AGE_IDENTITY" ]; then
  age -d -i "$BACKUP_AGE_IDENTITY" "$WORKDIR/backup.sql.gz.age" | gunzip > "$WORKDIR/backup.sql"
else
  printf '%s' "$BACKUP_AGE_IDENTITY" | age -d -i - "$WORKDIR/backup.sql.gz.age" | gunzip > "$WORKDIR/backup.sql"
fi

echo "[drill] subindo Postgres ephemeral em :$PGPORT"
docker run -d --name "$EPHEMERAL_DB_NAME" \
  -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill -e POSTGRES_USER=drill \
  -p "${PGPORT}:5432" postgres:16-alpine >/dev/null

# aguarda DB estar pronto
for i in $(seq 1 30); do
  if docker exec "$EPHEMERAL_DB_NAME" pg_isready -U drill >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[drill] pg_restore"
PGPASSWORD=drill pg_restore --no-owner --no-privileges \
  -h 127.0.0.1 -p "$PGPORT" -U drill -d drill "$WORKDIR/backup.sql"

echo "[drill] smoke checks"
SMOKE_SQL="SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM companies) AS companies;"
OUT="$(PGPASSWORD=drill psql -h 127.0.0.1 -p "$PGPORT" -U drill -d drill -At -c "$SMOKE_SQL")"
echo "[drill] rows: $OUT"

case "$OUT" in
  0\|0*) echo "[drill] FAIL: users=0 e companies=0"; exit 2 ;;
  *) echo "[drill] OK" ;;
esac
