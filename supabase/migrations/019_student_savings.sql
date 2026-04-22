-- 학생 저축 잔액 (뱅킹앱 확장용)
CREATE TABLE IF NOT EXISTS pbs_student_savings (
  student_id uuid PRIMARY KEY REFERENCES pbs_students(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
