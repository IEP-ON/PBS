import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { canWithdraw } from '@/lib/utils'

// POST /api/stocks/trade — 주식 매수/매도
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || !session.studentId) {
      return NextResponse.json({ error: '학생 인증이 필요합니다.' }, { status: 401 })
    }

    const { stockId, stockName, stockType, action, quantity } = await request.json()

    if (!stockName || !action || !quantity || quantity <= 0) {
      return NextResponse.json({ error: '종목명, 매매 방향, 수량은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 현재가 조회
    let currentPrice: number
    if (stockType === 'custom' && stockId) {
      const { data: stock } = await supabase
        .from('pbs_custom_stocks')
        .select('current_price')
        .eq('id', stockId)
        .single()
      if (!stock) return NextResponse.json({ error: '종목을 찾을 수 없습니다.' }, { status: 404 })
      currentPrice = stock.current_price
    } else {
      // 날씨 연동 주식: 오늘 시세 조회
      const today = new Date().toISOString().split('T')[0]
      const { data: price } = await supabase
        .from('pbs_stock_prices')
        .select('price')
        .eq('stock_name', stockName)
        .eq('price_date', today)
        .single()
      if (!price) return NextResponse.json({ error: '오늘 시세가 없습니다.' }, { status: 404 })
      currentPrice = price.price
    }

    const totalAmount = currentPrice * quantity

    // 계좌 조회
    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance, total_spent, total_earned')
      .eq('student_id', session.studentId)
      .single()

    if (!account) return NextResponse.json({ error: '계좌를 찾을 수 없습니다.' }, { status: 404 })

    // 보유 현황 조회
    const { data: holding } = await supabase
      .from('pbs_stock_holdings')
      .select('*')
      .eq('student_id', session.studentId)
      .eq('stock_name', stockName)
      .single()

    if (action === 'buy') {
      // 최저잔액 보호 확인
      const { data: student } = await supabase
        .from('pbs_students')
        .select('min_balance')
        .eq('id', session.studentId)
        .single()

      if (!canWithdraw(account.balance, totalAmount, student?.min_balance || 500)) {
        return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 })
      }

      const newBalance = account.balance - totalAmount

      // 계좌 차감
      await supabase
        .from('pbs_accounts')
        .update({ balance: newBalance, total_spent: account.total_spent + totalAmount })
        .eq('student_id', session.studentId)

      // 보유 현황 업데이트
      if (holding) {
        const newQuantity = holding.quantity + quantity
        const newAvg = Math.round(
          ((holding.avg_buy_price * holding.quantity) + totalAmount) / newQuantity
        )
        await supabase
          .from('pbs_stock_holdings')
          .update({ quantity: newQuantity, avg_buy_price: newAvg })
          .eq('id', holding.id)
      } else {
        await supabase.from('pbs_stock_holdings').insert({
          student_id: session.studentId,
          stock_name: stockName,
          stock_type: stockType || 'custom',
          quantity,
          avg_buy_price: currentPrice,
        })
      }

      // 거래 기록
      await supabase.from('pbs_transactions').insert({
        student_id: session.studentId,
        type: 'stock_buy',
        amount: -totalAmount,
        balance_after: newBalance,
        description: `주식 매수: ${stockName} ${quantity}주 × ${currentPrice}원`,
      })

      return NextResponse.json({
        ok: true,
        action: 'buy',
        stockName,
        quantity,
        price: currentPrice,
        totalAmount,
        balanceAfter: newBalance,
      })
    } else if (action === 'sell') {
      if (!holding || holding.quantity < quantity) {
        return NextResponse.json({ error: '보유 수량이 부족합니다.' }, { status: 400 })
      }

      const newBalance = account.balance + totalAmount

      // 계좌 입금
      await supabase
        .from('pbs_accounts')
        .update({ balance: newBalance, total_earned: account.total_earned + totalAmount })
        .eq('student_id', session.studentId)

      // 보유 현황 업데이트
      const newQuantity = holding.quantity - quantity
      if (newQuantity === 0) {
        await supabase
          .from('pbs_stock_holdings')
          .update({ quantity: 0 })
          .eq('id', holding.id)
      } else {
        await supabase
          .from('pbs_stock_holdings')
          .update({ quantity: newQuantity })
          .eq('id', holding.id)
      }

      // 거래 기록
      await supabase.from('pbs_transactions').insert({
        student_id: session.studentId,
        type: 'stock_sell',
        amount: totalAmount,
        balance_after: newBalance,
        description: `주식 매도: ${stockName} ${quantity}주 × ${currentPrice}원`,
      })

      return NextResponse.json({
        ok: true,
        action: 'sell',
        stockName,
        quantity,
        price: currentPrice,
        totalAmount,
        balanceAfter: newBalance,
        profit: (currentPrice - holding.avg_buy_price) * quantity,
      })
    }

    return NextResponse.json({ error: '잘못된 매매 유형입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
