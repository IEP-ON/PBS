import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { canWithdraw } from '@/lib/utils'

// POST /api/atm/shop/purchase — ATM: 상점 구매 (세션 없이)
export async function POST(request: Request) {
  try {
    const { classCode, studentId, itemId } = await request.json()

    if (!classCode || !studentId || !itemId) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학급 확인
    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '학급코드가 올바르지 않습니다.' }, { status: 401 })
    }

    // 학생 확인
    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, min_balance')
      .eq('id', studentId)
      .eq('class_code_id', classroom.id)
      .eq('is_active', true)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 확인해주세요.' }, { status: 401 })
    }

    // 아이템 조회
    const { data: item } = await supabase
      .from('pbs_shop_items')
      .select('*')
      .eq('id', itemId)
      .eq('class_code_id', classroom.id)
      .eq('is_active', true)
      .single()

    if (!item) {
      return NextResponse.json({ error: '아이템을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (item.stock != null && item.stock <= 0) {
      return NextResponse.json({ error: '품절된 상품입니다.' }, { status: 400 })
    }

    // 계좌 조회
    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance, total_spent')
      .eq('student_id', studentId)
      .single()

    if (!account) {
      return NextResponse.json({ error: '계좌를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!canWithdraw(account.balance, item.price, student.min_balance || 500)) {
      return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 })
    }

    const newBalance = account.balance - item.price

    // 계좌 차감
    await supabase
      .from('pbs_accounts')
      .update({ balance: newBalance, total_spent: account.total_spent + item.price })
      .eq('student_id', studentId)

    // 거래 기록
    await supabase.from('pbs_transactions').insert({
      student_id: studentId,
      type: 'purchase',
      amount: -item.price,
      balance_after: newBalance,
      description: `가게 구매: ${item.name} (-${item.price}원)`,
    })

    // 재고 차감
    if (item.stock != null) {
      await supabase
        .from('pbs_shop_items')
        .update({ stock: item.stock - 1 })
        .eq('id', itemId)
    }

    return NextResponse.json({
      ok: true,
      item: item.name,
      emoji: item.emoji,
      price: item.price,
      balanceAfter: newBalance,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
