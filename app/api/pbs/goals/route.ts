import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

const BEHAVIOR_FUNCTIONS = ['attention', 'escape', 'sensory', 'tangible'] as const

/** 1 이상 정수만 허용. 빈 값은 null (= 필드 생략과 동일) */
function parseOptionalPositiveInt(value: unknown, max: number): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) return null
  const i = Math.floor(n)
  if (i < 1) return null
  return Math.min(max, i)
}

function normalizeBehaviorFunction(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return (BEHAVIOR_FUNCTIONS as readonly string[]).includes(v) ? v : null
}

// GET /api/pbs/goals — 행동 목표 목록
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    const supabase = await createServerSupabase()

    let query = supabase
      .from('pbs_goals')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: '행동 목표 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ goals: data || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/pbs/goals — 행동 목표 등록
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      studentId, behaviorName, behaviorDefinition, behaviorFunction,
      strategyType, tokenPerOccurrence, dailyTarget, weeklyTarget,
      isDro, droIntervalMinutes, isNcr, ncrIntervalMinutes, isDrl, drlMaxPerWeek, allowSelfCheck,
    } = body

    if (!studentId || typeof behaviorName !== 'string' || !String(behaviorName).trim()) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
    }

    const tokenInt = parseOptionalPositiveInt(tokenPerOccurrence, 1_000_000)
    if (tokenInt === null) {
      return NextResponse.json({ error: '토큰(원)은 1 이상의 숫자로 입력해주세요.' }, { status: 400 })
    }

    const dailyTargetInt = parseOptionalPositiveInt(dailyTarget, 30)
    if (
      dailyTarget !== undefined &&
      dailyTarget !== null &&
      dailyTarget !== '' &&
      dailyTargetInt === null
    ) {
      return NextResponse.json(
        { error: '하루 목표 횟수는 1~30 사이 숫자로 입력해주세요.' },
        { status: 400 }
      )
    }

    const weeklyTargetInt = parseOptionalPositiveInt(weeklyTarget, 10_000)
    if (
      weeklyTarget !== undefined &&
      weeklyTarget !== null &&
      weeklyTarget !== '' &&
      weeklyTargetInt === null
    ) {
      return NextResponse.json(
        { error: '주간 목표는 1 이상의 숫자로 입력해주세요.' },
        { status: 400 }
      )
    }

    const drlMaxInt = parseOptionalPositiveInt(drlMaxPerWeek, 10_000)
    if (
      drlMaxPerWeek !== undefined &&
      drlMaxPerWeek !== null &&
      drlMaxPerWeek !== '' &&
      drlMaxInt === null
    ) {
      return NextResponse.json(
        { error: 'DRL 주간 상한은 1 이상의 숫자로 입력해주세요.' },
        { status: 400 }
      )
    }

    const droMinutesParsed = parseOptionalPositiveInt(droIntervalMinutes, 24 * 60)
    const droMinutes = isDro && droMinutesParsed !== null ? droMinutesParsed : null
    const isDroActive = Boolean(isDro && droMinutes !== null)

    const supabase = await createServerSupabase()

    const { data: student, error: studentError } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .maybeSingle()

    if (studentError) {
      console.error('행동 목표 학생 조회 오류:', studentError)
      return NextResponse.json({ error: '학생 정보를 확인하는 중 오류가 발생했습니다.' }, { status: 500 })
    }
    if (!student) {
      return NextResponse.json(
        { error: '이 학급에 속한 학생이 아니거나 학생을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { data: goal, error } = await supabase
      .from('pbs_goals')
      .insert({
        student_id: studentId,
        class_code_id: session.classroomId,
        behavior_name: String(behaviorName).trim(),
        behavior_definition: behaviorDefinition || null,
        behavior_function: normalizeBehaviorFunction(behaviorFunction),
        strategy_type: strategyType || null,
        token_per_occurrence: tokenInt,
        daily_target: dailyTargetInt,
        weekly_target: weeklyTargetInt,
        is_dro: isDroActive,
        dro_interval_minutes: droMinutes,
        is_ncr: Boolean(isNcr),
        ncr_interval_minutes:
          isNcr && typeof ncrIntervalMinutes === 'number' && ncrIntervalMinutes > 0
            ? Math.min(240, Math.floor(ncrIntervalMinutes))
            : null,
        is_drl: isDrl || false,
        drl_max_per_week: drlMaxInt,
        allow_self_check: allowSelfCheck || false,
      })
      .select()
      .single()

    if (error) {
      console.error('행동 목표 등록 오류:', error)
      const msg = error.message || ''
      if (error.code === '23503' || /foreign key/i.test(msg)) {
        return NextResponse.json(
          { error: '학생 또는 학급 정보가 일치하지 않아 저장할 수 없습니다.' },
          { status: 400 }
        )
      }
      if (/is_ncr|ncr_interval_minutes|column/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              'DB에 NCR 관련 컬럼(is_ncr)이 없습니다. Supabase에 마이그레이션 012_ptr_phase1_prevent_teach_columns.sql을 적용했는지 확인해주세요.',
            details: msg,
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: '행동 목표 등록에 실패했습니다.', details: msg || undefined },
        { status: 500 }
      )
    }

    return NextResponse.json({ goal })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
