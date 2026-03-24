import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { canWithdraw } from '@/lib/utils'

// POST /api/salary/settle — PBS 기록 정산 (계좌 반영)
// body: { studentId?: string } — 없으면 학급 전체 정산
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { studentId } = body

    const supabase = await createServerSupabase()

    // 미정산 PBS 기록 조회
    let recordsQuery = supabase
      .from('pbs_records')
      .select('student_id, token_granted')
      .eq('is_settled', false)
      .gt('token_granted', 0)

    if (studentId) {
      recordsQuery = recordsQuery.eq('student_id', studentId)
    }

    const { data: records, error: recordsError } = await recordsQuery

    if (recordsError) {
      return NextResponse.json({ error: '기록 조회 실패' }, { status: 500 })
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ settled: 0, message: '정산할 기록이 없습니다.' })
    }

    // 학생별 합산
    const studentTotals: Record<string, number> = {}
    for (const r of records) {
      studentTotals[r.student_id] = (studentTotals[r.student_id] || 0) + r.token_granted
    }

    let totalSettled = 0
    const results: { studentId: string; amount: number }[] = []

    for (const [sid, amount] of Object.entries(studentTotals)) {
      // 현재 잔액 조회
      const { data: account } = await supabase
        .from('pbs_accounts')
        .select('balance, total_earned')
        .eq('student_id', sid)
        .single()

      if (!account) continue

      const newBalance = account.balance + amount
      const newTotalEarned = account.total_earned + amount

      // 계좌 잔액 업데이트
      await supabase
        .from('pbs_accounts')
        .update({ balance: newBalance, total_earned: newTotalEarned })
        .eq('student_id', sid)

      // 거래 기록 생성
      await supabase.from('pbs_transactions').insert({
        student_id: sid,
        type: 'salary_pbs',
        amount,
        balance_after: newBalance,
        description: `PBS 성과급 정산 (+${amount}원)`,
      })

      totalSettled += amount
      results.push({ studentId: sid, amount })
    }

    // 정산된 기록 is_settled = true 처리
    let updateQuery = supabase
      .from('pbs_records')
      .update({ is_settled: true })
      .eq('is_settled', false)
      .gt('token_granted', 0)

    if (studentId) {
      updateQuery = updateQuery.eq('student_id', studentId)
    }

    await updateQuery

    return NextResponse.json({
      settled: results.length,
      totalAmount: totalSettled,
      results,
    })
  } catch (error) {
    console.error('정산 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// GET /api/salary/settle — 미정산 내역 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()

    const { data: records } = await supabase
      .from('pbs_records')
      .select('student_id, token_granted, record_date, pbs_goals(behavior_name)')
      .eq('is_settled', false)
      .gt('token_granted', 0)
      .order('record_date', { ascending: false })

    const studentTotals: Record<string, number> = {}
    for (const r of records || []) {
      studentTotals[r.student_id] = (studentTotals[r.student_id] || 0) + r.token_granted
    }

    return NextResponse.json({
      pendingCount: records?.length || 0,
      studentTotals,
      records: records || [],
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
