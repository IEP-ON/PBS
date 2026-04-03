import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/tv/rankings — TV 순위판용 학생 잔액 + 가게 + 주식 현황
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()
    const today = new Date().toISOString().split('T')[0]

    const [{ data: classroom }, { data: students }, { data: shopItems }, { data: stocks }] = await Promise.all([
      supabase
        .from('pbs_class_codes')
        .select('class_name')
        .eq('id', session.classroomId)
        .single(),
      supabase
        .from('pbs_students')
        .select('id, name, pbs_stage, pbs_accounts(balance)')
        .eq('class_code_id', session.classroomId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('pbs_shop_items')
        .select('id, name, emoji, price, stock, category')
        .eq('class_code_id', session.classroomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('pbs_custom_stocks')
        .select('id, name, emoji, current_price, description')
        .eq('class_code_id', session.classroomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ])

    if (!students) {
      return NextResponse.json({
        rankings: [],
        className: classroom?.class_name || '',
        shopItems: shopItems || [],
        stocks: [],
      })
    }

    // 오늘 획득 토큰 (학생별)
    const { data: todayRecords } = await supabase
      .from('pbs_records')
      .select('student_id, token_granted')
      .eq('record_date', today)
      .in('student_id', students.map(s => s.id))

    const todayMap: Record<string, number> = {}
    for (const rec of todayRecords || []) {
      todayMap[rec.student_id] = (todayMap[rec.student_id] || 0) + rec.token_granted
    }

    const rankings = students.map(s => {
      const account = Array.isArray(s.pbs_accounts) ? s.pbs_accounts[0] : s.pbs_accounts
      return {
        id: s.id,
        name: s.name,
        pbs_stage: s.pbs_stage,
        balance: account?.balance || 0,
        todayEarned: todayMap[s.id] || 0,
        rank: 0,
      }
    })

    const stockSnapshots = await Promise.all(
      (stocks || []).map(async (stock) => {
        const { data: latestPrice } = await supabase
          .from('pbs_custom_stock_prices')
          .select('previous_price, price_date, adjustment_type')
          .eq('stock_id', stock.id)
          .order('price_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          id: stock.id,
          name: stock.name,
          emoji: stock.emoji,
          current_price: stock.current_price,
          description: stock.description,
          previous_price: latestPrice?.previous_price ?? null,
          price_date: latestPrice?.price_date ?? null,
          adjustment_type: latestPrice?.adjustment_type ?? null,
        }
      })
    )

    return NextResponse.json({
      rankings,
      className: classroom?.class_name || '',
      shopItems: shopItems || [],
      stocks: stockSnapshots,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
