import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { buildFallbackPublicCue, mapStudentAiProfile } from '@/lib/ai-profile'

// GET /api/pbs/selfcheck — 학생 스스로 체크 가능한 행동 목표 + 오늘 기록 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || !session.studentId) {
      return NextResponse.json({ error: '학생 인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    // 스스로 체크 허용된 활성 행동 목표
    const { data: goals } = await supabase
      .from('pbs_goals')
      .select('id, behavior_name, behavior_definition, token_per_occurrence, strategy_type')
      .eq('student_id', session.studentId)
      .eq('is_active', true)
      .eq('allow_self_check', true)

    // 오늘 스스로 체크 기록
    const today = new Date().toISOString().split('T')[0]
    const { data: records } = await supabase
      .from('pbs_records')
      .select('goal_id, occurrence_count, token_granted, is_self_check')
      .eq('student_id', session.studentId)
      .eq('is_self_check', true)
      .gte('record_date', today)
      .lte('record_date', today)

    const { data: aiProfileRow } = await supabase
      .from('pbs_student_ai_profiles')
      .select('*')
      .eq('student_id', session.studentId)
      .maybeSingle()

    const aiProfile = aiProfileRow ? mapStudentAiProfile(aiProfileRow as Record<string, unknown>) : null
    const publicCue = aiProfile?.public_cue || buildFallbackPublicCue({
      classModeTargets: aiProfile?.class_mode_targets || [],
      replacementBehaviors: aiProfile?.replacement_behaviors || [],
      preferences: aiProfile?.preferences || [],
    })

    return NextResponse.json({
      goals: goals || [],
      todayRecords: records || [],
      publicCue,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/pbs/selfcheck — 학생 스스로 체크 기록
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || !session.studentId) {
      return NextResponse.json({ error: '학생 인증이 필요합니다.' }, { status: 401 })
    }

    const { goalId, occurrenceCount } = await request.json()
    if (!goalId || !occurrenceCount || occurrenceCount <= 0) {
      return NextResponse.json({ error: '목표 ID와 발생 횟수는 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 행동 목표 확인 (스스로 체크 허용 여부)
    const { data: goal } = await supabase
      .from('pbs_goals')
      .select('*')
      .eq('id', goalId)
      .eq('student_id', session.studentId)
      .eq('is_active', true)
      .eq('allow_self_check', true)
      .single()

    if (!goal) {
      return NextResponse.json({ error: '스스로 체크가 허용되지 않은 목표입니다.' }, { status: 403 })
    }

    const tokenGranted = goal.token_per_occurrence * occurrenceCount
    const today = new Date().toISOString().split('T')[0]

    // 스스로 체크 기록 (is_self_check = true, is_settled = false → 교사 정산 시 반영)
    const { data: record, error } = await supabase
      .from('pbs_records')
      .insert({
        student_id: session.studentId,
        goal_id: goalId,
        class_code_id: session.classroomId,
        record_date: today,
        occurrence_count: occurrenceCount,
        token_granted: tokenGranted,
        is_self_check: true,
        is_settled: false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '스스로 체크 기록 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      recordId: record.id,
      tokenGranted,
      goalName: goal.behavior_name,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
