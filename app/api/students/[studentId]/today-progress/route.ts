import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getKstToday } from '@/lib/speech-diary'
import type { TodayProgress } from '@/types'

function clampPercent(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    const { studentId } = await params

    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const isTeacher = session.role === 'teacher'
    const isSameStudent = session.role === 'student' && session.studentId === studentId
    if (!isTeacher && !isSameStudent) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()
    const { data: ownedStudent } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .maybeSingle()

    if (!ownedStudent) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const today = getKstToday()
    const [{ data: todayRecords }, { data: goals }, { data: contracts }] = await Promise.all([
      supabase
        .from('pbs_records')
        .select('goal_id, occurrence_count, token_granted')
        .eq('student_id', studentId)
        .eq('record_date', today),
      supabase
        .from('pbs_goals')
        .select('id, behavior_name, daily_target')
        .eq('student_id', studentId)
        .eq('is_active', true),
      supabase
        .from('pbs_behavior_contracts')
        .select('id, contract_title, target_behavior')
        .eq('student_id', studentId)
        .eq('is_active', true),
    ])

    const goalStats = new Map<string, number>()
    let todayTokens = 0
    for (const record of todayRecords || []) {
      goalStats.set(record.goal_id, (goalStats.get(record.goal_id) || 0) + (record.occurrence_count || 0))
      todayTokens += record.token_granted || 0
    }

    const goalsPayload = (goals || []).map((goal) => ({
      goalId: goal.id,
      behaviorName: goal.behavior_name,
      todayCount: goalStats.get(goal.id) || 0,
      dailyTarget: goal.daily_target ?? null,
    }))

    const activeContracts = (contracts || []).map((contract) => {
      const matchingGoal = goalsPayload.find((goal) => goal.behaviorName === contract.target_behavior)
      const progressPercent = matchingGoal?.dailyTarget && matchingGoal.dailyTarget > 0
        ? clampPercent((matchingGoal.todayCount / matchingGoal.dailyTarget) * 100)
        : matchingGoal && matchingGoal.todayCount > 0
          ? 100
          : 0

      return {
        contractId: contract.id,
        title: contract.contract_title,
        progressPercent,
      }
    })

    const payload: TodayProgress = {
      studentId,
      date: today,
      todayTokens,
      goals: goalsPayload,
      activeContracts,
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=10',
      },
    })
  } catch {
    return NextResponse.json({ error: '오늘 진행 상황 조회에 실패했습니다.' }, { status: 500 })
  }
}
