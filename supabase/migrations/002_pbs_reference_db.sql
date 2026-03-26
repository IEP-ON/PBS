-- ============================================================
-- PBS 행동 지원 계획 — 근거 기반 참조 DB (v2)
-- pbs_ 접두사 / public 스키마
--
-- 핵심 근거 문헌:
--   Cooper, Heron & Heward (2020). Applied Behavior Analysis, 3rd ed. Pearson.
--   BACB Task List 6th Edition (2017). https://www.bacb.com/
--   Sugai, G. & Horner, R.H. (2002). JEBD, 10(3), 130-135.
--   Lerman & Iwata (1995). JABA, 28(1), 93-94.  [소거 폭발]
--   Repp & Dietz (1974). JABA, 7(2), 313-325.   [DRO 간격]
--   Carr & Durand (1985). JABA, 18(2), 111-126. [FCT 원저]
--   Mace et al. (1988). JABA, 21(2), 123-141.   [High-P]
--   Ayllon & Azrin (1968). The Token Economy.    [TE 원저]
--   Wong et al. (2015). UNC Frank Porter Graham. [EBP for ASD]
--   What Works Clearinghouse (IES). https://whatworks.ed.gov
--   국립특수교육원 PBS 실행 매뉴얼 (2019). KNISE.
--   한국행동분석학회 윤리강령 (2020). KABA.
--   2022 개정 특수교육 교육과정.
--
-- v2 주요 수정사항:
--   1) function_type: automatic→sensory, access→tangible (AI 출력과 정렬)
--   2) 전략 추가: Visual Schedules(VS), High-P, Preference Assessment(PA)
--   3) NCR 약어 통일 (NCR/NCE → NCR)
--   4) Social Stories 제거 (WWC 근거 등급 미달)
--   5) 전 출처에 논문명·저널·연도 추가
--   6) pbs_ai_generation_log 신규 추가 (피드백 루프)
-- ============================================================

-- 기존 빈 참조 테이블 제거 (FK 의존 순서)
DROP TABLE IF EXISTS pbs_function_intervention_map CASCADE;
DROP TABLE IF EXISTS pbs_intervention_library CASCADE;
DROP TABLE IF EXISTS pbs_behavior_functions CASCADE;
DROP TABLE IF EXISTS pbs_extinction_risk_criteria CASCADE;
DROP TABLE IF EXISTS pbs_ethics_guidelines CASCADE;

-- ① pbs_behavior_functions
CREATE TABLE pbs_behavior_functions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_type         text UNIQUE NOT NULL,
  name_ko               text NOT NULL,
  name_en               text NOT NULL,
  description_ko        text,
  detection_signals     text[],
  common_antecedents    text[],
  common_consequences   text[],
  extinction_applicable boolean NOT NULL DEFAULT true,
  token_economy_notes   text,
  ref_sources           text[],
  created_at            timestamptz DEFAULT now()
);

-- ② pbs_intervention_library
CREATE TABLE pbs_intervention_library (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko                   text NOT NULL,
  name_en                   text NOT NULL,
  abbreviation              text UNIQUE NOT NULL,
  category                  text NOT NULL,
  target_functions          text[],
  evidence_level            text NOT NULL CHECK (evidence_level IN ('strong','moderate','emerging')),
  evidence_basis            text NOT NULL,
  description_ko            text NOT NULL,
  implementation_steps      jsonb,
  cautions                  text,
  contraindicated_functions text[],
  token_economy_integration text,
  suitable_disability_types text[],
  ref_sources               text[],
  created_at                timestamptz DEFAULT now()
);

-- ③ pbs_function_intervention_map
CREATE TABLE pbs_function_intervention_map (
  function_type             text NOT NULL,
  intervention_abbreviation text NOT NULL,
  priority                  int  NOT NULL CHECK (priority BETWEEN 1 AND 3),
  rationale                 text,
  PRIMARY KEY (function_type, intervention_abbreviation)
);

-- ④ pbs_extinction_risk_criteria
CREATE TABLE pbs_extinction_risk_criteria (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_type           text UNIQUE NOT NULL,
  risk_level              text NOT NULL CHECK (risk_level IN ('high','medium','low','not_applicable')),
  burst_likelihood        text,
  safety_considerations   text,
  recommended_preparation text[],
  created_at              timestamptz DEFAULT now()
);

-- ⑤ pbs_ethics_guidelines
CREATE TABLE pbs_ethics_guidelines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category       text NOT NULL,
  guideline_ko   text NOT NULL,
  basis          text,
  ai_prompt_rule text,
  created_at     timestamptz DEFAULT now()
);

-- ⑥ pbs_ai_generation_log (신규)
CREATE TABLE IF NOT EXISTS pbs_ai_generation_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id        uuid REFERENCES pbs_class_codes(id) ON DELETE SET NULL,
  student_id          uuid REFERENCES pbs_students(id) ON DELETE SET NULL,
  input_data          jsonb NOT NULL,
  ai_output           jsonb NOT NULL,
  estimated_function  text,
  teacher_modified    boolean DEFAULT false,
  final_saved         jsonb,
  accepted            boolean,
  teacher_feedback    text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE pbs_ai_generation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_own_class" ON pbs_ai_generation_log
  USING (classroom_id IN (
    SELECT id FROM pbs_class_codes WHERE is_active = true
  ));

-- ============================================================
-- 데이터 삽입
-- ============================================================

INSERT INTO pbs_behavior_functions
  (function_type,name_ko,name_en,description_ko,detection_signals,
   common_antecedents,common_consequences,extinction_applicable,
   token_economy_notes,ref_sources)
VALUES
('attention','사회적 관심','Social Attention',
 '교사·또래 등 타인의 관심을 얻기 위해 행동이 유지. 부정적 관심(꾸중)에도 강화됨.',
 ARRAY['청중이 있을 때 행동 증가','혼자 있을 때 감소','부정적 관심에도 지속','다른 학생이 관심 받을 때 증가'],
 ARRAY['교사가 다른 학생 지도 중','교사 행정 업무 중','혼자 과제 수행 상황'],
 ARRAY['교사의 언어적 반응(꾸중 포함)','또래의 웃음·반응','교사의 신체적 근접'],
 true,'적절한 관심 요청 행동에 즉시 토큰 지급. 문제행동에는 절대 토큰 미지급.',
 ARRAY['Cooper, Heron & Heward (2020). ABA 3rd ed. Ch.9',
       'Iwata et al. (1994). JABA, 27(2), 197-209',
       'BACB Task List 6th Ed. E-7']),
('escape','회피/도피','Escape/Avoidance',
 '어렵거나 불편한 과제·상황으로부터 벗어나기 위해 행동이 유지.',
 ARRAY['과제 제시 직후 행동 증가','난이도 높을수록 빈도 증가','과제 제거 시 즉각 감소'],
 ARRAY['어렵거나 긴 과제 제시','선호하지 않는 활동 시작','소음·감각 자극 강한 환경'],
 ARRAY['과제 제거 또는 중단','교실 밖으로 보내짐','개별 지원 제공(의도치 않은 강화)'],
 true,'과제 완료 후 토큰 지급 구조 효과적. 단계별 소액 지급으로 회피 동기 감소.',
 ARRAY['Cooper, Heron & Heward (2020). ABA 3rd ed. Ch.9',
       'Iwata et al. (1994). JABA, 27(2), 197-209',
       'BACB Task List 6th Ed. E-7']),
('sensory','감각/자동적 강화','Sensory/Automatic Reinforcement',
 '외부 결과 없이 행동 자체가 감각 자극을 제공하여 내적으로 유지. 소거 적용 불가.',
 ARRAY['혼자 있을 때도 행동 발생','관심 제공·과제 제거에도 지속','특정 감각 패턴 반복','외부 강화에 무반응'],
 ARRAY['과소 자극 환경(조용·단조)','과잉 자극 환경(시끄·혼란)','비구조화된 자유시간'],
 ARRAY['감각 자극 자체(내적 보상)','행동 차단 시 저항·울음'],
 false,'토큰경제 단독 효과 제한적. 감각적으로 동등한 대안 활동을 가게 아이템으로 구성 권장.',
 ARRAY['Cooper, Heron & Heward (2020). ABA 3rd ed. Ch.9',
       'Vollmer (1994). JABA, 27(3), 533-544',
       'BACB Task List 6th Ed. E-7']),
('tangible','선호 자원 접근','Access to Tangibles/Activities',
 '원하는 물건·음식·활동에 접근하기 위해 행동이 유지.',
 ARRAY['원하는 것이 보이거나 접근 제한될 때 증가','원하는 것 얻으면 즉시 감소','특정 물건/활동 주변에서만 발생'],
 ARRAY['선호 물건/음식이 눈앞에 있지만 접근 제한','원하는 활동 종료','대기 상황'],
 ARRAY['원하는 물건/활동 제공','다른 사람 것을 빼앗음','활동 복귀 허용'],
 true,'토큰경제와 가장 직접 연계. 적절한 요청→토큰→가게에서 선호 자원 구매.',
 ARRAY['Cooper, Heron & Heward (2020). ABA 3rd ed. Ch.9',
       'Iwata et al. (1994). JABA, 27(2), 197-209',
       'BACB Task List 6th Ed. E-7']);

INSERT INTO pbs_extinction_risk_criteria
  (function_type,risk_level,burst_likelihood,safety_considerations,recommended_preparation)
VALUES
('attention','medium',
 '소거 폭발(강도·빈도 일시 증가) 가능성 중간. 근거: Lerman & Iwata (1995). JABA, 28(1), 93-94.',
 '타인에게 해가 되는 행동(때리기·물건 던지기) 여부 사전 확인 필요.',
 ARRAY['소거 전 DRA 행동 충분히 확립','반 전체 교사 일관성 교육',
       '보호자에게 소거 폭발 사전 안내','소거 폭발 시 안전 계획 수립']),
('escape','high',
 '소거 폭발 가능성 높음. 회피 욕구 충족 안 되면 행동 강도 급증. 근거: Lerman & Iwata (1995).',
 '자해·공격 행동으로 이어질 수 있음. TM-CM(과제수정) 반드시 병행.',
 ARRAY['과제 수정으로 회피 동기 먼저 감소','FCT로 적절한 도움 요청 확립 후 소거 시작',
       '안전한 환경 구성(위험 물건 제거)','위기 대응 계획 수립 및 팀 공유']),
('sensory','not_applicable',
 '자동적/감각적 강화 기능에 소거 적용 불가. 강화 원천이 내부적이므로 외부에서 제거 불가.',
 '소거 시도 시 오히려 행동 악화 가능. 환경 수정 및 대안 자극 제공만 가능.',
 ARRAY['소거 적용 절대 금지','감각 대체 자극 제공 우선',
       '환경 수정(자극 수준 조절)','작업치료사 협의 권장']),
('tangible','medium',
 '소거 폭발 가능성 중간. 원하는 것을 얻지 못할 때 행동 강도 증가. 근거: Lerman & Iwata (1995).',
 '공격 행동 여부 확인. NCR로 박탈 상태 먼저 감소 필요.',
 ARRAY['NCR으로 박탈 상태 감소','FCT 충분히 확립 후 소거 시작',
       '소거 폭발 시 안전 계획','원하는 것 완전 차단 금지, 접근 조건만 변경']);

INSERT INTO pbs_ethics_guidelines (category,guideline_ko,basis,ai_prompt_rule)
VALUES
('general','AI 제안은 보조적 도구이며 최종 판단은 반드시 교사가 한다.',
 '한국행동분석학회 윤리강령 2조; BACB Ethics Code 2.01',
 'All suggestions are advisory only. Final professional judgment belongs to the teacher.'),
('general','근거 없는 제안을 하지 않는다. 불확실한 경우 "추가 관찰이 필요합니다"라고 명시한다.',
 'BACB Ethics Code 2.01; 한국행동분석학회 윤리강령',
 'Only suggest evidence-based strategies. If uncertain, state "추가 관찰이 필요합니다".'),
('extinction','소거는 반드시 DRA/FCT와 병행하며 단독 적용을 제안하지 않는다.',
 'BACB Ethics Code 2.15; Cooper et al.(2020) Ch.12',
 'Never recommend extinction alone. Always pair with DRA, DRI, or FCT.'),
('punishment','반응대가는 FBA 완료 후, 보호자 동의 후, 풍부한 강화 기회 병행 하에만 제안한다.',
 'BACB Ethics Code 2.15; 특수교육법 시행령',
 'Only suggest response cost after FBA, parental consent, and rich reinforcement are confirmed.'),
('sensory','감각/자동적 강화 기능에 소거 적용을 절대 제안하지 않는다.',
 'Cooper, Heron & Heward (2020). ABA 3rd ed. Ch.12; BACB Task List 6th Ed.',
 'Never suggest extinction for sensory/automatically reinforced behaviors.'),
('privacy','학생 행동 데이터는 교육 목적으로만 사용. 외부 공유 시 보호자 동의 필요.',
 '개인정보보호법; 장애인 등에 대한 특수교육법',
 'Student behavioral data for educational purposes only. External sharing requires parental consent.'),
('safety','자해 또는 타해 위험 행동 중재 시 전문가 팀 협의를 권장한다.',
 'BACB Ethics Code 2.02; 학교안전법',
 'When behaviors involve self-injury or aggression risk, recommend specialist team consultation.');

-- intervention_library 는 별도 migration 003 참조
-- function_intervention_map 는 별도 migration 004 참조
