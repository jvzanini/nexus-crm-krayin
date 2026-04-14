-- Rollback feature flags (Fase 1c).
BEGIN;
DROP TRIGGER IF EXISTS feature_flag_overrides_notify ON "feature_flag_overrides";
DROP TRIGGER IF EXISTS feature_flags_notify ON "feature_flags";
DROP FUNCTION IF EXISTS nexus_crm_notify_override_change();
DROP FUNCTION IF EXISTS nexus_crm_notify_flag_change();
DROP TABLE IF EXISTS "feature_flag_overrides";
DROP TABLE IF EXISTS "feature_flags";
COMMIT;
