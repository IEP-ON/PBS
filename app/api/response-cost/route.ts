import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/response-cost — 반응대가 기록 조회
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    const supabase = await createServerSupabase()

    let query = supabase
      .from('pbs_transactions')
      .select('*, pbs_students(name)')
      .eq('type', 'response_cost')
      .order('created_at', { ascending: false })
      .limit(50)

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data: records } = await query

    return NextResponse.json({ records: records || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/response-cost — 반응대가 차감 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId, amount, reason } = await request.json()

    if (!studentId || !amount || amount <= 0) {
      return NextResponse.json({ error: '학생과 차감 금액은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학생 정보 및 반응대가 활성화 확인
    const { data: student } = await supabase
      .from('pbs_students')
      .select('*, pbs_accounts(*)')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!student.response_cost_enabled) {
      return NextResponse.json({ error: '이 학생은 반응대가가 비활성화되어 있습니다.' }, { status: 400 })
    }

    const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
    const currentBalance = account?.balance || 0

    // 최저잔액 보호 (500원 이하로는 차감 불가)
    const deduction = Math.abs(amount)
    const newBalance = currentBalance - deduction

    if (newBalance < 500) {
      const maxDeduction = currentBalance - 500
      if (maxDeduction <= 0) {
        return NextResponse.json({ 
          error: '최저잔액 보호로 인해 차감할 수 없습니다. (현재잔액 500원 이하)' 
        }, { status: 400 })
      }
      return NextResponse.json({ 
        error: `최대 차감 가능 금액: ${maxDeduction}원 (최저잔액 500원 보호)` 
      }, { status: 400 })
    }

    // 잔액 업데이트
    await supabase
      .from('pbs_accounts')
      .update({ 
        balance: newBalance,
        total_spent: (account?.total_spent || 0) + deduction,
      })
      .eq('id', account!.id)

    // 거래 기록
    const { data: transaction } = await supabase
      .from('pbs_transactions')
      .insert({
        student_id: studentId,
        type: 'response_cost',
        amount: -deduction,
        balance_after: newBalance,
        description: reason || '반응대가 (문제행동)',
      })
      .select()
      .single()

    return NextResponse.json({ 
      transaction,
      newBalance,
      deducted: deduction,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
