import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// POST /api/pbs/records — PBS 체크 입력
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { studentId, goalId, occurrenceCount, prompted, contextNote } = body

    if (!studentId || !goalId || occurrenceCount === undefined) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 목표 조회하여 단가 확인
    const { data: goal } = await supabase
      .from('pbs_goals')
      .select('token_per_occurrence')
      .eq('id', goalId)
      .single()

    if (!goal) {
      return NextResponse.json({ error: 'PBS 목표를 찾을 수 없습니다.' }, { status: 404 })
    }

    const tokenGranted = goal.token_per_occurrence * occurrenceCount

    const { data: record, error } = await supabase
      .from('pbs_records')
      .insert({
        student_id: studentId,
        goal_id: goalId,
        occurrence_count: occurrenceCount,
        prompted: prompted || false,
        context_note: contextNote || null,
        token_granted: tokenGranted,
        is_settled: false,
      })
      .select()
      .single()

    if (error) {
      console.error('PBS 체크 입력 오류:', error)
      return NextResponse.json({ error: 'PBS 체크 입력에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      recordId: record.id,
      tokenGranted,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// GET /api/pbs/records — PBS 체크 기록 조회
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabase = await createServerSupabase()

    let query = supabase
      .from('pbs_records')
      .select('*, pbs_goals(behavior_name, token_per_occurrence)')
      .eq('record_date', date)
      .order('created_at', { ascending: false })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'PBS 기록 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ records: data || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
