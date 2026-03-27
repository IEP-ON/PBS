-- ============================================================
-- Migration 003: pbs_intervention_library 근거기반 전략 시드 데이터
-- (DB에 이미 시드된 경우 ON CONFLICT DO NOTHING으로 무시)
-- 출처: Cooper, Heron & Heward (2020) ABA 3판
--       Carr & Durand (1985) JABA 18(2)
--       Repp & Dietz (1974) JABA 7(2)
--       What Works Clearinghouse (IES)
-- ============================================================

INSERT INTO pbs_intervention_library
  (name_ko, name_en, abbreviation, category,
   target_functions, evidence_level, evidence_basis,
   description_ko, cautions, contraindicated_functions)
VALUES

-- ① DRO: 타행동 차별강화
(
  '타행동 차별강화', 'Differential Reinforcement of Other Behavior', 'DRO',
  '차별강화',
  ARRAY['attention','escape','tangible','sensory'],
  'strong',
  'Repp & Dietz (1974) JABA 7(2):313-325; Cooper et al. (2020) ABA 3판 Ch.23',
  '설정한 간격 동안 표적 행동이 발생하지 않으면 강화를 제공한다. 간격은 기저선 평균 행동 간 간격(IBI) × 0.5로 시작하여 점진적으로 늘린다.',
  '간격 설정이 너무 길면 성공률 저하; 행동 발생 직후 강화 제공 금지',
  ARRAY[]::text[]
),

-- ② DRA: 대안행동 차별강화
(
  '대안행동 차별강화', 'Differential Reinforcement of Alternative Behavior', 'DRA',
  '차별강화',
  ARRAY['attention','escape','tangible'],
  'strong',
  'Cooper et al. (2020) ABA 3판 Ch.23; Vollmer & Iwata (1992)',
  '문제 행동의 기능과 동일한 강화를 얻을 수 있는 대안 행동을 가르치고, 대안 행동에만 강화를 제공한다.',
  '대안 행동이 문제 행동보다 획득 노력이 더 적어야 효과적',
  ARRAY[]::text[]
),

-- ③ DRI: 양립불가행동 차별강화
(
  '양립불가행동 차별강화', 'Differential Reinforcement of Incompatible Behavior', 'DRI',
  '차별강화',
  ARRAY['attention','escape','tangible'],
  'strong',
  'Cooper et al. (2020) ABA 3판 Ch.23',
  '표적 문제 행동과 동시에 발생할 수 없는 행동(예: 손 모으기 vs 물건 던지기)을 강화하여 문제 행동을 간접적으로 감소시킨다.',
  '양립 불가 행동이 학생에게 현재 가능한 행동이어야 함',
  ARRAY[]::text[]
),

-- ④ DRL: 저율 차별강화
(
  '저율행동 차별강화', 'Differential Reinforcement of Lower Rates', 'DRL',
  '차별강화',
  ARRAY['attention','tangible'],
  'moderate',
  'Cooper et al. (2020) ABA 3판 Ch.23; Deitz & Repp (1973)',
  '행동을 완전히 없애지 않고 빈도를 점진적으로 줄이는 전략. 허용 기준(예: 1시간에 2회 이하)을 충족하면 강화를 제공한다.',
  '행동을 완전 소거하려 할 때는 적합하지 않음; 사회적으로 적절한 수준의 행동에 적용',
  ARRAY[]::text[]
),

-- ⑤ FCT: 기능적 의사소통 훈련
(
  '기능적 의사소통 훈련', 'Functional Communication Training', 'FCT',
  'FCT',
  ARRAY['attention','escape','tangible'],
  'strong',
  'Carr & Durand (1985) JABA 18(2):111-126; Tiger et al. (2008)',
  '문제 행동과 동일한 기능(주의, 회피, 물건 획득)을 충족하는 의사소통 반응(말, 그림 교환, 제스처)을 체계적으로 가르친다. FBA 후 기능이 확인된 경우 최우선 적용.',
  '새로운 의사소통 반응 습득 기간 동안 소거와 병행 시 소거 폭발 주의',
  ARRAY[]::text[]
),

-- ⑥ NCR: 비유관 강화
(
  '비유관 강화', 'Noncontingent Reinforcement', 'NCR',
  'NCR',
  ARRAY['attention','sensory','tangible'],
  'strong',
  'Vollmer et al. (1993) JABA 26(2):1-12; Cooper et al. (2020) ABA 3판',
  '행동 발생과 무관하게 고정 시간 간격으로 강화를 제공하여 동기(EO)를 제거한다. 감각 추구 행동에는 대안 감각 자극을 정기적으로 제공하는 방식으로 적용.',
  '처음에는 짧은 간격으로 시작하여 점진적으로 늘림; 행동 발생 직후 강화 제공 절대 금지',
  ARRAY[]::text[]
),

-- ⑦ BC: 행동계약
(
  '행동계약', 'Behavioral Contract', 'BC',
  '자기관리',
  ARRAY['attention','escape','tangible'],
  'moderate',
  'Homme et al. (1970); Cooper et al. (2020) ABA 3판 Ch.28',
  '학생과 교사(및 보호자)가 합의한 목표 행동, 측정 방법, 달성 기준, 보상을 문서화한 계약서. 자기결정력이 있는 학생에게 특히 효과적.',
  '계약 조건은 달성 가능한 수준으로 설정; 서명 전 학생이 충분히 이해했는지 확인',
  ARRAY[]::text[]
),

-- ⑧ Shaping: 행동 형성
(
  '행동 형성', 'Shaping', 'Shaping',
  '행동형성',
  ARRAY['escape','sensory'],
  'strong',
  'Cooper et al. (2020) ABA 3판 Ch.12; Skinner (1938)',
  '목표 행동에 가까운 근사 행동부터 체계적으로 강화하여 점진적으로 최종 목표 행동으로 이끄는 전략. 회피 행동 감소에는 요구 수준을 점진적으로 높이는 방식으로 적용.',
  '너무 빠른 기준 상향 시 행동 감소; 충분한 강화 이력 후 다음 단계로 진행',
  ARRAY[]::text[]
)
ON CONFLICT (abbreviation) DO NOTHING;
