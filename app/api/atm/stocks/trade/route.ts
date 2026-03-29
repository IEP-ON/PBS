import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { canWithdraw } from '@/lib/utils'

// POST /api/atm/stocks/trade — ATM: 주식 매수/매도 (세션 없이)
export async function POST(request: Request) {
  try {
    const { classCode, studentId, stockId, stockName, action, quantity } = await request.json()

    if (!classCode || !studentId || !stockName || !action || !quantity || quantity <= 0) {
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

    // 현재가 조회
    const { data: stock } = await supabase
      .from('pbs_custom_stocks')
      .select('current_price')
      .eq('id', stockId)
      .single()

    if (!stock) {
      return NextResponse.json({ error: '종목을 찾을 수 없습니다.' }, { status: 404 })
    }

    const currentPrice = stock.current_price
    const totalAmount = currentPrice * quantity

    // 계좌 조회
    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance, total_spent, total_earned')
      .eq('student_id', studentId)
      .single()

    if (!account) {
      return NextResponse.json({ error: '계좌를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 보유 현황
    const { data: holding } = await supabase
      .from('pbs_stock_holdings')
      .select('*')
      .eq('student_id', studentId)
      .eq('stock_name', stockName)
      .single()

    if (action === 'buy') {
      if (!canWithdraw(account.balance, totalAmount, student.min_balance || 500)) {
        return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 })
      }

      const newBalance = account.balance - totalAmount

      await supabase
        .from('pbs_accounts')
        .update({ balance: newBalance, total_spent: account.total_spent + totalAmount })
        .eq('student_id', studentId)

      if (holding) {
        const newQty = holding.quantity + quantity
        const newAvg = Math.round(
          ((holding.avg_buy_price * holding.quantity) + totalAmount) / newQty
        )
        await supabase
          .from('pbs_stock_holdings')
          .update({ quantity: newQty, avg_buy_price: newAvg })
          .eq('id', holding.id)
      } else {
        await supabase.from('pbs_stock_holdings').insert({
          student_id: studentId,
          stock_name: stockName,
          stock_type: 'custom',
          quantity,
          avg_buy_price: currentPrice,
        })
      }

      await supabase.from('pbs_transactions').insert({
        student_id: studentId,
        type: 'stock_buy',
        amount: -totalAmount,
        balance_after: newBalance,
        description: `주식 매수: ${stockName} ${quantity}주 × ${currentPrice}원`,
      })

      return NextResponse.json({
        ok: true, action: 'buy', stockName, quantity,
        price: currentPrice, totalAmount, balanceAfter: newBalance,
      })
    } else if (action === 'sell') {
      if (!holding || holding.quantity < quantity) {
        return NextResponse.json({ error: '보유 수량이 부족합니다.' }, { status: 400 })
      }

      const newBalance = account.balance + totalAmount

      await supabase
        .from('pbs_accounts')
        .update({ balance: newBalance, total_earned: account.total_earned + totalAmount })
        .eq('student_id', studentId)

      const newQty = holding.quantity - quantity
      await supabase
        .from('pbs_stock_holdings')
        .update({ quantity: newQty })
        .eq('id', holding.id)

      await supabase.from('pbs_transactions').insert({
        student_id: studentId,
        type: 'stock_sell',
        amount: totalAmount,
        balance_after: newBalance,
        description: `주식 매도: ${stockName} ${quantity}주 × ${currentPrice}원`,
      })

      return NextResponse.json({
        ok: true, action: 'sell', stockName, quantity,
        price: currentPrice, totalAmount, balanceAfter: newBalance,
      })
    }

    return NextResponse.json({ error: '잘못된 매매 유형입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
