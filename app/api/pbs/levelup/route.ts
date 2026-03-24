import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// 레벨별 요구사항 정의
const LEVEL_REQUIREMENTS = {
  1: { minRecords: 0, minSuccessRate: 0 },
  2: { minRecords: 10, minSuccessRate: 0.6 },
  3: { minRecords: 25, minSuccessRate: 0.7 },
  4: { minRecords: 50, minSuccessRate: 0.75 },
  5: { minRecords: 100, minSuccessRate: 0.8 },
}

const LEVEL_BONUS = {
  2: 500,
  3: 1000,
  4: 1500,
  5: 2000,
}

// GET /api/pbs/levelup — 레벨업 자격 확인
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, pbs_stage')
      .eq('id', studentId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    // PBS 기록 통계
    const { data: records } = await supabase
      .from('pbs_records')
      .select('occurrence_count, is_settled')
      .eq('student_id', studentId)
      .eq('is_settled', true)
      .gt('occurrence_count', 0)

    const totalRecords = records?.length || 0
    const successRate = totalRecords > 0 ? 1.0 : 0 // 모든 기록이 성공으로 간주

    const currentStage = student.pbs_stage
    const nextStage = currentStage + 1
    const canLevelUp = nextStage <= 5

    if (!canLevelUp) {
      return NextResponse.json({
        canLevelUp: false,
        currentStage,
        message: '이미 최고 레벨입니다.',
      })
    }

    const requirement = LEVEL_REQUIREMENTS[nextStage as keyof typeof LEVEL_REQUIREMENTS]
    const meetsRequirement = totalRecords >= requirement.minRecords && successRate >= requirement.minSuccessRate

    return NextResponse.json({
      canLevelUp: meetsRequirement,
      currentStage,
      nextStage,
      totalRecords,
      successRate: Math.round(successRate * 100),
      requirement: {
        minRecords: requirement.minRecords,
        minSuccessRate: Math.round(requirement.minSuccessRate * 100),
      },
      bonus: LEVEL_BONUS[nextStage as keyof typeof LEVEL_BONUS] || 0,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/pbs/levelup — 레벨업 실행 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: student } = await supabase
      .from('pbs_students')
      .select('*, pbs_accounts(*)')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const currentStage = student.pbs_stage
    const nextStage = currentStage + 1

    if (nextStage > 5) {
      return NextResponse.json({ error: '이미 최고 레벨입니다.' }, { status: 400 })
    }

    // 레벨업 실행
    await supabase
      .from('pbs_students')
      .update({ pbs_stage: nextStage })
      .eq('id', studentId)

    // 레벨업 보너스 지급
    const bonus = LEVEL_BONUS[nextStage as keyof typeof LEVEL_BONUS] || 0
    const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts

    if (bonus > 0 && account) {
      const newBalance = (account.balance || 0) + bonus

      await supabase
        .from('pbs_accounts')
        .update({
          balance: newBalance,
          total_earned: (account.total_earned || 0) + bonus,
        })
        .eq('id', account.id)

      await supabase.from('pbs_transactions').insert({
        student_id: studentId,
        type: 'level_up_bonus',
        amount: bonus,
        balance_after: newBalance,
        description: `PBS 레벨 ${nextStage} 달성 보너스`,
      })
    }

    return NextResponse.json({
      success: true,
      newStage: nextStage,
      bonus,
      message: `축하합니다! PBS 레벨 ${nextStage}로 승급했습니다!`,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
