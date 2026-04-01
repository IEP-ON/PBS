import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// PATCH /api/pbs/goals/[goalId] — PBS 목표 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { goalId } = await params
    const body = await request.json()

    const allowedFields: Record<string, string> = {
      behaviorName: 'behavior_name',
      behaviorDefinition: 'behavior_definition',
      tokenPerOccurrence: 'token_per_occurrence',
      strategyType: 'strategy_type',
      dailyTarget: 'daily_target',
      weeklyTarget: 'weekly_target',
      allowSelfCheck: 'allow_self_check',
      isActive: 'is_active',
    }

    const updateData: Record<string, unknown> = {}
    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        updateData[col] = body[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: goal, error } = await supabase
      .from('pbs_goals')
      .update(updateData)
      .eq('id', goalId)
      .eq('class_code_id', session.classroomId)
      .select()
      .single()

    if (error || !goal) {
      return NextResponse.json({ error: 'PBS 목표 수정에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ goal })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/pbs/goals/[goalId] — PBS 목표 완전 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { goalId } = await params
    const supabase = await createServerSupabase()

    const { data: goal } = await supabase
      .from('pbs_goals')
      .select('id, class_code_id, behavior_name')
      .eq('id', goalId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!goal) {
      return NextResponse.json({ error: 'PBS 목표를 찾을 수 없습니다.' }, { status: 404 })
    }

    await supabase.from('pbs_extinction_alerts').delete().eq('goal_id', goalId)
    await supabase.from('pbs_dro_timers').delete().eq('goal_id', goalId)
    await supabase.from('pbs_records').delete().eq('goal_id', goalId)

    const { error } = await supabase
      .from('pbs_goals')
      .delete()
      .eq('id', goalId)
      .eq('class_code_id', session.classroomId)

    if (error) {
      return NextResponse.json({ error: 'PBS 목표 삭제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, goalName: goal.behavior_name })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
