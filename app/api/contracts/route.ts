import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/contracts — 행동계약서 목록 조회
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
      .from('pbs_behavior_contracts')
      .select('*, pbs_students(name)')
      .eq('class_code_id', session.classroomId)
      .order('created_at', { ascending: false })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data: contracts, error } = await query

    if (error) {
      return NextResponse.json({ error: '계약서 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ contracts: contracts || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/contracts — 행동계약서 생성 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      studentId, contractTitle, targetBehavior, behaviorDefinition,
      measurementMethod, achievementCriteria, rewardAmount,
      contractStart, contractEnd, teacherNote,
    } = body

    if (!studentId || !contractTitle || !targetBehavior) {
      return NextResponse.json({ error: '학생, 계약 제목, 표적 행동은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: contract, error } = await supabase
      .from('pbs_behavior_contracts')
      .insert({
        student_id: studentId,
        class_code_id: session.classroomId,
        contract_title: contractTitle,
        target_behavior: targetBehavior,
        behavior_definition: behaviorDefinition || null,
        measurement_method: measurementMethod || null,
        achievement_criteria: achievementCriteria || null,
        reward_amount: rewardAmount ? Number(rewardAmount) : 0,
        contract_start: contractStart || new Date().toISOString().split('T')[0],
        contract_end: contractEnd || null,
        teacher_note: teacherNote || null,
        teacher_signed: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '계약서 생성 실패' }, { status: 500 })
    }

    return NextResponse.json({ contract })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
