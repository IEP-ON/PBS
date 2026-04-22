ALTER TABLE pbs_speech_diaries
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS ended_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pbs_speech_diaries_ended_by_check'
  ) THEN
    ALTER TABLE pbs_speech_diaries
      ADD CONSTRAINT pbs_speech_diaries_ended_by_check
      CHECK (ended_by IN ('student', 'timeout', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pbs_speech_diaries_ended_by
  ON pbs_speech_diaries (ended_by);

COMMENT ON COLUMN pbs_speech_diaries.duration_seconds IS '학생 말 일기 녹음 길이(초)';
COMMENT ON COLUMN pbs_speech_diaries.ended_by IS '학생 종료, 안전 상한 종료, 오류 종료 여부';
