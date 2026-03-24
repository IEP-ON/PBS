import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/dro — DRO 타이머 목록 조회
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
      .from('pbs_dro_timers')
      .select('*, pbs_goals(behavior_name, token_per_occurrence)')
      .order('started_at', { ascending: false })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data: timers, error } = await query

    if (error) {
      return NextResponse.json({ error: 'DRO 타이머 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ timers: timers || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/dro — DRO 타이머 시작 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId, goalId, durationMinutes } = await request.json()

    if (!studentId || !goalId || !durationMinutes) {
      return NextResponse.json({ error: '학생, 목표, 타이머 시간은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const now = new Date()
    const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000)

    const { data: timer, error } = await supabase
      .from('pbs_dro_timers')
      .insert({
        student_id: studentId,
        goal_id: goalId,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'running',
        reset_count: 0,
      })
      .select('*, pbs_goals(behavior_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: 'DRO 타이머 생성 실패' }, { status: 500 })
    }

    return NextResponse.json({ timer })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
