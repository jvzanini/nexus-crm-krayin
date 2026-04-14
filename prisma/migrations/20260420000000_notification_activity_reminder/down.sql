-- Rollback: remover valor activity_reminder do enum NotificationType.
-- ATENÇÃO: falha se houver rows em notifications com type='activity_reminder'.
-- Execute manualmente `UPDATE notifications SET type='info' WHERE type='activity_reminder';`
-- antes de aplicar este rollback.
--
-- Postgres não suporta DROP VALUE em enum; estratégia: renomear tipo, criar novo sem
-- o valor, remapear colunas, drop do antigo.
BEGIN;

CREATE TYPE "NotificationType_old" AS ENUM ('error', 'warning', 'info');

UPDATE "notifications" SET "type" = 'info' WHERE "type"::text = 'activity_reminder';

ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType_old"
  USING ("type"::text::"NotificationType_old");

DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_old" RENAME TO "NotificationType";

COMMIT;
