CREATE TABLE IF NOT EXISTS pbs_student_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES pbs_students(id) ON DELETE CASCADE,
  class_code_id uuid NOT NULL REFERENCES pbs_class_codes(id) ON DELETE CASCADE,
  source_free_text text,
  current_level_summary text,
  strengths text[] DEFAULT '{}',
  preferences text[] DEFAULT '{}',
  student_voice_keywords text[] DEFAULT '{}',
  support_needs text[] DEFAULT '{}',
  risk_flags text[] DEFAULT '{}',
  observable_behaviors text[] DEFAULT '{}',
  antecedent_patterns text[] DEFAULT '{}',
  consequence_patterns text[] DEFAULT '{}',
  hypothesized_functions text[] DEFAULT '{}',
  replacement_behaviors text[] DEFAULT '{}',
  positive_target_behaviors text[] DEFAULT '{}',
  prevention_supports text[] DEFAULT '{}',
  reinforcement_preferences text[] DEFAULT '{}',
  incident_tags text[] DEFAULT '{}',
  class_mode_targets text[] DEFAULT '{}',
  p_prompt_options text[] DEFAULT '{}',
  dro_candidate text,
  student_registration_summary text,
  ai_plan_one_liner text,
  public_safe_summary text,
  private_teacher_notes text,
  teacher_verified boolean NOT NULL DEFAULT false,
  generated_follow_up_questions jsonb DEFAULT '[]'::jsonb,
  confidence_by_field jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pbs_student_ai_profiles_class_code_idx
  ON pbs_student_ai_profiles (class_code_id);

CREATE OR REPLACE FUNCTION set_pbs_student_ai_profiles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pbs_student_ai_profiles_updated_at
  ON pbs_student_ai_profiles;

CREATE TRIGGER trg_pbs_student_ai_profiles_updated_at
BEFORE UPDATE ON pbs_student_ai_profiles
FOR EACH ROW
EXECUTE FUNCTION set_pbs_student_ai_profiles_updated_at();
