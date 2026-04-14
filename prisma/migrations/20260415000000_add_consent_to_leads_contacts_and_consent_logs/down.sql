-- Rollback da migration de consent LGPD (Fase 1b).
BEGIN;

DROP TABLE IF EXISTS "consent_logs";

ALTER TABLE "contacts"
  DROP COLUMN IF EXISTS "consent_marketing",
  DROP COLUMN IF EXISTS "consent_marketing_at",
  DROP COLUMN IF EXISTS "consent_marketing_ip_mask",
  DROP COLUMN IF EXISTS "consent_tracking",
  DROP COLUMN IF EXISTS "consent_tracking_at",
  DROP COLUMN IF EXISTS "consent_tracking_ip_mask";

ALTER TABLE "leads"
  DROP COLUMN IF EXISTS "consent_marketing",
  DROP COLUMN IF EXISTS "consent_marketing_at",
  DROP COLUMN IF EXISTS "consent_marketing_ip_mask",
  DROP COLUMN IF EXISTS "consent_tracking",
  DROP COLUMN IF EXISTS "consent_tracking_at",
  DROP COLUMN IF EXISTS "consent_tracking_ip_mask";

COMMIT;
