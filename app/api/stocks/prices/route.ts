import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/stocks/prices — 주식 시세 이력 조회
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stockId = searchParams.get('stockId')
    const days = parseInt(searchParams.get('days') || '7')

    if (!stockId) {
      return NextResponse.json({ error: '주식 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)

    const { data: prices } = await supabase
      .from('pbs_stock_prices')
      .select('price, recorded_at')
      .eq('stock_id', stockId)
      .gte('recorded_at', daysAgo.toISOString())
      .order('recorded_at', { ascending: true })

    return NextResponse.json({ prices: prices || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/stocks/prices — 주식 시세 기록 (크론 작업용)
export async function POST(request: Request) {
  try {
    const { cronSecret } = await request.json()

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    // 모든 커스텀 주식의 현재 가격 조회
    const { data: stocks } = await supabase
      .from('pbs_custom_stocks')
      .select('id, current_price')
      .eq('is_active', true)

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ message: '활성 주식 없음', recorded: 0 })
    }

    // 각 주식의 현재 가격을 pbs_stock_prices에 기록
    const priceRecords = stocks.map(stock => ({
      stock_id: stock.id,
      price: stock.current_price,
    }))

    const { error } = await supabase
      .from('pbs_stock_prices')
      .insert(priceRecords)

    if (error) {
      return NextResponse.json({ error: '가격 기록 실패' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: '주식 가격 기록 완료',
      recorded: priceRecords.length,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
