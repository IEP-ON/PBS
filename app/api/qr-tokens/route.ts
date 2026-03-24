import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { randomUUID } from 'crypto'

// GET /api/qr-tokens — 교사: QR 토큰 목록 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()

    const { data, error } = await supabase
      .from('pbs_qr_tokens')
      .select('*, pbs_students(name)')
      .eq('class_code_id', session.classroomId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ tokens: data || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// POST /api/qr-tokens — 교사: QR 토큰 배치 생성
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { amount, count, label } = await request.json()

    if (!amount || amount <= 0 || !count || count <= 0 || count > 200) {
      return NextResponse.json({ error: '금액과 개수를 올바르게 입력하세요. (최대 200개)' }, { status: 400 })
    }

    const tokens = Array.from({ length: count }, () => ({
      class_code_id: session.classroomId,
      code: 'PT:' + randomUUID(),
      amount,
      label: label || `${amount}원 토큰`,
    }))

    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from('pbs_qr_tokens')
      .insert(tokens)
      .select()

    if (error) {
      return NextResponse.json({ error: '토큰 생성 실패' }, { status: 500 })
    }

    return NextResponse.json({ tokens: data, count: data?.length })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
