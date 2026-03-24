import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// PATCH /api/stocks/[stockId] — 주가 조정 (교사 전용)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stockId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { stockId } = await params
    const { adjustmentType, newPrice, teacherNote } = await request.json()

    const supabase = await createServerSupabase()

    // 현재 종목 조회
    const { data: stock } = await supabase
      .from('pbs_custom_stocks')
      .select('*')
      .eq('id', stockId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!stock) {
      return NextResponse.json({ error: '종목을 찾을 수 없습니다.' }, { status: 404 })
    }

    const previousPrice = stock.current_price
    let calculatedPrice: number

    switch (adjustmentType) {
      case 'manual_input':
        calculatedPrice = Number(newPrice)
        break
      case 'surge': // 폭등 ×2~3
        calculatedPrice = Math.round(previousPrice * (2 + Math.random()))
        break
      case 'rise': // 상승 ×1.2~1.5
        calculatedPrice = Math.round(previousPrice * (1.2 + Math.random() * 0.3))
        break
      case 'flat': // 보합
        calculatedPrice = previousPrice
        break
      case 'fall': // 하락 ×0.7~0.8
        calculatedPrice = Math.round(previousPrice * (0.7 + Math.random() * 0.1))
        break
      case 'crash': // 폭락 ×0.3~0.5
        calculatedPrice = Math.round(previousPrice * (0.3 + Math.random() * 0.2))
        break
      default:
        return NextResponse.json({ error: '잘못된 조정 유형입니다.' }, { status: 400 })
    }

    if (calculatedPrice < 1) calculatedPrice = 1

    // 현재가 업데이트
    await supabase
      .from('pbs_custom_stocks')
      .update({ current_price: calculatedPrice })
      .eq('id', stockId)

    // 주가 이력 기록
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('pbs_custom_stock_prices').upsert(
      {
        stock_id: stockId,
        price_date: today,
        price: calculatedPrice,
        previous_price: previousPrice,
        adjustment_type: adjustmentType,
        teacher_note: teacherNote || null,
      },
      { onConflict: 'stock_id,price_date' }
    )

    return NextResponse.json({
      stock: { ...stock, current_price: calculatedPrice },
      previousPrice,
      newPrice: calculatedPrice,
      adjustmentType,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
