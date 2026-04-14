-- Fase 7b follow-up: acrescenta valor activity_reminder ao enum NotificationType.
-- Antes desta migration, o worker de reminders caía no fallback NotificationType.info.
BEGIN;
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'activity_reminder';
COMMIT;
