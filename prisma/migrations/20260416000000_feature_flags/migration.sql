-- Nexus CRM — Fase 1c — Feature Flags
-- feature_flags (single source) + feature_flag_overrides (por company/user)

BEGIN;

CREATE TABLE "feature_flags" (
  "key"         TEXT         NOT NULL,
  "description" TEXT,
  "enabled"     BOOLEAN      NOT NULL DEFAULT FALSE,
  "rollout_pct" INTEGER      NOT NULL DEFAULT 0,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"  UUID,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "feature_flag_overrides" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT         NOT NULL,
  "scope"      TEXT         NOT NULL,
  "scope_id"   UUID         NOT NULL,
  "enabled"    BOOLEAN      NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flag_overrides_key_scope_scope_id_key"
  ON "feature_flag_overrides" ("key", "scope", "scope_id");

CREATE INDEX "idx_flag_override_lookup"
  ON "feature_flag_overrides" ("key", "scope", "scope_id");

ALTER TABLE "feature_flag_overrides"
  ADD CONSTRAINT "feature_flag_overrides_key_fkey"
  FOREIGN KEY ("key") REFERENCES "feature_flags"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- pg_notify hook: qualquer UPDATE em feature_flags publica canal 'flags_changed' com a key
CREATE OR REPLACE FUNCTION nexus_crm_notify_flag_change() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('flags_changed', NEW.key);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_flags_notify
AFTER INSERT OR UPDATE ON "feature_flags"
FOR EACH ROW EXECUTE FUNCTION nexus_crm_notify_flag_change();

CREATE OR REPLACE FUNCTION nexus_crm_notify_override_change() RETURNS TRIGGER AS $$
DECLARE
  k TEXT;
BEGIN
  k := COALESCE(NEW.key, OLD.key);
  PERFORM pg_notify('flags_changed', k);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_flag_overrides_notify
AFTER INSERT OR UPDATE OR DELETE ON "feature_flag_overrides"
FOR EACH ROW EXECUTE FUNCTION nexus_crm_notify_override_change();

COMMIT;
