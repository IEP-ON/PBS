import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// DELETE /api/interventions/[strategyId] — 학생 연결 중재 제거 + 미사용 전략 정리
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ strategyId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { strategyId } = await params
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')?.trim()

    if (!studentId) {
      return NextResponse.json({ error: '학생 정보가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: strategy } = await supabase
      .from('pbs_intervention_library')
      .select('id, name_ko, abbreviation')
      .eq('id', strategyId)
      .single()

    if (!strategy) {
      return NextResponse.json({ error: '중재 전략을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { error: goalUpdateError } = await supabase
      .from('pbs_goals')
      .update({ strategy_type: null })
      .eq('student_id', studentId)
      .eq('strategy_type', strategy.name_ko)

    if (goalUpdateError) {
      return NextResponse.json({ error: '학생 목표에서 중재 전략 제거에 실패했습니다.' }, { status: 500 })
    }

    const { count: remainingUsageCount } = await supabase
      .from('pbs_goals')
      .select('*', { count: 'exact', head: true })
      .eq('strategy_type', strategy.name_ko)

    if ((remainingUsageCount || 0) === 0) {
      await supabase
        .from('pbs_function_intervention_map')
        .delete()
        .eq('intervention_abbreviation', strategy.abbreviation)

      await supabase
        .from('pbs_intervention_library')
        .delete()
        .eq('id', strategyId)
    }

    return NextResponse.json({
      ok: true,
      strategyName: strategy.name_ko,
      libraryDeleted: (remainingUsageCount || 0) === 0,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
