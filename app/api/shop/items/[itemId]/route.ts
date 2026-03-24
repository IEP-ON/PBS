import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// PATCH /api/shop/items/[itemId] — 아이템 수정 (교사 전용)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { itemId } = await params
    const body = await request.json()

    const allowedFields: Record<string, string> = {
      name: 'name',
      category: 'category',
      price: 'price',
      stock: 'stock',
      isGiftable: 'is_giftable',
      emoji: 'emoji',
      isActive: 'is_active',
    }

    const updateData: Record<string, unknown> = {}
    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        updateData[col] = body[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: item, error } = await supabase
      .from('pbs_shop_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('class_code_id', session.classroomId)
      .select()
      .single()

    if (error || !item) {
      return NextResponse.json({ error: '아이템 수정 실패' }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
