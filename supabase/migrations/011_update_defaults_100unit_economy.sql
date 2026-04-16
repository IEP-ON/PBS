-- R10: 10원 최소 단위 · 100원 기반 경제로 전환 (신규 + 기존 운영 학급 전체 강제 적용)
-- 1학년~6학년 통합 사용 환경에 맞춰 화폐 단위를 낮추고,
-- 누적·저축 동기는 유지하면서 저학년 수 감각 범위 안에서 굴러가도록 조정.
-- idempotent: 모든 UPDATE/ALTER 구문은 조건부라 재실행해도 안전.

-- ── 1. DB 컬럼 레벨 DEFAULT 변경 (신규 학급) ─────────────────────────────

ALTER TABLE pbs_system_settings
  ALTER COLUMN currency_unit        SET DEFAULT 100,
  ALTER COLUMN starting_balance     SET DEFAULT 500,
  ALTER COLUMN min_balance_protection SET DEFAULT 100,
  ALTER COLUMN interest_min_balance SET DEFAULT 500;

ALTER TABLE pbs_students
  ALTER COLUMN min_balance SET DEFAULT 100;

ALTER TABLE pbs_accounts
  ALTER COLUMN balance SET DEFAULT 500;

ALTER TABLE pbs_goals
  ALTER COLUMN token_per_occurrence SET DEFAULT 20;

ALTER TABLE pbs_salary_rules
  ALTER COLUMN amount SET DEFAULT 100;

-- ── 2. 기존 운영 학급 system_settings 전체 강제 갱신 ──────────────────────

UPDATE pbs_system_settings
SET
  currency_unit         = 100,
  starting_balance      = 500,
  min_balance_protection = 100,
  interest_min_balance  = 500;

-- ── 3. 기존 학생 최소잔액 보호값 강제 갱신 ────────────────────────────────

UPDATE pbs_students
SET min_balance = 100;

-- ── 4. 기존 출석 기본급 → 100원으로 강제 갱신 ────────────────────────────

UPDATE pbs_salary_rules
SET amount = 100
WHERE rule_type = 'attendance';

-- ── 5. 기존 주간 개근 보너스 → 200원으로 강제 갱신 ──────────────────────

UPDATE pbs_salary_rules
SET amount = 200
WHERE rule_type = 'weekly_perfect';

-- ── 6. 가게 가격 하한 정리: 50원 미만 활성 상품 → 50원으로 상향 ──────────

UPDATE pbs_shop_items
SET price = 50
WHERE coalesce(is_active, true) = true
  AND price > 0
  AND price < 50;
