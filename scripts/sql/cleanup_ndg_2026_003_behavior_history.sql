-- =============================================================================
-- 학급 ndg-2026-003 — 행동·중재 "과거 기록" 일괄 삭제
--
-- 유지: 말 일기장(pbs_speech_diaries), 학급 말 일기 맥락(pbs_speech_context),
--       학생 AI 프로필(pbs_student_ai_profiles), PBS 목표(pbs_goals),
--       계좌·거래·주식·학생 행
--
-- 삭제: PBS 체크 기록, FBA 기록, DRO 타이머, 소거 경보, 행동계약(+버전),
--       AI 계획 생성 로그(해당 학생), 선호도 평가 이력
--
-- 실행: Supabase → SQL Editor → 붙여넣기 → Run
--       실행 전 프로젝트 백업 권장.
-- =============================================================================

DO $$
DECLARE
  class_id uuid;
  student_ids uuid[];
  n_students int;
BEGIN
  SELECT c.id
  INTO class_id
  FROM pbs_class_codes c
  WHERE upper(replace(trim(c.code), ' ', '')) = upper(replace(trim('ndg-2026-003'), ' ', ''))
  LIMIT 1;

  IF class_id IS NULL THEN
    RAISE EXCEPTION '학급 코드 ndg-2026-003 에 해당하는 pbs_class_codes 행이 없습니다.';
  END IF;

  SELECT array_agg(s.id), count(*)::int
  INTO student_ids, n_students
  FROM pbs_students s
  WHERE s.class_code_id = class_id;

  IF student_ids IS NULL OR cardinality(student_ids) = 0 THEN
    RAISE NOTICE '해당 학급에 학생이 없습니다. 종료합니다.';
    RETURN;
  END IF;

  RAISE NOTICE 'class_id=%, 학생 수=%', class_id, n_students;

  -- 계약 버전 → 계약 (FK 순서)
  DELETE FROM pbs_contract_versions v
  USING pbs_behavior_contracts bc
  WHERE v.contract_id = bc.id
    AND bc.student_id = ANY (student_ids);

  DELETE FROM pbs_behavior_contracts bc
  WHERE bc.student_id = ANY (student_ids);

  -- 목표에 매달린 이력 (목표 행은 유지)
  DELETE FROM pbs_records r
  WHERE r.student_id = ANY (student_ids);

  DELETE FROM pbs_dro_timers t
  WHERE t.student_id = ANY (student_ids);

  DELETE FROM pbs_extinction_alerts a
  WHERE a.student_id = ANY (student_ids);

  DELETE FROM pbs_fba_records f
  WHERE f.student_id = ANY (student_ids);

  DELETE FROM pbs_ai_generation_log g
  WHERE g.student_id = ANY (student_ids);

  -- 마이그레이션 013 이후에만 존재
  IF to_regclass('public.pbs_preference_assessments') IS NOT NULL THEN
    DELETE FROM pbs_preference_assessments p
    WHERE p.student_id = ANY (student_ids);
  END IF;

  RAISE NOTICE '삭제 완료 (말 일기장·AI 프로필·목표·거래는 유지).';
END $$;

-- -----------------------------------------------------------------------------
-- (선택) PBS 행동 목표까지 비우려면 아래 블록 주석을 해제한 뒤 다시 실행.
--       위 블록 실행 후, 목표에 남은 참조가 없어야 안전합니다.
-- -----------------------------------------------------------------------------
-- DO $$
-- DECLARE
--   class_id uuid;
--   student_ids uuid[];
-- BEGIN
--   SELECT id INTO class_id FROM pbs_class_codes
--   WHERE upper(replace(trim(code), ' ', '')) = upper(replace(trim('ndg-2026-003'), ' ', '')) LIMIT 1;
--   SELECT array_agg(id) INTO student_ids FROM pbs_students WHERE class_code_id = class_id;
--   DELETE FROM pbs_goals g WHERE g.student_id = ANY (student_ids);
-- END $$;
