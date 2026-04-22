import { NextResponse } from 'next/server'
import { clearBankSession, getBankSession } from '@/lib/bank-session'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/bank/me — 뱅킹 세션 기준 잔액·저축
export async function GET() {
  try {
    const session = await getBankSession()
    if (!session.studentId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name')
      .eq('id', session.studentId)
      .eq('is_active', true)
      .single()

    if (!student) {
      await clearBankSession()
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 401 })
    }

    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance')
      .eq('student_id', student.id)
      .maybeSingle()

    let savingsBalance = 0
    const { data: savings } = await supabase
      .from('pbs_student_savings')
      .select('balance')
      .eq('student_id', student.id)
      .maybeSingle()

    if (savings) {
      savingsBalance = savings.balance ?? 0
    } else {
      const { error: insertSav } = await supabase
        .from('pbs_student_savings')
        .insert({ student_id: student.id, balance: 0 })
      if (insertSav) {
        savingsBalance = 0
      }
    }

    return NextResponse.json({
      ok: true,
      studentName: student.name,
      classCode: session.classCode || null,
      balance: account?.balance ?? 0,
      savingsBalance,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
