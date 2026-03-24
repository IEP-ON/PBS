import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/accounts/[studentId]/transactions — 거래내역 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { studentId } = await params

    if (session.role === 'student' && session.studentId !== studentId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type')

    const supabase = await createServerSupabase()

    // 주식 보유 현황 조회
    if (type === 'holdings') {
      const { data: holdings } = await supabase
        .from('pbs_stock_holdings')
        .select('stock_name, stock_type, quantity, avg_buy_price')
        .eq('student_id', studentId)

      return NextResponse.json({ holdings: holdings || [] })
    }

    let query = supabase
      .from('pbs_transactions')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: '거래내역 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ transactions: data || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
