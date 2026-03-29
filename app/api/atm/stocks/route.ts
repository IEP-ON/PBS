import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/atm/stocks?classCode=...&studentId=... — ATM: 주식 목록 + 보유현황 (세션 없이)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classCode = searchParams.get('classCode')
    const studentId = searchParams.get('studentId')

    if (!classCode) {
      return NextResponse.json({ error: '학급코드가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '학급코드가 올바르지 않습니다.' }, { status: 401 })
    }

    const { data: stocks } = await supabase
      .from('pbs_custom_stocks')
      .select('id, name, emoji, current_price, description')
      .eq('class_code_id', classroom.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // 보유현황 (studentId가 있을 때)
    let holdings: { stock_name: string; quantity: number; avg_buy_price: number }[] = []
    if (studentId) {
      const { data } = await supabase
        .from('pbs_stock_holdings')
        .select('stock_name, quantity, avg_buy_price')
        .eq('student_id', studentId)
        .gt('quantity', 0)
      holdings = data || []
    }

    return NextResponse.json({ stocks: stocks || [], holdings })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
