import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { canWithdraw } from '@/lib/utils'

// POST /api/shop/purchase — 아이템 구매
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || !session.studentId) {
      return NextResponse.json({ error: '학생 인증이 필요합니다.' }, { status: 401 })
    }

    const { itemId, giftToStudentId } = await request.json()
    if (!itemId) {
      return NextResponse.json({ error: '아이템 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 아이템 조회
    const { data: item } = await supabase
      .from('pbs_shop_items')
      .select('*')
      .eq('id', itemId)
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .single()

    if (!item) {
      return NextResponse.json({ error: '아이템을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 재고 확인
    if (item.stock != null && item.stock <= 0) {
      return NextResponse.json({ error: '재고가 없습니다.' }, { status: 400 })
    }

    // 선물인 경우 선물 가능 여부 확인
    if (giftToStudentId && !item.is_giftable) {
      return NextResponse.json({ error: '선물 불가능한 아이템입니다.' }, { status: 400 })
    }

    // 구매자 계좌 조회
    const { data: buyerAccount } = await supabase
      .from('pbs_accounts')
      .select('balance, total_spent')
      .eq('student_id', session.studentId)
      .single()

    if (!buyerAccount) {
      return NextResponse.json({ error: '계좌를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 구매자 최저잔액 보호 확인
    const { data: buyer } = await supabase
      .from('pbs_students')
      .select('min_balance')
      .eq('id', session.studentId)
      .single()

    if (!canWithdraw(buyerAccount.balance, item.price, buyer?.min_balance || 500)) {
      return NextResponse.json({ error: '잔액이 부족합니다. (최저잔액 보호)' }, { status: 400 })
    }

    const newBalance = buyerAccount.balance - item.price
    const newSpent = buyerAccount.total_spent + item.price

    // 계좌 차감
    await supabase
      .from('pbs_accounts')
      .update({ balance: newBalance, total_spent: newSpent })
      .eq('student_id', session.studentId)

    // 거래 기록 (구매)
    await supabase.from('pbs_transactions').insert({
      student_id: session.studentId,
      type: giftToStudentId ? 'gift_sent' : 'purchase',
      amount: -item.price,
      balance_after: newBalance,
      description: giftToStudentId
        ? `선물 발송: ${item.name} (-${item.price}원)`
        : `가게 구매: ${item.name} (-${item.price}원)`,
    })

    // 재고 차감
    if (item.stock != null) {
      await supabase
        .from('pbs_shop_items')
        .update({ stock: item.stock - 1 })
        .eq('id', itemId)
    }

    // 선물인 경우 수신자 처리
    if (giftToStudentId) {
      const { data: receiverAccount } = await supabase
        .from('pbs_accounts')
        .select('balance, total_earned')
        .eq('student_id', giftToStudentId)
        .single()

      if (receiverAccount) {
        // 선물은 아이템 전달이므로 금액 이체 없음, 기록만 남김
        await supabase.from('pbs_transactions').insert({
          student_id: giftToStudentId,
          type: 'gift_received',
          amount: 0,
          balance_after: receiverAccount.balance,
          description: `선물 수신: ${item.name}`,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      item: item.name,
      price: item.price,
      balanceAfter: newBalance,
      isGift: !!giftToStudentId,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
