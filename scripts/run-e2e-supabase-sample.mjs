/**
 * Supabase에서 NDG-2026-003 제외 학급 1개를 골라,
 * 교사/학생 PIN 해시를 임시 값으로 바꾼 뒤 Playwright E2E를 실행하고 원복합니다.
 *
 * 사용: node scripts/run-e2e-supabase-sample.mjs
 * 요구: 프로젝트 루트의 .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const env = {}
  try {
    readFileSync(join(repoRoot, '.env.local'), 'utf8').split('\n').forEach((line) => {
      const t = line.trim()
      if (!t || t.startsWith('#')) return
      const eq = t.indexOf('=')
      if (eq === -1) return
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim()
      env[k] = v
    })
  } catch (e) {
    console.error('❌ .env.local 을 읽을 수 없습니다.', e.message)
    process.exit(1)
  }
  return env
}

const TEMP_PIN = '8421'

async function main() {
  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: classRow, error: classErr } = await supabase
    .from('pbs_class_codes')
    .select('id, code, teacher_pin_hash')
    .neq('code', 'NDG-2026-003')
    .eq('is_active', true)
    .order('code', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (classErr || !classRow) {
    console.error('❌ NDG-2026-003 이외의 활성 학급을 찾지 못했습니다.', classErr?.message)
    process.exit(1)
  }

  const { data: student, error: stuErr } = await supabase
    .from('pbs_students')
    .select('id, name, pin_hash')
    .eq('class_code_id', classRow.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (stuErr || !student) {
    console.error('❌ 해당 학급에 활성 학생이 없어 학생 E2E를 건너뜁니다.', stuErr?.message)
    process.exit(1)
  }

  const teacherBackup = classRow.teacher_pin_hash
  const studentBackup = student.pin_hash
  const tempHash = bcrypt.hashSync(TEMP_PIN, 10)

  console.log(`\n📌 대상 학급: ${classRow.code} (NDG-2026-003 제외)`)
  console.log(`📌 임시 PIN: ${TEMP_PIN} (실행 후 원복)\n`)

  const { error: u1 } = await supabase
    .from('pbs_class_codes')
    .update({ teacher_pin_hash: tempHash })
    .eq('id', classRow.id)
  if (u1) {
    console.error('❌ 교사 PIN 해시 임시 변경 실패', u1.message)
    process.exit(1)
  }

  const { error: u2 } = await supabase
    .from('pbs_students')
    .update({ pin_hash: tempHash })
    .eq('id', student.id)
  if (u2) {
    console.error('❌ 학생 PIN 해시 임시 변경 실패 — 교사 해시 원복 시도', u2.message)
    await supabase.from('pbs_class_codes').update({ teacher_pin_hash: teacherBackup }).eq('id', classRow.id)
    process.exit(1)
  }

  const e2eEnv = {
    ...process.env,
    E2E_CLASS_CODE: classRow.code,
    E2E_TEACHER_PIN: TEMP_PIN,
    E2E_STUDENT_NAME: student.name,
    E2E_STUDENT_PIN: TEMP_PIN,
  }

  try {
    console.log('▶️  npm run test:e2e\n')
    execSync('npm run test:e2e', { stdio: 'inherit', env: e2eEnv, cwd: repoRoot })
  } finally {
    const { error: r1 } = await supabase
      .from('pbs_class_codes')
      .update({ teacher_pin_hash: teacherBackup })
      .eq('id', classRow.id)
    const { error: r2 } = await supabase
      .from('pbs_students')
      .update({ pin_hash: studentBackup })
      .eq('id', student.id)
    if (r1 || r2) {
      console.error('\n⚠️  원복 실패 — 수동으로 확인하세요.', r1?.message, r2?.message)
      process.exit(1)
    }
    console.log('\n✅ 교사·학생 PIN 해시 원복 완료\n')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
