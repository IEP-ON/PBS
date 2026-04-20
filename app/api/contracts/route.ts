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
      contractStart, contractEnd, teacherNote, rewardDescription,
    } = body

    if (!studentId || !contractTitle || !targetBehavior) {
      return NextResponse.json({ error: '학생, 계약 제목, 표적 행동은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const baseRow = {
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
    }

    const withRewardDesc = {
      ...baseRow,
      reward_description: rewardDescription || null,
    }

    let { data: contract, error } = await supabase
      .from('pbs_behavior_contracts')
      .insert(withRewardDesc)
      .select()
      .single()

    // 마이그레이션 014 미적용 시 reward_description 컬럼 없음 → 재시도
    if (error) {
      const msg = (error.message || '').toLowerCase()
      const missingRewardCol =
        msg.includes('reward_description') ||
        msg.includes('column') && msg.includes('does not exist')
      if (missingRewardCol) {
        ;({ data: contract, error } = await supabase
          .from('pbs_behavior_contracts')
          .insert(baseRow)
          .select()
          .single())
      }
    }

    if (error) {
      console.error('pbs_behavior_contracts insert:', error)
      return NextResponse.json(
        { error: '계약서 생성 실패', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ contract })
  } catch (e) {
    console.error('POST /api/contracts:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
