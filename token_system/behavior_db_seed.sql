-- ============================================================
-- 특수학급 화폐·금융 시스템 — 행동주의 근거 DB
-- 기반: ABA 원칙(Cooper 등 재구조화), BACB Task List 6판, 
--       국립특수교육원 PBS 매뉴얼, APBS 기준
-- ============================================================

-- ① 행동 기능 분류 테이블
CREATE TABLE IF NOT EXISTS behavior_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_type text UNIQUE NOT NULL,
  name_ko text NOT NULL,
  name_en text NOT NULL,
  description_ko text,
  detection_signals text[],
  common_antecedents text[],
  common_consequences text[],
  token_economy_notes text
);

INSERT INTO behavior_functions 
  (function_type, name_ko, name_en, description_ko, detection_signals, common_antecedents, common_consequences, token_economy_notes)
VALUES
(
  'attention',
  '사회적 관심',
  'Social Attention',
  '교사, 또래 등 타인의 관심을 얻기 위해 행동이 유지되는 경우. 행동의 결과로 사람들이 반응할 때 강화된다.',
  ARRAY[
    '청중(교사/또래)이 있을 때 행동 증가',
    '혼자 있거나 관심 받을 때 행동 감소',
    '부정적 관심(꾸중)에도 행동이 유지됨',
    '다른 학생이 관심 받을 때 행동 증가'
  ],
  ARRAY[
    '교사가 다른 학생을 지도할 때',
    '교사가 행정 업무 중일 때',
    '또래와 상호작용 기회가 적을 때',
    '혼자 과제를 수행해야 할 때'
  ],
  ARRAY[
    '교사의 언어적 반응(꾸중 포함)',
    '또래의 웃음·반응',
    '교사의 신체적 근접',
    '활동 중단 및 개별 지도'
  ],
  '토큰경제 직접 연계 효과 높음. 적절한 관심 요청 행동에 토큰 지급 시 빠른 행동 변화 가능. 단, 문제행동에는 절대 토큰 지급 금지(소거 원칙).'
),
(
  'escape',
  '회피/도피',
  'Escape/Avoidance',
  '어렵거나 불편한 과제, 상황, 사람으로부터 벗어나기 위해 행동이 유지되는 경우.',
  ARRAY[
    '과제 제시 직후 행동 증가',
    '과제 난이도 높을수록 행동 빈도 증가',
    '과제 제거 시 행동 즉각 감소',
    '특정 교과·활동 시간에만 집중적으로 발생'
  ],
  ARRAY[
    '어렵거나 긴 과제 제시',
    '선호하지 않는 활동 시작',
    '특정 교사·또래와의 상황',
    '소음·감각 자극이 강한 환경'
  ],
  ARRAY[
    '과제 제거 또는 중단',
    '교실 밖으로 보내짐',
    '다른 활동으로 전환',
    '개별 지원 제공(의도치 않은 강화)'
  ],
  '과제 완료 후 토큰 지급 구조 효과적. 과제를 단계별로 쪼개고 각 단계 완료 시 소액 지급하여 회피 동기 감소 가능. DRO 타이머 기능과 병행 권장.'
),
(
  'automatic',
  '자동적 강화',
  'Automatic/Sensory Reinforcement',
  '외부 사회적 결과 없이 행동 자체가 감각적 자극을 제공하여 유지되는 경우. 내적 강화.',
  ARRAY[
    '혼자 있을 때도 행동 발생',
    '관심을 주거나 과제를 제거해도 행동 지속',
    '특정 감각 패턴 반복(청각/촉각/시각/전정)',
    '행동 자체에 몰두하는 표정·태도'
  ],
  ARRAY[
    '과소 자극 환경(조용하고 단조로운 상황)',
    '과잉 자극 환경(시끄럽고 혼란스러운 상황)',
    '전환 상황',
    '비구조화된 자유시간'
  ],
  ARRAY[
    '감각 자극 자체(내적 보상)',
    '행동 차단 시 저항·울음',
    '외부 강화에 무반응'
  ],
  '토큰경제 단독 효과 제한적. 행동과 동등하거나 더 강한 감각 자극을 제공하는 대체 활동을 가게 아이템으로 구성하는 것이 효과적. 환경 수정이 선행되어야 함.'
),
(
  'access',
  '선호 자원 접근',
  'Access to Tangibles/Activities',
  '원하는 물건, 음식, 활동 등 선호 자원에 접근하기 위해 행동이 유지되는 경우.',
  ARRAY[
    '원하는 물건/활동이 보이거나 접근 제한될 때 행동 증가',
    '원하는 것을 얻으면 행동 즉시 감소',
    '특정 물건/활동 주변에서만 행동 발생',
    '선호 자원 없는 환경에서는 행동 적음'
  ],
  ARRAY[
    '선호 물건/음식/활동이 눈앞에 있지만 접근 제한',
    '원하는 활동의 종료',
    '다른 학생이 원하는 것을 가질 때',
    '대기 상황'
  ],
  ARRAY[
    '원하는 물건/활동 제공',
    '다른 사람이 갖고 있던 것을 빼앗음',
    '활동 복귀 허용'
  ],
  '토큰경제와 가장 직접적으로 연계됨. 적절한 요청 행동 → 토큰 획득 → 가게에서 선호 자원 구매 흐름이 자연스러움. 비수반 접근(NCE) 병행으로 박탈 상태 줄이기 권장.'
);

-- ② 중재 전략 라이브러리
CREATE TABLE IF NOT EXISTS intervention_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko text NOT NULL,
  name_en text NOT NULL,
  abbreviation text,
  category text, -- differential_reinforcement / antecedent / extinction / contract / group
  target_functions text[],
  evidence_level text, -- strong / moderate / emerging / mixed
  evidence_basis text,
  description_ko text,
  implementation_steps jsonb,
  cautions text,
  contraindicated_functions text[],
  token_economy_integration text,
  suitable_disability_types text[],
  references text[]
);

INSERT INTO intervention_library
  (name_ko, name_en, abbreviation, category, target_functions, evidence_level, evidence_basis, description_ko, implementation_steps, cautions, contraindicated_functions, token_economy_integration, suitable_disability_types, references)
VALUES

-- DRA
(
  '대안행동 차별강화',
  'Differential Reinforcement of Alternative Behavior',
  'DRA',
  'differential_reinforcement',
  ARRAY['attention','escape','access'],
  'strong',
  'BACB Task List 6판 E-7, What Works Clearinghouse 특수교육 강력 지지',
  '문제행동과 동일한 기능을 수행하는 사회적으로 적절한 대안행동에만 강화를 제공하고, 문제행동에는 강화를 중단(소거)하는 전략.',
  '[
    {"step": 1, "action": "문제행동의 기능 파악(FBA 실시)"},
    {"step": 2, "action": "동일 기능을 가진 대안행동 선정(현재 레퍼토리 내에서)"},
    {"step": 3, "action": "대안행동 발생 시 즉각 강화 제공"},
    {"step": 4, "action": "문제행동 발생 시 일관되게 소거 적용"},
    {"step": 5, "action": "대안행동 안정화 후 강화 계획 점진적 약화"}
  ]'::jsonb,
  '소거 병행 없이 DRA만 적용 시 효과 감소. 대안행동이 문제행동보다 쉽고 즉각적인 강화를 얻어야 효과적. 소거 폭발에 대한 사전 계획 필수.',
  ARRAY['automatic'],
  '대안행동 발생 시 즉각 토큰 입금. 교사 체크 → 실시간 입금 기능 활용. 문제행동에는 절대 토큰 미지급.',
  ARRAY['지적장애','자폐성장애','정서행동장애','학습장애'],
  ARRAY['BACB Task List 6th Ed. E-7', '국립특수교육원 PBS 실행 매뉴얼 3장', 'What Works Clearinghouse: Students with Learning Disabilities']
),

-- DRI
(
  '양립불가행동 차별강화',
  'Differential Reinforcement of Incompatible Behavior',
  'DRI',
  'differential_reinforcement',
  ARRAY['attention','escape','access'],
  'strong',
  'BACB Task List 6판 E-7 하위 전략, DRA의 특수 형태',
  '문제행동과 물리적으로 동시에 수행 불가능한 행동을 선정하여 강화. 예: 자리이탈의 대안으로 착석 행동 강화.',
  '[
    {"step": 1, "action": "문제행동과 동시에 발생 불가능한 행동 목록 작성"},
    {"step": 2, "action": "학생의 현재 능력으로 수행 가능한 것 선정"},
    {"step": 3, "action": "양립불가 행동 발생 시 즉각 강화"},
    {"step": 4, "action": "문제행동 발생 시 소거 적용"},
    {"step": 5, "action": "강화 계획 점진적 약화"}
  ]'::jsonb,
  '양립불가 행동이 학생에게 어렵거나 싫은 것이면 오히려 회피 동기 강화 가능. 학생이 즐겁게 할 수 있는 양립불가 행동 선정 중요.',
  ARRAY['automatic'],
  '착석 유지, 손 모으기, 눈 맞춤 등의 행동에 토큰 지급. PBS 목표행동 태그에 DRI 표시하여 관리.',
  ARRAY['지적장애','자폐성장애','정서행동장애'],
  ARRAY['BACB Task List 6th Ed. E-7', '국립특수교육원 PBS 실행 매뉴얼 3장']
),

-- DRO
(
  '다른행동 차별강화',
  'Differential Reinforcement of Other Behavior',
  'DRO',
  'differential_reinforcement',
  ARRAY['attention','escape','access','automatic'],
  'strong',
  'BACB Task List 6판 E-7, 광범위한 실증 연구 지지',
  '일정 시간 동안 문제행동이 발생하지 않으면 강화 제공. 어떤 다른 행동을 해도 괜찮고, 오직 문제행동만 없으면 됨.',
  '[
    {"step": 1, "action": "기초선 데이터로 문제행동 평균 발생 간격 파악"},
    {"step": 2, "action": "초기 DRO 간격을 평균 간격보다 짧게 설정"},
    {"step": 3, "action": "타이머 시작, 시간 경과 시 즉각 강화"},
    {"step": 4, "action": "문제행동 발생 시 타이머 리셋"},
    {"step": 5, "action": "성공률 80% 이상 시 간격 점진적 늘리기"}
  ]'::jsonb,
  '초기 간격이 너무 길면 실패 경험 증가. 반드시 기초선 자료 기반으로 간격 설정. 간격이 길어질수록 어떤 행동에 강화된 것인지 모호해질 수 있음.',
  ARRAY[],
  '시스템 내 DRO 타이머 기능 핵심 활용. 교사가 간격 설정 → 타이머 종료 시 자동 토큰 입금. 문제행동 발생 시 교사가 리셋 버튼 클릭.',
  ARRAY['지적장애','자폐성장애','정서행동장애'],
  ARRAY['BACB Task List 6th Ed. E-7', '국립특수교육원 PBS 실행 매뉴얼 3장']
),

-- DRL
(
  '낮은비율행동 차별강화',
  'Differential Reinforcement of Low Rates of Behavior',
  'DRL',
  'differential_reinforcement',
  ARRAY['attention','escape','access','automatic'],
  'moderate',
  'BACB Task List 6판 E-7, 빈도 감소 목표 중재 지지',
  '행동 자체를 완전히 없애는 것이 아니라 빈도를 점진적으로 줄이는 것이 목표. 일정 기준 이하 발생 시 강화.',
  '[
    {"step": 1, "action": "기초선 행동 빈도 측정(주간 단위)"},
    {"step": 2, "action": "초기 기준: 기초선의 70~80% 수준으로 설정"},
    {"step": 3, "action": "주간 기준 이하로 발생 시 주간 보너스 지급"},
    {"step": 4, "action": "2주 연속 달성 시 기준 10% 낮추기"},
    {"step": 5, "action": "목표 빈도 도달 시 DRL 종료, 다른 전략으로 전환"}
  ]'::jsonb,
  '기준 설정이 너무 낮으면 동기 저하, 너무 높으면 의미 없음. 행동 완전 제거가 목표라면 DRO가 더 적합. 행동이 완전히 없어지면 안 되는 경우(예: 수업 중 질문하기)에 적합.',
  ARRAY[],
  '주간 정산 시 DRL 달성 여부 자동 계산 → 보너스 자동 입금. PBS 목표에 주간 허용 빈도 설정 기능 필요.',
  ARRAY['지적장애','정서행동장애','주의력결핍 과잉행동장애'],
  ARRAY['BACB Task List 6th Ed. E-7', '국립특수교육원 PBS 실행 매뉴얼 3장']
),

-- FCT
(
  '기능적 의사소통 훈련',
  'Functional Communication Training',
  'FCT',
  'differential_reinforcement',
  ARRAY['attention','escape','access'],
  'strong',
  'BACB Task List 6판, What Works Clearinghouse 강력 지지, 자폐성장애 중재 핵심 전략',
  '문제행동의 기능과 동일한 결과를 얻을 수 있는 의사소통 행동(언어/AAC/제스처)을 훈련하여 문제행동을 대체.',
  '[
    {"step": 1, "action": "문제행동 기능 파악"},
    {"step": 2, "action": "동일 기능의 의사소통 형태 선정(말/그림카드/AAC기기/수어)"},
    {"step": 3, "action": "의사소통 행동 집중 훈련(촉구 → 점진적 제거)"},
    {"step": 4, "action": "의사소통 시 즉각 원하는 것 제공"},
    {"step": 5, "action": "문제행동 시 의사소통 기회 제공 후 소거"}
  ]'::jsonb,
  '초기에는 모든 의사소통 시도에 즉각 반응 필수. 반응이 느리거나 없으면 문제행동으로 회귀. AAC 기기 사용 시 기기 항상 접근 가능해야 함.',
  ARRAY['automatic'],
  '의사소통 행동 발생 시 토큰 입금. "도와주세요 카드 사용" "쉬고 싶다고 말하기" 등 FCT 목표행동을 PBS 체크 목록에 등록.',
  ARRAY['자폐성장애','지적장애','발달지체','지체장애'],
  ARRAY['BACB Task List 6th Ed.', 'What Works Clearinghouse', '국립특수교육원 AAC 활용 가이드']
),

-- NCE (비수반 강화)
(
  '비수반 강화',
  'Noncontingent Reinforcement',
  'NCR/NCE',
  'antecedent',
  ARRAY['attention','access'],
  'strong',
  'BACB Task List 6판 E-6, 선행중재 전략 강력 근거',
  '행동과 무관하게 고정 시간 간격으로 강화를 제공하여 강화에 대한 박탈 상태를 줄이고 문제행동의 동기 자체를 감소시키는 선행중재.',
  '[
    {"step": 1, "action": "주요 강화제 파악(선호도 평가)"},
    {"step": 2, "action": "고정 시간 간격 설정(예: 5분마다 관심 제공)"},
    {"step": 3, "action": "행동과 무관하게 일정 간격으로 강화 제공"},
    {"step": 4, "action": "문제행동에는 반응하지 않음(소거)"},
    {"step": 5, "action": "간격 점진적으로 늘려 자연스러운 강화 계획으로 이동"}
  ]'::jsonb,
  '문제행동 발생 직후 강화를 주면 안 됨(반드시 간격 지키기). 처음에는 짧은 간격으로 시작하여 충분한 강화 경험 제공. 다른 차별강화 전략과 병행 필요.',
  ARRAY['escape','automatic'],
  '직접 토큰 지급보다는 가게 아이템 중 "선생님과 1:1 시간" "원하는 자리 선택" 등 관심·접근 기능 아이템을 NCE로 제공하는 방식으로 연계.',
  ARRAY['지적장애','자폐성장애','정서행동장애'],
  ARRAY['BACB Task List 6th Ed. E-6', '국립특수교육원 PBS 실행 매뉴얼 2장']
),

-- 행동계약
(
  '행동계약',
  'Behavioral Contracting',
  'BC',
  'contract',
  ARRAY['attention','escape','access'],
  'strong',
  'BACB Task List 6판 G-22, 국립특수교육원 자기결정 기술 지원 매뉴얼',
  '교사와 학생이 합의하여 목표 행동, 달성 기준, 보상 내용을 명시한 공식 계약서를 작성하고 상호 서명하는 전략. 학생의 자기결정권 강화.',
  '[
    {"step": 1, "action": "학생과 함께 목표 행동 협의(학생이 이해 가능한 언어)"},
    {"step": 2, "action": "측정 가능한 달성 기준 설정"},
    {"step": 3, "action": "보상 내용 협의(학생 선호 기반)"},
    {"step": 4, "action": "계약 기간 설정(1~4주 권장)"},
    {"step": 5, "action": "교사·학생·보호자 서명"},
    {"step": 6, "action": "계약서 학생 소지, 정기적 진행 상황 점검"},
    {"step": 7, "action": "달성 시 즉각 보상, 미달성 시 계약 재협의"}
  ]'::jsonb,
  '학생이 계약 내용을 이해해야 효과적. 지적 능력이 낮은 경우 그림/사진 계약서 활용. 처벌 조항보다 보상 중심으로 구성. 실패 경험이 반복되지 않도록 초기 기준 낮게 설정.',
  ARRAY['automatic'],
  '계약서 생성 → 시스템 자동 정산 규칙 연동. 계약 달성 시 자동 보너스 입금. 계약 이력이 통장 포트폴리오에 기록.',
  ARRAY['지적장애','정서행동장애','학습장애'],
  ARRAY['BACB Task List 6th Ed. G-22', '국립특수교육원 자기결정 기술 지원 매뉴얼', '2022 개정 특수교육 교육과정 전환교육 영역']
),

-- 집단수반성
(
  '집단수반성',
  'Group Contingency',
  'GC',
  'group',
  ARRAY['attention','access'],
  'strong',
  'BACB Task List 6판, What Works Clearinghouse 사회적 행동 중재 지지',
  '개인이 아닌 집단(학급 전체 또는 소집단)의 행동에 수반하여 강화를 제공하는 전략. 또래 지원과 사회적 압력을 활용.',
  '[
    {"step": 1, "action": "집단 목표 행동 설정(모든 학생이 이해 가능하게)"},
    {"step": 2, "action": "집단 달성 기준 설정"},
    {"step": 3, "action": "달성 진행 상황 시각적으로 게시"},
    {"step": 4, "action": "집단 목표 달성 시 집단 보상 제공"},
    {"step": 5, "action": "개인 기여도 인정도 병행"}
  ]'::jsonb,
  '특정 학생을 비난하거나 낙인찍는 방향으로 흘러가지 않도록 주의. 한 명의 실수로 전체가 피해보는 의존적 집단수반성은 특수학급에서 매우 신중하게 사용. 독립적·상호의존적 형태 권장.',
  ARRAY['escape','automatic'],
  '학급 공동계좌 기능 연계. MVP 보너스(한 명 달성 → 전체 소액 입금) 또는 학급 전체 목표 달성 시 공동계좌 입금 → 학급 이벤트 사용.',
  ARRAY['지적장애','자폐성장애','정서행동장애'],
  ARRAY['BACB Task List 6th Ed.', '국립특수교육원 PBS 실행 매뉴얼 4장']
),

-- 반응대가
(
  '반응대가',
  'Response Cost',
  'RC',
  'differential_reinforcement',
  ARRAY['attention','escape','access'],
  'moderate',
  'BACB Task List 6판 E-8, 토큰경제 구성요소로 조건부 사용',
  '특정 문제행동 발생 시 이미 획득한 토큰이나 강화제 일부를 회수하는 전략. 반드시 풍부한 강화 기회와 함께 사용.',
  '[
    {"step": 1, "action": "FBA 완료 후 신중하게 적용 여부 결정"},
    {"step": 2, "action": "보호자 동의 및 설명"},
    {"step": 3, "action": "어떤 행동에 얼마가 차감되는지 명확히 학생에게 설명"},
    {"step": 4, "action": "최저잔액 보호 규칙 설정(잔액 0 방지)"},
    {"step": 5, "action": "차감은 냉정하고 비감정적으로 실행"},
    {"step": 6, "action": "효과 모니터링, 행동 증가 시 즉각 중단"}
  ]'::jsonb,
  '잔액이 0이 되면 동기 완전 상실 위험. 특수교육 대상학생에게는 기본값 비활성화. 보호자 동의 필수. 공격적 행동 등 안전 위협 행동에만 제한적 사용. 강화 기회보다 처벌 기회가 많아지면 즉각 중단.',
  ARRAY['automatic'],
  '교사가 학생별로 개별 활성화(기본값: 비활성). 최저잔액 500원 이하 차감 불가 규칙 시스템 적용. 차감 내역 통장에 투명하게 기록. 보호자 동의 체크 후 활성화.',
  ARRAY['정서행동장애'],
  ARRAY['BACB Task List 6th Ed. E-8', '국립특수교육원 PBS 실행 매뉴얼']
),

-- 행동형성
(
  '행동형성',
  'Shaping',
  'Shaping',
  'antecedent',
  ARRAY['attention','escape','access','automatic'],
  'strong',
  'BACB Task List 6판 E-4',
  '목표 행동에 점진적으로 근접하는 행동들을 차별강화하여 새로운 행동을 형성하는 전략. 현재 레퍼토리에서 시작하여 단계적으로 기준 높이기.',
  '[
    {"step": 1, "action": "최종 목표 행동 명확히 정의"},
    {"step": 2, "action": "현재 행동 수준 파악"},
    {"step": 3, "action": "목표까지의 단계 설정(5~10단계)"},
    {"step": 4, "action": "현재 수준에서 강화 시작"},
    {"step": 5, "action": "각 기준 80% 이상 달성 시 다음 단계로 이동"},
    {"step": 6, "action": "이전 단계 행동은 더 이상 강화하지 않음"}
  ]'::jsonb,
  '너무 빨리 기준을 높이면 행동 소거 위험. 충분한 성공 경험 후 단계 이동. 퇴행 시 이전 단계로 돌아가는 것을 두려워하지 않기.',
  ARRAY[],
  '행동계약서의 "레벨업" 기능으로 구현. 월별 기준 조정 시 통장에 "레벨2 달성" 등 기록. PBS 목표행동 단가를 단계에 따라 점진적으로 조정 가능하도록 설계.',
  ARRAY['지적장애','자폐성장애','발달지체','지체장애'],
  ARRAY['BACB Task List 6th Ed. E-4', '국립특수교육원 PBS 실행 매뉴얼']
),

-- 자기모니터링
(
  '자기모니터링',
  'Self-Monitoring',
  'SM',
  'antecedent',
  ARRAY['attention','escape','access','automatic'],
  'strong',
  'BACB Task List 6판 G-21, 자기관리 기술, 전환교육 핵심역량',
  '학생이 스스로 자신의 행동 발생 여부를 관찰하고 기록하는 전략. 자기인식, 자기결정, 독립성 향상.',
  '[
    {"step": 1, "action": "목표 행동 학생에게 명확히 설명(그림/영상 포함)"},
    {"step": 2, "action": "자기기록 도구 제공(체크리스트/앱)"},
    {"step": 3, "action": "처음에는 교사 관찰과 대조하여 정확도 점검"},
    {"step": 4, "action": "정확한 자기기록에도 강화 제공"},
    {"step": 5, "action": "교사 확인 점진적 감소, 학생 자율 증가"},
    {"step": 6, "action": "자기평가 → 자기강화 단계로 발전"}
  ]'::jsonb,
  '초기 정확도 낮을 수 있음(과대/과소 보고). 비처벌적 분위기에서 정직한 기록 장려. 교사 확인 없이 토큰 남발 방지 위해 교사 승인 단계 필수.',
  ARRAY[],
  '학생 태블릿에서 셀프 체크 요청 → 교사 승인 → 토큰 입금. 자기모니터링 정확도 자체에도 보너스 지급 가능. 고학년 전환교육과 직접 연계.',
  ARRAY['지적장애','학습장애','정서행동장애','자폐성장애'],
  ARRAY['BACB Task List 6th Ed. G-21', '국립특수교육원 자기결정 기술 지원 매뉴얼', '2022 개정 특수교육 교육과정 전환교육']
),

-- 선행사건 중재 - 과제수정
(
  '과제 수정 및 선택 제공',
  'Task Modification and Choice-Making',
  'TM-CM',
  'antecedent',
  ARRAY['escape'],
  'strong',
  'BACB Task List 6판 E-6 선행중재, 국립특수교육원 교수적 수정 가이드',
  '회피 기능 행동의 선행사건(어려운 과제)을 수정하여 문제행동 발생 동기 자체를 줄이는 전략. 과제 난이도, 길이, 형식, 순서에 선택권 제공.',
  '[
    {"step": 1, "action": "어떤 과제 특성이 회피 동기를 유발하는지 파악"},
    {"step": 2, "action": "과제 길이 조정(짧은 과제 먼저, 고강도-저강도 교차)"},
    {"step": 3, "action": "형식 선택권 제공(쓰기/말하기/그리기 중 선택)"},
    {"step": 4, "action": "순서 선택권 제공(어떤 과제부터 할지)"},
    {"step": 5, "action": "적절한 난이도 조절(성공 경험 80% 목표)"}
  ]'::jsonb,
  '선택권이 너무 많으면 결정 장애 유발 가능. 2~3가지 선택지 제공이 적당. 모든 선택지가 교육적으로 의미 있어야 함.',
  ARRAY['attention','automatic','access'],
  '과제 완료 후 토큰 지급 구조와 연계. 선택권 행사 자체를 기록하여 자기결정 역량 데이터로 활용.',
  ARRAY['지적장애','자폐성장애','정서행동장애','학습장애'],
  ARRAY['BACB Task List 6th Ed. E-6', '국립특수교육원 교수적 수정 가이드', '2022 개정 특수교육 교육과정']
),

-- 프리맥 원리
(
  '프리맥 원리',
  'Premack Principle',
  'PP',
  'antecedent',
  ARRAY['escape','access'],
  'strong',
  'BACB Task List 6판 E-2 강화 원리',
  '높은 선호 활동을 낮은 선호 활동의 강화제로 사용하는 원리. "먼저 ○○ 하면, 그 다음 ○○ 할 수 있어" 구조.',
  '[
    {"step": 1, "action": "선호도 평가로 고선호/저선호 활동 파악"},
    {"step": 2, "action": "저선호 과제 → 고선호 활동 순서 구성"},
    {"step": 3, "action": "시각적 일과표로 학생에게 명확히 제시"},
    {"step": 4, "action": "저선호 과제 완료 시 즉각 고선호 활동 제공"},
    {"step": 5, "action": "점진적으로 저선호 과제 비율 늘리기"}
  ]'::jsonb,
  '고선호 활동을 먼저 주면 이후 저선호 과제 거부 가능성 증가. 순서 엄수. 약속한 고선호 활동을 반드시 제공해야 신뢰 유지.',
  ARRAY['attention'],
  '가게의 자유시간권, 게임시간권이 프리맥 원리의 고선호 활동에 해당. "과제 완료 → 자유시간권 구매 가능" 구조로 자연스럽게 연계.',
  ARRAY['지적장애','자폐성장애','정서행동장애','발달지체'],
  ARRAY['BACB Task List 6th Ed. E-2', '국립특수교육원 PBS 실행 매뉴얼']
),

-- 소거
(
  '소거',
  'Extinction',
  'EXT',
  'differential_reinforcement',
  ARRAY['attention','escape','access'],
  'strong',
  'BACB Task List 6판 E-9, 반드시 DRA/DRI와 병행',
  '문제행동을 유지시켜온 강화를 중단하는 절차. 단독 사용은 비윤리적이며 반드시 대안행동 강화와 함께 사용.',
  '[
    {"step": 1, "action": "문제행동을 유지시킨 강화 정확히 파악(FBA 필수)"},
    {"step": 2, "action": "DRA/DRI/FCT 동시 계획 수립"},
    {"step": 3, "action": "안전 계획 수립(소거 폭발 대비)"},
    {"step": 4, "action": "보호자·관련 교사 모두에게 일관된 적용 협의"},
    {"step": 5, "action": "소거 폭발 발생 시 흔들리지 않고 일관성 유지"},
    {"step": 6, "action": "행동 감소 추세 확인 후 유지"}
  ]'::jsonb,
  '소거 폭발(행동이 일시적으로 증가, 강도 상승) 반드시 예상하고 안전 계획 수립. 자동적 강화 기능에는 소거 적용 불가. 일관성이 없으면 간헐적 강화로 행동 더 강해짐. 단독 사용 금지.',
  ARRAY['automatic'],
  '문제행동에 토큰 미지급이 소거의 일환. 시스템에서 소거 중단 감지 알림 기능 연계. 교사에게 소거 폭발 위험도 AI 분석 제공.',
  ARRAY['지적장애','자폐성장애','정서행동장애'],
  ARRAY['BACB Task List 6th Ed. E-9', '국립특수교육원 PBS 실행 매뉴얼', '한국행동분석학회 윤리강령']
),

-- 촉구 및 촉구 제거
(
  '촉구 및 촉구 제거',
  'Prompting and Prompt Fading',
  'PF',
  'antecedent',
  ARRAY['attention','escape','access','automatic'],
  'strong',
  'BACB Task List 6판 E-3',
  '목표 행동을 유발하기 위한 추가 자극(촉구)을 제공하고, 점진적으로 제거하여 독립적 수행을 이끄는 전략.',
  '[
    {"step": 1, "action": "필요한 촉구 유형 결정(신체/제스처/언어/시각)"},
    {"step": 2, "action": "가장 침습적이지 않은 수준부터 시작"},
    {"step": 3, "action": "촉구에 반응할 때 즉각 강화"},
    {"step": 4, "action": "점진적으로 촉구 강도 줄이기(최소촉구법 또는 점진적 안내 제거)"},
    {"step": 5, "action": "독립 수행 달성 시 가장 높은 수준의 강화"}
  ]'::jsonb,
  '촉구 의존성 생기지 않도록 계획적으로 제거. 촉구 제거가 너무 빠르면 실패 경험 반복. 신체적 촉구 사용 시 동의 및 안전 주의.',
  ARRAY[],
  '독립적 수행(촉구 없이) 시 더 높은 토큰 지급으로 촉구 제거 동기 강화 가능. PBS 목표행동에 "촉구 수준" 태그 추가 설계.',
  ARRAY['지적장애','자폐성장애','발달지체','지체장애'],
  ARRAY['BACB Task List 6th Ed. E-3', '국립특수교육원 PBS 실행 매뉴얼']
),

-- 과제분석
(
  '과제분석 및 연쇄',
  'Task Analysis and Chaining',
  'TA',
  'antecedent',
  ARRAY['escape','automatic'],
  'strong',
  'BACB Task List 6판 E-5',
  '복잡한 행동을 작은 단계로 나누고(과제분석), 각 단계를 순차적으로 가르치는 전략(연쇄). 일상생활기술, 직업기술 교육에 핵심.',
  '[
    {"step": 1, "action": "목표 행동을 구체적 단계로 분석(5~15단계)"},
    {"step": 2, "action": "전진연쇄/후진연쇄/전체과제제시 중 선택"},
    {"step": 3, "action": "각 단계 완료 시 강화 제공"},
    {"step": 4, "action": "숙달 기준 설정(3회 연속 독립 수행 등)"},
    {"step": 5, "action": "전체 과제 독립 수행 달성 시 대단위 강화"}
  ]'::jsonb,
  '단계 수가 너무 많으면 교수가 복잡해짐. 학생 수준에 맞게 단계 크기 조정. 중간 단계 건너뛰지 않기.',
  ARRAY['attention'],
  '각 단계 완료마다 소액 토큰 + 전체 완료 시 보너스 구조. 과제분석 단계가 PBS 체크 목록과 연동.',
  ARRAY['지적장애','자폐성장애','발달지체','지체장애'],
  ARRAY['BACB Task List 6th Ed. E-5', '국립특수교육원 일상생활기술 교수 매뉴얼']
),

-- 토큰경제 (시스템 자체가 이 전략)
(
  '토큰경제',
  'Token Economy',
  'TE',
  'differential_reinforcement',
  ARRAY['attention','escape','access'],
  'strong',
  'BACB Task List 6판 G-20, What Works Clearinghouse 강력 지지',
  '토큰(조건화된 강화제)을 행동 강화에 사용하고, 나중에 원하는 것(백업 강화제)과 교환하는 체계적 강화 시스템. 이 시스템 전체가 토큰경제.',
  '[
    {"step": 1, "action": "토큰 유형 결정(화폐, 스티커, 점수 등)"},
    {"step": 2, "action": "백업 강화제 목록 선정(선호도 평가 기반)"},
    {"step": 3, "action": "행동별 토큰 가치 설정"},
    {"step": 4, "action": "교환 규칙과 교환 시간 명확히 설정"},
    {"step": 5, "action": "토큰 즉각 제공 원칙 유지"},
    {"step": 6, "action": "점진적으로 토큰 지급 간격 늘리기(자연적 강화 전환 목표)"}
  ]'::jsonb,
  '토큰 인플레이션 주의(너무 쉽게 많이 주면 가치 하락). 백업 강화제가 충분히 매력적이어야 함. 장기적으로는 토큰 없이도 행동하도록 전환 계획 필요.',
  ARRAY['automatic'],
  '이 시스템 전체가 토큰경제. 화폐=토큰, 가게=백업강화제 교환 장소, 급여=토큰 획득 절차.',
  ARRAY['지적장애','자폐성장애','정서행동장애','학습장애'],
  ARRAY['BACB Task List 6th Ed. G-20', 'What Works Clearinghouse', '국립특수교육원 PBS 실행 매뉴얼 5장']
),

-- 상황이야기
(
  '사회적 상황 이야기',
  'Social Stories',
  'SS',
  'antecedent',
  ARRAY['attention','access','automatic'],
  'moderate',
  'What Works Clearinghouse 자폐성장애 중재 검토, 중간 수준 근거',
  '특정 사회적 상황을 학생의 관점에서 설명하는 짧은 이야기로, 적절한 사회적 행동을 학습하도록 돕는 전략. Carol Gray 개발.',
  '[
    {"step": 1, "action": "목표 상황과 행동 파악"},
    {"step": 2, "action": "학생 관점에서 상황 이야기 작성(서술:지시:관점 = 2:1:1 비율)"},
    {"step": 3, "action": "그림/사진/영상과 함께 제시"},
    {"step": 4, "action": "목표 상황 전에 읽기(예방적 사용)"},
    {"step": 5, "action": "이야기 속 행동 실천 시 강화"}
  ]'::jsonb,
  '지시 문장이 너무 많으면 효과 감소. 학생의 읽기 수준에 맞게 작성. 단독 사용보다 다른 전략과 병행 시 효과적.',
  ARRAY['escape'],
  '가게 구매 방법, 주식 매수 요청 방법 등 시스템 사용과 관련된 사회적 상황 이야기 제작에 활용.',
  ARRAY['자폐성장애','지적장애'],
  ARRAY['What Works Clearinghouse', '국립특수교육원 자폐성장애 교육 지원 가이드']
),

-- 비디오 모델링
(
  '비디오 모델링',
  'Video Modeling',
  'VM',
  'antecedent',
  ARRAY['attention','escape','access'],
  'strong',
  'What Works Clearinghouse 자폐성장애 강력 지지, BACB 근거기반 실제',
  '목표 행동을 수행하는 영상을 시청한 후 모방하도록 하는 전략. 자기 모델링(본인 성공 영상) 변형도 효과적.',
  '[
    {"step": 1, "action": "목표 행동 명확히 정의"},
    {"step": 2, "action": "모델 선정(또래/성인/학생 자신)"},
    {"step": 3, "action": "2~3분 이내 짧은 영상 제작"},
    {"step": 4, "action": "목표 상황 전 영상 시청"},
    {"step": 5, "action": "행동 실천 시 즉각 강화"}
  ]'::jsonb,
  '영상 길이가 길면 주의집중 어려움. 자기 모델링 영상은 성공 장면만 편집. 초상권 관련 보호자 동의 필수.',
  ARRAY['automatic'],
  '모바일뱅킹 앱 사용법, ATM 사용법 등을 비디오 모델링으로 교수하면 시스템 학습과 행동 교수를 동시에 달성.',
  ARRAY['자폐성장애','지적장애','발달지체'],
  ARRAY['What Works Clearinghouse', '국립특수교육원 자폐성장애 교육 지원 가이드']
);

-- ③ 기능-전략 매핑 테이블
CREATE TABLE IF NOT EXISTS function_intervention_map (
  function_type text NOT NULL,
  intervention_abbreviation text NOT NULL,
  priority int NOT NULL, -- 1=최우선, 2=차선, 3=보조
  rationale text,
  PRIMARY KEY (function_type, intervention_abbreviation)
);

INSERT INTO function_intervention_map 
  (function_type, intervention_abbreviation, priority, rationale)
VALUES
-- 관심 기능
('attention', 'FCT',    1, '관심 요청을 적절한 의사소통 행동으로 대체하는 가장 직접적 전략'),
('attention', 'DRA',    1, '적절한 대안행동에 관심 강화 제공'),
('attention', 'NCR',    2, '비수반 관심 제공으로 관심 박탈 상태 감소'),
('attention', 'DRI',    2, '문제행동과 동시 불가능한 행동에 관심 강화'),
('attention', 'GC',     3, '또래의 긍정적 관심을 활용한 집단수반성'),
('attention', 'BC',     3, '관심 요청 행동 계약서로 형식화'),
('attention', 'EXT',    2, '문제행동에 대한 관심 완전 차단(DRA와 반드시 병행)'),

-- 회피 기능
('escape', 'FCT',       1, '회피 요청을 적절한 의사소통으로 대체(쉬고 싶다/도움 요청)'),
('escape', 'TM-CM',     1, '과제 자체를 수정하여 회피 동기 원천 감소'),
('escape', 'DRO',       1, '일정 시간 회피 없이 과제 수행 시 강화'),
('escape', 'DRA',       2, '과제 완료 대안행동에 강화'),
('escape', 'PP',        2, '프리맥: 싫은 과제 완료 후 좋은 활동'),
('escape', 'TA',        2, '과제를 작은 단계로 분석하여 회피 동기 감소'),
('escape', 'BC',        3, '과제 수행 목표 계약서화'),
('escape', 'EXT',       2, '과제 제거라는 강화를 차단(TM-CM과 병행 필수)'),

-- 자동적 강화 기능
('automatic', 'NCR',    1, '동등하거나 더 강한 감각 자극 제공으로 대체'),
('automatic', 'DRA',    1, '감각적으로 유사한 대안행동에 강화'),
('automatic', 'DRI',    2, '감각 자극과 양립불가한 행동에 강화'),
('automatic', 'TM-CM',  2, '환경 수정으로 자극 수준 조절'),
('automatic', 'PF',     3, '대안 감각 행동 촉구 및 점진적 독립'),

-- 접근 기능
('access', 'FCT',       1, '원하는 것 적절히 요청하는 의사소통 훈련'),
('access', 'DRA',       1, '적절한 요청 행동에 원하는 것 제공'),
('access', 'NCR',       1, '비수반 접근 제공으로 박탈 상태 감소'),
('access', 'TE',        2, '토큰 획득 → 원하는 것 구매 구조로 접근 기능 체계화'),
('access', 'BC',        2, '원하는 것 획득 조건 계약서화'),
('access', 'PP',        2, '적절한 행동 완료 후 원하는 것 접근 허용'),
('access', 'EXT',       3, '문제행동으로 원하는 것 얻지 못하도록(FCT 병행 필수)');

-- ④ 소거 위험도 평가 기준 테이블
CREATE TABLE IF NOT EXISTS extinction_risk_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_type text NOT NULL,
  risk_level text NOT NULL, -- high / medium / low / not_applicable
  burst_likelihood text,
  safety_considerations text,
  recommended_preparation text[]
);

INSERT INTO extinction_risk_criteria
  (function_type, risk_level, burst_likelihood, safety_considerations, recommended_preparation)
VALUES
(
  'attention',
  'medium',
  '소거 폭발 가능성 중간. 행동 강도 및 빈도 일시 증가 예상.',
  '타인에게 해가 되는 행동(때리기, 물건 던지기) 여부 사전 확인 필요.',
  ARRAY[
    '소거 전 DRA 행동 충분히 확립',
    '반 전체 교사에게 일관성 교육',
    '보호자에게 소거 폭발 사전 안내',
    '소거 폭발 시 안전 계획 수립'
  ]
),
(
  'escape',
  'high',
  '소거 폭발 가능성 높음. 회피 욕구가 충족되지 않으면 행동 강도 급증 가능.',
  '자해, 공격 행동으로 이어질 수 있음. 반드시 TM-CM(과제수정) 병행.',
  ARRAY[
    '과제 수정으로 회피 동기 먼저 감소',
    'FCT를 통해 적절한 도움 요청/휴식 요청 확립 후 소거 시작',
    '안전한 환경 구성(위험 물건 제거)',
    '위기 대응 계획 수립 및 팀 공유'
  ]
),
(
  'automatic',
  'not_applicable',
  '자동적 강화 기능에 소거 적용 불가. 강화 원천이 내부적이므로 제거 불가.',
  '소거 시도 시 오히려 행동 악화 가능. 환경 수정 및 대안 자극 제공이 유일한 접근.',
  ARRAY[
    '소거 적용 금지',
    '감각 대체 자극 제공 우선',
    '환경 수정(자극 수준 조절)',
    '작업치료사 협의 권장'
  ]
),
(
  'access',
  'medium',
  '소거 폭발 가능성 중간. 원하는 것을 얻지 못할 때 행동 강도 증가.',
  '공격 행동 여부 확인. 비수반 강화로 박탈 상태 먼저 감소 필요.',
  ARRAY[
    '비수반 접근(NCE)으로 박탈 상태 감소',
    'FCT 충분히 확립 후 소거 시작',
    '소거 폭발 시 안전 계획',
    '원하는 것을 완전히 차단하지 말고 접근 조건만 변경'
  ]
);

-- ⑤ 윤리 가드레일 테이블
CREATE TABLE IF NOT EXISTS ethics_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  guideline_ko text NOT NULL,
  basis text,
  ai_prompt_rule text -- GPT 프롬프트에 직접 삽입될 규칙
);

INSERT INTO ethics_guidelines
  (category, guideline_ko, basis, ai_prompt_rule)
VALUES
(
  'general',
  'AI 제안은 보조적 도구이며 최종 판단은 반드시 교사가 한다.',
  '한국행동분석학회 윤리강령 2조',
  'All suggestions are advisory only. Final professional judgment belongs to the teacher. Always state this clearly.'
),
(
  'general',
  '근거 없는 제안을 하지 않는다. 불확실한 경우 "추가 관찰이 필요합니다"라고 명시한다.',
  'BACB 윤리강령 2.01',
  'Only make suggestions supported by the knowledge base. If uncertain, state "Additional observation is recommended" explicitly.'
),
(
  'extinction',
  '소거는 반드시 DRA/FCT와 병행하며 단독 적용을 제안하지 않는다.',
  'BACB 윤리강령 2.15, 한국행동분석학회 윤리강령',
  'Never recommend extinction alone. Always pair with DRA, DRI, or FCT. State this requirement explicitly in every extinction-related suggestion.'
),
(
  'punishment',
  '반응대가는 FBA 완료 후, 보호자 동의 후, 풍부한 강화 기회 병행 하에만 제안한다.',
  'BACB 윤리강령 2.15',
  'Only suggest response cost after FBA is completed, parental consent is documented, and rich reinforcement opportunities are in place. Flag all three requirements.'
),
(
  'automatic',
  '자동적 강화 기능에 소거 적용을 절대 제안하지 않는다.',
  'ABA 행동 원리, BACB Task List',
  'Never suggest extinction for automatically reinforced behaviors. Always recommend environmental modification and sensory alternatives instead.'
),
(
  'privacy',
  '학생 행동 데이터는 교육 목적으로만 사용되며 외부 공유 시 보호자 동의가 필요하다.',
  '개인정보보호법, 특수교육법',
  'Student behavioral data is for educational purposes only. Always remind teachers that sharing data externally requires parental consent.'
),
(
  'safety',
  '자해 또는 타해 위험이 있는 행동 중재 시 전문가 팀 협의를 권장한다.',
  'BACB 윤리강령 2.02',
  'When behaviors involve self-injury or aggression risk, always recommend team consultation with specialists (behavior analyst, school psychologist).'
);

