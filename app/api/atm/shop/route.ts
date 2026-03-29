import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/atm/shop?classCode=... — ATM: 상점 아이템 조회 (세션 없이)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classCode = searchParams.get('classCode')

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

    const { data: items } = await supabase
      .from('pbs_shop_items')
      .select('id, name, emoji, price, stock, category')
      .eq('class_code_id', classroom.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    return NextResponse.json({ items: items || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
