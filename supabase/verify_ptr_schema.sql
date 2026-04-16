-- PTR 관련 마이그레이션 적용 여부 수동 검증 (SQL Editor에서 실행)
-- 기대: 아래 쿼리가 모두 1행 이상이거나 COUNT>0 이어야 합니다.
-- 테이블이 public 또는 pbs 스키마에 있을 수 있어 양쪽을 조회합니다.

-- 012: pbs_records — antecedent_tag, prompt_level
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pbs_records'
  AND column_name IN ('antecedent_tag', 'prompt_level')
ORDER BY table_schema, column_name;

-- 012: pbs_goals — is_ncr, ncr_interval_minutes
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_name = 'pbs_goals'
  AND column_name IN ('is_ncr', 'ncr_interval_minutes')
ORDER BY table_schema, column_name;

-- 013: 선호도 평가 테이블 존재
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'pbs_preference_assessments';
