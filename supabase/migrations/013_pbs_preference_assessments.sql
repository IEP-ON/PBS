-- Phase 3 (플랜 11_PTR): 가게 강화물 선호도 평가(단일자극법) 저장
-- 적용 순서: pbs_students, pbs_class_codes, pbs_student_ai_profiles가 있는 DB 기준.
-- 012와 독립이나, 동일 배포에서 012 먼저 적용하는 것을 권장.
-- 적용 후 검증: supabase/verify_ptr_schema.sql
CREATE TABLE IF NOT EXISTS pbs_preference_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES pbs_students(id) ON DELETE CASCADE,
  class_code_id uuid NOT NULL REFERENCES pbs_class_codes(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ranked_preferences text[] NOT NULL DEFAULT '{}',
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pbs_pref_assess_student_date
  ON pbs_preference_assessments (student_id, assessment_date DESC);

COMMENT ON TABLE pbs_preference_assessments IS '가게 아이템 단일자극 선호도 평가(접근률 기반 서열)';
