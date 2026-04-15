ALTER TABLE pbs_student_ai_profiles
  ADD COLUMN IF NOT EXISTS public_cue jsonb;

COMMENT ON COLUMN pbs_student_ai_profiles.public_cue IS
  '학생 채널 공용 PTR 문구. 동적 진행률/잔액은 저장하지 않음.';

CREATE INDEX IF NOT EXISTS idx_pbs_student_ai_profiles_public_cue
  ON pbs_student_ai_profiles USING gin (public_cue);

ALTER TABLE pbs_system_settings
  ADD COLUMN IF NOT EXISTS tv_settings jsonb NOT NULL
  DEFAULT '{"anonymizeName": false, "showTicker": true}'::jsonb;

COMMENT ON COLUMN pbs_system_settings.tv_settings IS
  'TV 표시 설정. anonymizeName과 showTicker를 포함한다.';
