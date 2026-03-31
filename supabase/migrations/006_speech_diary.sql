-- ============================================================
-- PBS 말 일기장 이식
-- tool_5 -> PBS
-- 기준 프로젝트: public 스키마 / pbs_ 접두사
-- ============================================================

CREATE TABLE IF NOT EXISTS pbs_speech_diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES pbs_students(id) ON DELETE CASCADE,
  raw_transcript text,
  corrected_text text,
  audio_url text,
  image_url text,
  sentiment text CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  keywords text[],
  teacher_note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pbs_speech_diaries_student_id
  ON pbs_speech_diaries (student_id);

CREATE INDEX IF NOT EXISTS idx_pbs_speech_diaries_created_at
  ON pbs_speech_diaries (created_at DESC);

CREATE TABLE IF NOT EXISTS pbs_speech_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code_id uuid NOT NULL REFERENCES pbs_class_codes(id) ON DELETE CASCADE,
  date date NOT NULL,
  lunch_menu text,
  event text,
  memo text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_code_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pbs_speech_context_class_date
  ON pbs_speech_context (class_code_id, date DESC);

-- ============================================================
-- 기존 tool_5 데이터 이전
-- 이름이 유일하게 매칭되는 학생만 자동 이전
-- 중복 이름 학생은 잘못 매핑될 수 있어 자동 이전에서 제외
-- ============================================================

WITH normalized_students AS (
  SELECT
    lower(regexp_replace(trim(name), '\s+', '', 'g')) AS normalized_name,
    (array_agg(id ORDER BY created_at ASC))[1] AS student_id,
    (array_agg(class_code_id ORDER BY created_at ASC))[1] AS class_code_id,
    count(*) AS student_count
  FROM pbs_students
  GROUP BY 1
),
matched_profiles AS (
  SELECT
    p.id AS profile_id,
    p.name AS profile_name,
    s.student_id,
    s.class_code_id
  FROM tool5_profiles p
  JOIN normalized_students s
    ON lower(regexp_replace(trim(p.name), '\s+', '', 'g')) = s.normalized_name
  WHERE s.student_count = 1
)
INSERT INTO pbs_speech_diaries (
  id,
  student_id,
  raw_transcript,
  corrected_text,
  audio_url,
  image_url,
  sentiment,
  keywords,
  teacher_note,
  created_at
)
SELECT
  d.id,
  mp.student_id,
  d.raw_transcript,
  d.corrected_text,
  d.audio_url,
  d.image_url,
  d.sentiment,
  d.keywords,
  d.teacher_note,
  d.created_at
FROM tool5_diaries d
JOIN matched_profiles mp
  ON mp.profile_id = d.profile_id
ON CONFLICT (id) DO NOTHING;

WITH normalized_students AS (
  SELECT
    lower(regexp_replace(trim(name), '\s+', '', 'g')) AS normalized_name,
    (array_agg(id ORDER BY created_at ASC))[1] AS student_id,
    (array_agg(class_code_id ORDER BY created_at ASC))[1] AS class_code_id,
    count(*) AS student_count
  FROM pbs_students
  GROUP BY 1
),
matched_profiles AS (
  SELECT
    p.id AS profile_id,
    s.class_code_id
  FROM tool5_profiles p
  JOIN normalized_students s
    ON lower(regexp_replace(trim(p.name), '\s+', '', 'g')) = s.normalized_name
  WHERE s.student_count = 1
),
single_target_class AS (
  SELECT class_code_id
  FROM matched_profiles
  GROUP BY class_code_id
  HAVING count(*) = (SELECT count(*) FROM matched_profiles)
)
INSERT INTO pbs_speech_context (
  class_code_id,
  date,
  lunch_menu,
  event,
  memo,
  created_at
)
SELECT
  stc.class_code_id,
  c.date,
  c.lunch_menu,
  c.event,
  c.memo,
  c.created_at
FROM tool5_school_context c
CROSS JOIN single_target_class stc
ON CONFLICT (class_code_id, date) DO UPDATE
SET
  lunch_menu = EXCLUDED.lunch_menu,
  event = EXCLUDED.event,
  memo = EXCLUDED.memo;
