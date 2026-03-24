import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// PATCH /api/dro/[timerId] — DRO 타이머 리셋/완료/취소
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ timerId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { timerId } = await params
    const { action, durationMinutes } = await request.json()

    const supabase = await createServerSupabase()

    const { data: timer } = await supabase
      .from('pbs_dro_timers')
      .select('*, pbs_goals(behavior_name, token_per_occurrence)')
      .eq('id', timerId)
      .single()

    if (!timer) {
      return NextResponse.json({ error: '타이머를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (action === 'reset') {
      // 문제 행동 발생 → 타이머 리셋
      const now = new Date()
      const mins = durationMinutes || Math.round((new Date(timer.ends_at).getTime() - new Date(timer.started_at).getTime()) / 60000)
      const newEndsAt = new Date(now.getTime() + mins * 60 * 1000)

      await supabase
        .from('pbs_dro_timers')
        .update({
          started_at: now.toISOString(),
          ends_at: newEndsAt.toISOString(),
          reset_count: timer.reset_count + 1,
          status: 'running',
        })
        .eq('id', timerId)

      return NextResponse.json({
        ok: true,
        action: 'reset',
        resetCount: timer.reset_count + 1,
        newEndsAt: newEndsAt.toISOString(),
      })
    } else if (action === 'complete') {
      // 타이머 완료 → 토큰 지급
      await supabase
        .from('pbs_dro_timers')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', timerId)

      // 토큰 지급
      const tokenAmount = timer.pbs_goals?.token_per_occurrence || 0
      if (tokenAmount > 0) {
        const { data: account } = await supabase
          .from('pbs_accounts')
          .select('balance, total_earned')
          .eq('student_id', timer.student_id)
          .single()

        if (account) {
          const newBalance = account.balance + tokenAmount
          await supabase
            .from('pbs_accounts')
            .update({ balance: newBalance, total_earned: account.total_earned + tokenAmount })
            .eq('student_id', timer.student_id)

          await supabase.from('pbs_transactions').insert({
            student_id: timer.student_id,
            type: 'salary_pbs',
            amount: tokenAmount,
            balance_after: newBalance,
            description: `DRO 타이머 완료: ${timer.pbs_goals?.behavior_name || 'DRO'} (+${tokenAmount}원)`,
          })
        }
      }

      return NextResponse.json({
        ok: true,
        action: 'complete',
        tokenGranted: tokenAmount,
        behaviorName: timer.pbs_goals?.behavior_name,
      })
    } else if (action === 'cancel') {
      await supabase
        .from('pbs_dro_timers')
        .update({ status: 'cancelled' })
        .eq('id', timerId)

      return NextResponse.json({ ok: true, action: 'cancel' })
    }

    return NextResponse.json({ error: '잘못된 액션입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
