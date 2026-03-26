/**
 * end-to-end AI 플로우 검증 (사용자 시점)
 * 흐름: 교사 로그인 → parse-behavior → behavior-plan (DB 컨텍스트) → 저장 → 피드백 → 로그 확인
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim()
  })
} catch {}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const BASE        = 'http://localhost:3000'
const CLASS_CODE  = 'TST-2026-002'
const PIN         = '1234'
const STUDENT_ID  = 'feed3478-f5c2-4c8b-8586-ba2810cf17c6'
const STUDENT_NAME = '이민수'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

let cookieJar = ''

async function api(path, body, method = 'POST') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieJar ? { Cookie: cookieJar } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookieJar = setCookie.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

function pass(msg) { console.log(`  ✅ ${msg}`) }
function fail(msg) { console.log(`  ❌ ${msg}`); process.exitCode = 1 }
function info(msg) { console.log(`  ℹ️  ${msg}`) }

async function run() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  사용자 시점 end-to-end AI 플로우 검증')
  console.log('══════════════════════════════════════════════\n')

  // ── STEP 1: 교사 로그인 ──────────────────────────
  console.log('🔐 Step 1: 교사 로그인')
  const login = await api('/api/auth/teacher', { classCode: CLASS_CODE, teacherPin: PIN })
  if (login.status === 200) pass(`로그인 성공 (${CLASS_CODE})`)
  else { fail(`로그인 실패 status=${login.status} — ${JSON.stringify(login.data)}`); return }

  // ── STEP 2: 자유 입력 분배 (parse-behavior + DB) ──
  console.log('\n📝 Step 2: 자유 입력 → ABC 자동 분배 (parse-behavior API + DB)')
  const freeText = `지적장애 경도인 4학년 이민수는 수학 시간에 자리를 이탈하는 행동이 하루 4~6회 정도 있습니다.
어려운 과제가 주어지면 바로 자리를 이탈하고 교실 뒤편을 돌아다닙니다.
제가 가서 데려오면 잠시 앉아 있다가 또 일어납니다. 통합학급 22명이고 보조교사는 없습니다.
단어 수준 의사소통이 가능하고 숫자는 5까지 인식합니다.`

  const parse = await api('/api/ai/parse-behavior', { freeText, studentName: STUDENT_NAME, grade: 4 })
  if (parse.status === 200 && parse.data.parsed) {
    const p = parse.data.parsed
    pass('parse-behavior 성공')
    info(`현행수준: ${p.currentLevel?.slice(0, 40)}...`)
    info(`표적행동: ${p.targetBehavior?.slice(0, 50)}...`)
    info(`선행사건: ${p.antecedents?.slice(0, 40)}...`)
    info(`결과사건: ${p.consequences?.slice(0, 40)}...`)
    // DB detection_signals가 프롬프트에 주입됐는지 간접 확인 (escape 관련 내용 포함 여부)
    const hasEscapeSignal = ['회피','도피','과제','어렵'].some(w =>
      (p.antecedents || '').includes(w) || (p.consequences || '').includes(w)
    )
    hasEscapeSignal
      ? pass('escape 기능 탐지 신호 반영 확인 (DB detection_signals 주입 정상)')
      : info('escape 탐지 신호 명시적 반영 미확인 (AI 판단에 따라 정상일 수 있음)')
  } else {
    fail(`parse-behavior 실패 status=${parse.status} — ${JSON.stringify(parse.data)}`)
    return
  }

  const { currentLevel, targetBehavior, antecedents, consequences, environment } = parse.data.parsed

  // ── STEP 3: AI 행동 지원 계획 생성 (DB 컨텍스트 주입) ──
  console.log('\n🤖 Step 3: AI 행동 지원 계획 생성 (behavior-plan API + DB)')
  const logCountBefore = await supabase
    .from('pbs_ai_generation_log').select('*', { count: 'exact', head: true })
    .then(r => r.count ?? 0)

  const gen = await api('/api/ai/behavior-plan', {
    studentName: STUDENT_NAME,
    grade: 4,
    currentLevel,
    targetBehavior,
    antecedents,
    consequences,
    environment,
    studentId: STUDENT_ID,
  })

  if (gen.status !== 200 || !gen.data.plan) {
    fail(`behavior-plan 실패 status=${gen.status} — ${JSON.stringify(gen.data)}`)
    return
  }

  const { plan, logId } = gen.data
  pass('behavior-plan 생성 성공')
  logId ? pass(`logId 반환됨: ${logId}`) : fail('logId 미반환')

  // 계획 품질 검증
  const fba = plan.fba
  info(`FBA 추정 기능: ${fba?.estimatedFunction} (신뢰도: ${fba?.confidence})`)
  fba?.estimatedFunction === 'escape'
    ? pass('FBA 기능 = escape (DB 매핑과 일치)')
    : info(`FBA 기능 = ${fba?.estimatedFunction} (DB 기준 escape 예상, AI 판단 허용)`)

  const goalCount = plan.pbsGoals?.length ?? 0
  goalCount >= 2 ? pass(`PBS 목표 ${goalCount}개 (최소 2개 기준 충족)`) : fail(`PBS 목표 ${goalCount}개 — 최소 2개 필요`)

  const ivCount = plan.interventions?.length ?? 0
  ivCount >= 2 ? pass(`중재전략 ${ivCount}개 (최소 2개 기준 충족)`) : fail(`중재전략 ${ivCount}개 — 최소 2개 필요`)

  const token = plan.pbsGoals?.[0]?.tokenPerOccurrence
  token >= 100 && token <= 500
    ? pass(`토큰 단가 ${token}원 (100~500원 범위 정상)`)
    : fail(`토큰 단가 ${token}원 — 범위 이탈`)

  const reward = plan.contract?.rewardAmount
  reward >= 1000 && reward <= 5000
    ? pass(`보상금액 ${reward}원 (1000~5000원 범위 정상)`)
    : fail(`보상금액 ${reward}원 — 범위 이탈`)

  const dro = plan.dro?.intervalMinutes
  dro > 0 ? pass(`DRO 간격 ${dro}분 (Repp & Dietz 원칙 적용)`) : fail('DRO 간격 없음')

  // 소거 금지 규칙 (sensory면 EXT 전략 없어야 함)
  if (fba?.estimatedFunction === 'sensory') {
    const hasExt = plan.interventions?.some(iv =>
      iv.strategyName?.includes('소거') || iv.strategyName?.includes('EXT')
    )
    !hasExt ? pass('sensory 기능 → 소거 전략 없음 (윤리 규칙 준수)') : fail('sensory 기능인데 소거 전략 포함 — 윤리 위반')
  }

  // DB 전략 목록 반영 여부 확인
  const { data: dbStrats } = await supabase
    .from('pbs_intervention_library').select('name_ko,abbreviation')
  const dbStratNames = new Set([
    ...(dbStrats?.map(s => s.name_ko) ?? []),
    ...(dbStrats?.map(s => s.abbreviation) ?? []),
  ])
  const matched = plan.interventions?.filter(iv =>
    dbStratNames.has(iv.strategyName) ||
    Array.from(dbStratNames).some(n => iv.strategyName?.includes(n) || iv.description?.includes(n))
  )
  matched?.length > 0
    ? pass(`중재전략 ${matched.length}개가 DB 전략과 매칭 (DB 컨텍스트 주입 효과 확인)`)
    : info('중재전략 DB 직접 매칭 없음 (AI가 동의어로 표현했을 수 있음)')

  // ── STEP 4: pbs_ai_generation_log 확인 ──
  console.log('\n📊 Step 4: pbs_ai_generation_log 저장 확인')
  const logCountAfter = await supabase
    .from('pbs_ai_generation_log').select('*', { count: 'exact', head: true })
    .then(r => r.count ?? 0)

  logCountAfter > logCountBefore
    ? pass(`로그 저장 확인 (${logCountBefore} → ${logCountAfter}행)`)
    : fail('로그 미저장')

  if (logId) {
    const { data: logRow } = await supabase
      .from('pbs_ai_generation_log').select('*').eq('id', logId).single()
    logRow?.estimated_function
      ? pass(`estimated_function = "${logRow.estimated_function}" 저장됨`)
      : fail('estimated_function 미저장')
    logRow?.student_id === STUDENT_ID
      ? pass('student_id 정상 연결')
      : fail(`student_id 불일치: ${logRow?.student_id}`)
  }

  // ── STEP 5: 피드백 API 검증 ──
  console.log('\n🔄 Step 5: 피드백 루프 (교사가 계획 수정 후 저장)')
  if (!logId) { fail('logId 없어 피드백 테스트 불가'); return }

  // 교사가 토큰 값 수정 (수정 있음 시뮬레이션)
  const modifiedPlan = JSON.parse(JSON.stringify(plan))
  if (modifiedPlan.pbsGoals?.[0]) modifiedPlan.pbsGoals[0].tokenPerOccurrence = 300

  const feedback = await api('/api/ai/behavior-plan-feedback', {
    logId,
    accepted: true,
    teacherModified: true,
    finalSaved: modifiedPlan,
    teacherFeedback: 'e2e 자동 테스트 — 토큰 300원으로 수정',
  })
  feedback.status === 200
    ? pass('피드백 API 성공')
    : fail(`피드백 실패 status=${feedback.status} — ${JSON.stringify(feedback.data)}`)

  // DB에서 업데이트 확인
  const { data: updatedLog } = await supabase
    .from('pbs_ai_generation_log').select('teacher_modified,accepted,teacher_feedback').eq('id', logId).single()
  updatedLog?.teacher_modified === true ? pass('teacher_modified = true 저장됨') : fail('teacher_modified 미업데이트')
  updatedLog?.accepted === true ? pass('accepted = true 저장됨') : fail('accepted 미업데이트')

  // ── STEP 6: 전체 DB 최종 상태 확인 ──
  console.log('\n📈 Step 6: 최종 DB 상태')
  const { count: totalLogs } = await supabase
    .from('pbs_ai_generation_log').select('*', { count: 'exact', head: true })
  info(`pbs_ai_generation_log 총 ${totalLogs}행`)
  const { count: acceptedLogs } = await supabase
    .from('pbs_ai_generation_log').select('*', { count: 'exact', head: true }).eq('accepted', true)
  info(`accepted=true: ${acceptedLogs}행`)
  const { count: modifiedLogs } = await supabase
    .from('pbs_ai_generation_log').select('*', { count: 'exact', head: true }).eq('teacher_modified', true)
  info(`teacher_modified=true: ${modifiedLogs}행`)

  const exitOk = process.exitCode !== 1
  console.log('\n══════════════════════════════════════════════')
  console.log(exitOk
    ? '  ✅ 전체 e2e 검증 통과 — 배포 진행 가능'
    : '  ❌ 일부 검증 실패 — 위 오류 확인 필요')
  console.log('══════════════════════════════════════════════\n')
}

run().catch(e => { console.error(e); process.exit(1) })
