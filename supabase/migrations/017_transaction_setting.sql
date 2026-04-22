-- 특수학급(resource) vs 통합학급(integrated) QR 충전 출처 구분 — 기존 행은 NULL 유지

ALTER TABLE pbs_transactions
  ADD COLUMN IF NOT EXISTS setting text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pbs_transactions_setting_check'
  ) THEN
    ALTER TABLE pbs_transactions
      ADD CONSTRAINT pbs_transactions_setting_check
      CHECK (setting IS NULL OR setting IN ('resource', 'integrated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pbs_transactions_setting_created
  ON pbs_transactions (setting, created_at DESC);

COMMENT ON COLUMN pbs_transactions.setting IS 'resource=특수학급, integrated=통합학급, null=레거시/미분류';
