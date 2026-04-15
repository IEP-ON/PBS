/**
 * 010_seed_starter_goals_and_shop_floor.sql 과 동일한 효과를
 * Supabase JS(서비스 롤)로 원격 DB에 적용합니다.
 *
 * 사용: node scripts/apply-010-seed-remote.mjs
 * 요구: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

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
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[k] = v
    })
  } catch (e) {
    console.error('❌ .env.local 을 읽을 수 없습니다.', e.message)
    process.exit(1)
  }
  return env
}

const SEED_GOALS = [
  {
    behavior_name: '수업에 참여하기',
    behavior_definition: '선생님 지시에 따라 수업 활동에 차례로 참여한다.',
    token_per_occurrence: 50,
    daily_target: 5,
    allow_self_check: true,
  },
  {
    behavior_name: '예의 있게 소통하기',
    behavior_definition: '눈을 보며 차분한 목소리로 말한다.',
    token_per_occurrence: 40,
    daily_target: 4,
    allow_self_check: true,
  },
]

async function main() {
  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: students, error: stErr } = await supabase
    .from('pbs_students')
    .select('id, class_code_id, is_active')

  if (stErr) {
    console.error('❌ 학생 조회 실패:', stErr.message)
    process.exit(1)
  }

  const activeStudents = (students || []).filter(
    (s) => s.class_code_id && s.is_active !== false,
  )

  const { data: activeGoals, error: gErr } = await supabase
    .from('pbs_goals')
    .select('student_id')
    .eq('is_active', true)

  if (gErr) {
    console.error('❌ 목표 조회 실패:', gErr.message)
    process.exit(1)
  }

  const withGoals = new Set((activeGoals || []).map((r) => r.student_id))
  const needSeed = activeStudents.filter((s) => !withGoals.has(s.id))

  let inserted = 0
  for (const s of needSeed) {
    const rows = SEED_GOALS.map((g) => ({
      student_id: s.id,
      class_code_id: s.class_code_id,
      behavior_name: g.behavior_name,
      behavior_definition: g.behavior_definition,
      token_per_occurrence: g.token_per_occurrence,
      daily_target: g.daily_target,
      allow_self_check: g.allow_self_check,
      is_active: true,
      is_dro: false,
      is_drl: false,
    }))
    const { error: insErr } = await supabase.from('pbs_goals').insert(rows)
    if (insErr) {
      console.error(`❌ 목표 삽입 실패 (${s.id}):`, insErr.message)
      process.exit(1)
    }
    inserted += rows.length
  }

  const { data: cheapItems, error: chErr } = await supabase
    .from('pbs_shop_items')
    .select('id, price, name')
    .eq('is_active', true)
    .gt('price', 0)
    .lt('price', 100)

  if (chErr) {
    console.error('❌ 가게 조회 실패:', chErr.message)
    process.exit(1)
  }

  let shopUpdated = 0
  for (const item of cheapItems || []) {
    const { error: upErr } = await supabase
      .from('pbs_shop_items')
      .update({ price: 200 })
      .eq('id', item.id)
    if (upErr) {
      console.error(`❌ 가게 가격 수정 실패 (${item.id}):`, upErr.message)
      process.exit(1)
    }
    shopUpdated += 1
    console.log(`   가게: "${item.name}" ${item.price} → 200`)
  }

  console.log('✅ 010 시드 적용 완료')
  console.log(`   행동 목표 삽입: ${inserted}행 (${needSeed.length}명 학생)`)
  console.log(`   가게 가격 조정: ${shopUpdated}건`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
