import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/class-account — 학급 계좌 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    // 학급 계좌 가져오기 (없으면 생성)
    let { data: account } = await supabase
      .from('pbs_class_account')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .single()

    if (!account) {
      const { data: newAccount } = await supabase
        .from('pbs_class_account')
        .insert({ class_code_id: session.classroomId, balance: 0 })
        .select()
        .single()
      account = newAccount
    }

    // 거래 내역
    const { data: transactions } = await supabase
      .from('pbs_class_transactions')
      .select('*')
      .eq('class_account_id', account!.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      account: account || { balance: 0 },
      transactions: transactions || [],
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/class-account — 학급 계좌 입출금 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { type, amount, description } = await request.json()
    if (!type || !amount) {
      return NextResponse.json({ error: '유형과 금액은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학급 계좌 가져오기
    let { data: account } = await supabase
      .from('pbs_class_account')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .single()

    if (!account) {
      const { data: newAccount } = await supabase
        .from('pbs_class_account')
        .insert({ class_code_id: session.classroomId, balance: 0 })
        .select()
        .single()
      account = newAccount
    }

    const signedAmount = type === 'deposit' ? Math.abs(amount) : -Math.abs(amount)
    const newBalance = account!.balance + signedAmount

    if (newBalance < 0) {
      return NextResponse.json({ error: '학급 계좌 잔액이 부족합니다.' }, { status: 400 })
    }

    // 잔액 업데이트
    await supabase
      .from('pbs_class_account')
      .update({ balance: newBalance })
      .eq('id', account!.id)

    // 거래 기록
    await supabase.from('pbs_class_transactions').insert({
      class_account_id: account!.id,
      type,
      amount: signedAmount,
      balance_after: newBalance,
      description: description || (type === 'deposit' ? '입금' : '출금'),
    })

    return NextResponse.json({ balance: newBalance, amount: signedAmount })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
