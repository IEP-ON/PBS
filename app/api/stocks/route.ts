import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/stocks — 커스텀 주식 목록 + 최근 주가
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    const { data: stocks } = await supabase
      .from('pbs_custom_stocks')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // 각 종목의 최근 5일 주가 이력
    const stocksWithHistory = await Promise.all(
      (stocks || []).map(async (stock) => {
        const { data: prices } = await supabase
          .from('pbs_custom_stock_prices')
          .select('price, previous_price, price_date, adjustment_type')
          .eq('stock_id', stock.id)
          .order('price_date', { ascending: false })
          .limit(5)

        return { ...stock, priceHistory: prices || [] }
      })
    )

    return NextResponse.json({ stocks: stocksWithHistory })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/stocks — 커스텀 주식 종목 등록 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { name, emoji, description, currentPrice, namedBy } = await request.json()

    if (!name || !currentPrice) {
      return NextResponse.json({ error: '종목명과 초기 가격은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: stock, error } = await supabase
      .from('pbs_custom_stocks')
      .insert({
        class_code_id: session.classroomId,
        name,
        emoji: emoji || '🎲',
        description: description || null,
        current_price: Number(currentPrice),
        named_by: namedBy || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '종목 등록 실패' }, { status: 500 })
    }

    // 초기 주가 기록
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('pbs_custom_stock_prices').insert({
      stock_id: stock.id,
      price_date: today,
      price: Number(currentPrice),
      previous_price: null,
      adjustment_type: 'manual_input',
    })

    return NextResponse.json({ stock })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
