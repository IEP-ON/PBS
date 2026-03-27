-- ============================================================
-- Migration 004: pbs_function_intervention_map 기능별 전략 우선순위 매핑
-- 행동 기능 4가지 × 전략 우선순위 1~3
-- 출처: Cooper et al. (2020) ABA 3판; Sugai & Horner (2002) PBIS
-- ============================================================

INSERT INTO pbs_function_intervention_map
  (function_type, intervention_abbreviation, priority, rationale)
VALUES

-- ─── attention (주의 추구) ──────────────────────────────────
('attention', 'FCT',     1, 'Carr & Durand(1985): 주의 추구 행동의 최우선 대안 — 적절한 방식으로 주의 요청하기 훈련'),
('attention', 'DRO',     2, 'Repp & Dietz(1974): 주의 비발생 간격 동안 주의를 contingent하게 제공'),
('attention', 'NCR',     2, 'Vollmer(1993): 정해진 간격마다 선행 주의 제공으로 EO 약화'),
('attention', 'DRA',     3, '적절한 주의 요청 행동(손 들기, 말 걸기)에 선택적 강화'),
('attention', 'BC',      3, '주의 요청 규칙을 계약서로 명문화하여 자기관리 촉진'),

-- ─── escape (회피/도피) ─────────────────────────────────────
('escape',    'FCT',     1, 'Carr & Durand(1985): 회피 기능 행동의 최우선 — 도움 요청·휴식 요구 의사소통 훈련'),
('escape',    'Shaping', 1, '요구 수준 점진적 증가(Graduated Exposure)로 회피 동기 감소'),
('escape',    'NCR',     2, '예정 휴식 제공으로 회피 EO 선제 제거'),
('escape',    'DRA',     2, '과제 중 적절한 휴식 요청 행동에 강화'),
('escape',    'DRO',     3, '회피 행동 비발생 간격에 조건부 선호 활동 제공'),

-- ─── sensory (감각 자극) ────────────────────────────────────
('sensory',   'NCR',     1, 'Vollmer(1993): 감각 기능 행동에 소거 불가 — 대안 감각 자극을 정기적으로 선제 제공'),
('sensory',   'DRI',     1, '표적 감각 자극과 유사하되 안전한 대안 행동(예: 감각 완구 조작) 강화'),
('sensory',   'Shaping', 2, '환경 수정 + 대안 감각 자극 점진적 도입'),
('sensory',   'DRO',     3, '자극이 없는 시간에 다른 기능적 활동 참여 강화'),

-- ─── tangible (물건/활동 획득) ──────────────────────────────
('tangible',  'FCT',     1, '원하는 물건·활동을 적절하게 요청하는 의사소통 훈련'),
('tangible',  'DRO',     2, '미발생 간격 후 원하는 물건 조건부 제공'),
('tangible',  'DRA',     2, '대기하기, 교환하기 등 대안 행동에 물건 제공'),
('tangible',  'DRL',     3, '요구 빈도 점진적 감소 기준 달성 시 강화'),
('tangible',  'BC',      3, '원하는 물건 획득 규칙을 계약서로 명문화')
ON CONFLICT (function_type, intervention_abbreviation) DO NOTHING;
