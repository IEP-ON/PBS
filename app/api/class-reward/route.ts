import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/class-reward — 학급 보상 기록 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()

    const { data: rewards } = await supabase
      .from('pbs_transactions')
      .select('id, amount, description, created_at')
      .eq('type', 'class_reward')
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ rewards: rewards || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/class-reward — 학급 전체 보상 지급 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { amountPerStudent, reason } = await request.json()

    if (!amountPerStudent || amountPerStudent <= 0) {
      return NextResponse.json({ error: '학생당 지급 금액은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 활성 학생 조회
    const { data: students } = await supabase
      .from('pbs_students')
      .select('id, name, pbs_accounts(id, balance, total_earned)')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)

    if (!students || students.length === 0) {
      return NextResponse.json({ error: '활성 학생이 없습니다.' }, { status: 404 })
    }

    const transactions = []
    const accountUpdates = []

    for (const student of students) {
      const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
      if (!account) continue

      const newBalance = (account.balance || 0) + amountPerStudent

      // 계좌 업데이트 준비
      accountUpdates.push({
        id: account.id,
        balance: newBalance,
        total_earned: (account.total_earned || 0) + amountPerStudent,
      })

      // 거래 기록 준비
      transactions.push({
        student_id: student.id,
        type: 'class_reward',
        amount: amountPerStudent,
        balance_after: newBalance,
        description: reason || '학급 단체 보상',
      })
    }

    // 일괄 업데이트 (Supabase는 배치 업데이트를 지원하지 않으므로 개별 실행)
    for (const update of accountUpdates) {
      await supabase
        .from('pbs_accounts')
        .update({
          balance: update.balance,
          total_earned: update.total_earned,
        })
        .eq('id', update.id)
    }

    // 거래 기록 일괄 삽입
    await supabase.from('pbs_transactions').insert(transactions)

    return NextResponse.json({
      message: '학급 보상 지급 완료',
      studentsCount: students.length,
      totalAmount: amountPerStudent * students.length,
      amountPerStudent,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
