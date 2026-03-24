import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/pbs/goals — PBS 목표 목록
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
      return NextResponse.json({ error: 'PBS 목표 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ goals: data || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/pbs/goals — PBS 목표 등록
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
      isDro, droIntervalMinutes, isDrl, drlMaxPerWeek, allowSelfCheck,
    } = body

    if (!studentId || !behaviorName || !tokenPerOccurrence) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: goal, error } = await supabase
      .from('pbs_goals')
      .insert({
        student_id: studentId,
        class_code_id: session.classroomId,
        behavior_name: behaviorName,
        behavior_definition: behaviorDefinition || null,
        behavior_function: behaviorFunction || null,
        strategy_type: strategyType || null,
        token_per_occurrence: tokenPerOccurrence,
        daily_target: dailyTarget || null,
        weekly_target: weeklyTarget || null,
        is_dro: isDro || false,
        dro_interval_minutes: droIntervalMinutes || null,
        is_drl: isDrl || false,
        drl_max_per_week: drlMaxPerWeek || null,
        allow_self_check: allowSelfCheck || false,
      })
      .select()
      .single()

    if (error) {
      console.error('PBS 목표 등록 오류:', error)
      return NextResponse.json({ error: 'PBS 목표 등록에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ goal })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
