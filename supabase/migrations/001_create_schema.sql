-- PBS 토큰 이코노미 시스템 — 전체 스키마 생성
-- 실행 순서: 이 파일 전체를 Supabase SQL Editor에서 실행

-- 1. Schema 생성
CREATE SCHEMA IF NOT EXISTS pbs;
GRANT USAGE ON SCHEMA pbs TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA pbs
  GRANT ALL ON TABLES TO anon, authenticated;

-- 2. class_codes (학급 식별코드)
CREATE TABLE pbs.class_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  school_name text,
  class_name text,
  teacher_name text,
  teacher_pin_hash text NOT NULL,
  academic_year int DEFAULT 2026,
  semester int DEFAULT 1,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- 3. students (학생)
CREATE TABLE pbs.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid REFERENCES pbs.class_codes(id),
  name text NOT NULL,
  grade int,
  pin_hash text NOT NULL,
  qr_code text UNIQUE NOT NULL,
  disability_type text[],
  pbs_stage int DEFAULT 1,
  behavior_function text,
  response_cost_enabled bool DEFAULT false,
  parental_consent_rc bool DEFAULT false,
  min_balance int DEFAULT 500,
  created_at timestamptz DEFAULT now(),
  is_active bool DEFAULT true
);

-- 4. accounts (계좌)
CREATE TABLE pbs.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) UNIQUE NOT NULL,
  balance int DEFAULT 1000,
  total_earned int DEFAULT 0,
  total_spent int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. transactions (거래내역)
CREATE TABLE pbs.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  type text NOT NULL,
  amount int NOT NULL,
  balance_after int NOT NULL,
  description text,
  related_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_transactions_student ON pbs.transactions(student_id, created_at DESC);

-- 6. pbs_goals (PBS 목표 행동)
CREATE TABLE pbs.pbs_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  class_code_id uuid REFERENCES pbs.class_codes(id) NOT NULL,
  behavior_name text NOT NULL,
  behavior_definition text,
  behavior_function text,
  strategy_type text,
  token_per_occurrence int NOT NULL DEFAULT 100,
  daily_target int,
  weekly_target int,
  is_dro bool DEFAULT false,
  dro_interval_minutes int,
  is_drl bool DEFAULT false,
  drl_max_per_week int,
  allow_self_check bool DEFAULT false,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 7. pbs_records (PBS 행동 체크 기록)
CREATE TABLE pbs.pbs_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  goal_id uuid REFERENCES pbs.pbs_goals(id) NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  occurrence_count int DEFAULT 1,
  prompted bool DEFAULT false,
  context_note text,
  token_granted int DEFAULT 0,
  is_settled bool DEFAULT false,
  is_self_check bool DEFAULT false,
  self_check_approved bool,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_pbs_records_student_date ON pbs.pbs_records(student_id, record_date);

-- 8. salary_rules (급여 규칙)
CREATE TABLE pbs.salary_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid REFERENCES pbs.class_codes(id) NOT NULL,
  rule_name text NOT NULL,
  rule_type text NOT NULL,
  amount int NOT NULL DEFAULT 100,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 9. shop_items (가게 아이템)
CREATE TABLE pbs.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid REFERENCES pbs.class_codes(id) NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'activity',
  price int NOT NULL,
  stock int,
  is_giftable bool DEFAULT true,
  emoji text,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 10. stock_prices (날씨 연동 주식 시세)
CREATE TABLE pbs.stock_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_name text NOT NULL,
  stock_type text DEFAULT 'weather',
  price_date date NOT NULL,
  price int NOT NULL,
  temperature_celsius numeric,
  precipitation_mm numeric,
  weather_condition text,
  calculation_note text,
  UNIQUE (stock_name, price_date)
);

-- 11. custom_stocks (교사 커스텀 종목)
CREATE TABLE pbs.custom_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid REFERENCES pbs.class_codes(id),
  name text NOT NULL,
  emoji text DEFAULT '🎲',
  description text,
  current_price int NOT NULL DEFAULT 100,
  created_by text,
  named_by text,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 12. custom_stock_prices (커스텀 종목 주가 이력)
CREATE TABLE pbs.custom_stock_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES pbs.custom_stocks(id),
  price_date date NOT NULL,
  price int NOT NULL,
  previous_price int,
  adjustment_type text,
  teacher_note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (stock_id, price_date)
);

-- 13. stock_holdings (주식 보유 현황)
CREATE TABLE pbs.stock_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  stock_name text NOT NULL,
  stock_type text NOT NULL DEFAULT 'weather',
  quantity int NOT NULL DEFAULT 0,
  avg_buy_price int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, stock_name, stock_type)
);

-- 14. behavior_contracts (행동계약서)
CREATE TABLE pbs.behavior_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  class_code_id uuid REFERENCES pbs.class_codes(id) NOT NULL,
  contract_title text NOT NULL,
  target_behavior text NOT NULL,
  behavior_definition text,
  measurement_method text,
  achievement_criteria text,
  reward_amount int DEFAULT 0,
  contract_start date,
  contract_end date,
  is_active bool DEFAULT false,
  teacher_signed bool DEFAULT false,
  student_signed bool DEFAULT false,
  parent_signed bool DEFAULT false,
  fba_record_id uuid,
  gpt_drafted bool DEFAULT false,
  version int DEFAULT 1,
  teacher_note text,
  created_at timestamptz DEFAULT now()
);

-- 15. contract_versions (계약 갱신 이력)
CREATE TABLE pbs.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES pbs.behavior_contracts(id) NOT NULL,
  version int NOT NULL,
  changes_summary text,
  created_at timestamptz DEFAULT now()
);

-- 16. behavior_functions (근거DB: 행동 기능 분류)
CREATE TABLE pbs.behavior_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  function_label text NOT NULL,
  description text,
  examples text[],
  created_at timestamptz DEFAULT now()
);

-- 17. intervention_library (근거DB: 중재 전략)
CREATE TABLE pbs.intervention_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_code text NOT NULL,
  strategy_name text NOT NULL,
  description text,
  implementation_steps text[],
  evidence_level text,
  created_at timestamptz DEFAULT now()
);

-- 18. function_intervention_map (근거DB: 기능-전략 매핑)
CREATE TABLE pbs.function_intervention_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id uuid REFERENCES pbs.behavior_functions(id),
  intervention_id uuid REFERENCES pbs.intervention_library(id),
  priority_rank int DEFAULT 1,
  notes text
);

-- 19. extinction_risk_criteria (근거DB: 소거 위험도 기준)
CREATE TABLE pbs.extinction_risk_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_name text NOT NULL,
  description text,
  risk_level text,
  indicators text[],
  created_at timestamptz DEFAULT now()
);

-- 20. ethics_guidelines (근거DB: 윤리 가드레일)
CREATE TABLE pbs.ethics_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_code text NOT NULL,
  title text NOT NULL,
  content text,
  category text,
  created_at timestamptz DEFAULT now()
);

-- 21. fba_records (FBA 분석 기록)
CREATE TABLE pbs.fba_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  behavior_description text NOT NULL,
  antecedent_patterns text[],
  consequence_patterns text[],
  frequency_data jsonb,
  estimated_function text,
  confidence text,
  gpt_analysis text,
  created_at timestamptz DEFAULT now()
);

-- 22. ai_recommendations (AI 제안 이력)
CREATE TABLE pbs.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  fba_record_id uuid REFERENCES pbs.fba_records(id),
  recommendation_type text,
  recommended_strategies text[],
  gpt_output text,
  accepted bool,
  teacher_feedback text,
  created_at timestamptz DEFAULT now()
);

-- 23. extinction_alerts (소거 감지 알림)
CREATE TABLE pbs.extinction_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  goal_id uuid REFERENCES pbs.pbs_goals(id),
  alert_type text,
  risk_level text,
  description text,
  gpt_recommendation text,
  is_resolved bool DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 24. class_account (학급 공동계좌)
CREATE TABLE pbs.class_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid REFERENCES pbs.class_codes(id) UNIQUE NOT NULL,
  balance int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 25. class_transactions (공동계좌 거래내역)
CREATE TABLE pbs.class_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_account_id uuid REFERENCES pbs.class_account(id) NOT NULL,
  type text NOT NULL,
  amount int NOT NULL,
  balance_after int NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 26. dro_timers (DRO 타이머)
CREATE TABLE pbs.dro_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES pbs.students(id) NOT NULL,
  goal_id uuid REFERENCES pbs.pbs_goals(id) NOT NULL,
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text DEFAULT 'running',
  reset_count int DEFAULT 0,
  completed_at timestamptz
);

-- 27. consent_templates (동의서 템플릿)
CREATE TABLE pbs.consent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL,
  title_ko text NOT NULL,
  content_ko text NOT NULL,
  version text DEFAULT '1.0',
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 28. system_settings (학급별 시스템 설정)
CREATE TABLE pbs.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid REFERENCES pbs.class_codes(id) UNIQUE,
  currency_unit int DEFAULT 500,
  starting_balance int DEFAULT 1000,
  min_balance_protection int DEFAULT 500,
  interest_rate_weekly numeric DEFAULT 0.005,
  interest_min_balance int DEFAULT 2000,
  balance_carryover bool DEFAULT true,
  data_retention_months int DEFAULT 12,
  weather_location text DEFAULT '대구',
  updated_at timestamptz DEFAULT now()
);
