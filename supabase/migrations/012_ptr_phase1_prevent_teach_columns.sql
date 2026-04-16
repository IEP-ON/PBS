-- Phase 1 (플랜 11_PTR_자동화_통합_플랜.md): Prevent·Teach 기록 + NCR 목표 메타
-- 적용 순서: 008 이후 아무 때나. 013(선호도)과 무관.
-- idempotent: 컬럼이 이미 있으면 건너뜀 (PostgreSQL 11+ IF NOT EXISTS)
-- 적용 후 검증: 저장소 루트의 supabase/verify_ptr_schema.sql 참고

ALTER TABLE pbs_records ADD COLUMN IF NOT EXISTS antecedent_tag text;
ALTER TABLE pbs_records ADD COLUMN IF NOT EXISTS prompt_level text;

COMMENT ON COLUMN pbs_records.antecedent_tag IS '선행사건 퀵태그 (AI 프로필 antecedent_patterns에서 선택)';
COMMENT ON COLUMN pbs_records.prompt_level IS '촉구 수준: full|partial|gesture|independent';

ALTER TABLE pbs_goals ADD COLUMN IF NOT EXISTS is_ncr boolean NOT NULL DEFAULT false;
ALTER TABLE pbs_goals ADD COLUMN IF NOT EXISTS ncr_interval_minutes int;

COMMENT ON COLUMN pbs_goals.is_ncr IS 'NCR(비수반 강화) 일정이 붙은 목표 여부';
COMMENT ON COLUMN pbs_goals.ncr_interval_minutes IS 'NCR 제공 권장 간격(분)';
