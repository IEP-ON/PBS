-- 학생 개별 뱅킹 기기 바인딩 (토큰 해시 저장)
CREATE TABLE IF NOT EXISTS pbs_bank_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES pbs_students(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pbs_bank_devices_student_active
  ON pbs_bank_devices (student_id)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pbs_bank_devices_token_hash
  ON pbs_bank_devices (token_hash);
