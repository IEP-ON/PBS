import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/shop/items — 가게 아이템 목록 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    const { data: items, error } = await supabase
      .from('pbs_shop_items')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '아이템 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ items: items || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/shop/items — 가게 아이템 등록 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { name, category, price, stock, isGiftable, emoji } = await request.json()

    if (!name || !price) {
      return NextResponse.json({ error: '아이템명과 가격은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: item, error } = await supabase
      .from('pbs_shop_items')
      .insert({
        class_code_id: session.classroomId,
        name,
        category: category || 'activity',
        price: Number(price),
        stock: stock != null ? Number(stock) : null,
        is_giftable: isGiftable !== false,
        emoji: emoji || '🎁',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '아이템 등록 실패' }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
