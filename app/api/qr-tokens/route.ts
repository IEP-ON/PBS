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

const MAX_DELETE_BATCH = 500

// DELETE /api/qr-tokens — 교사: 발급 토큰 일괄 삭제 (본인 학급만)
export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const rawIds = body.tokenIds
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: '삭제할 토큰을 선택해 주세요.' }, { status: 400 })
    }
    if (rawIds.length > MAX_DELETE_BATCH) {
      return NextResponse.json({ error: `한 번에 최대 ${MAX_DELETE_BATCH}개까지 삭제할 수 있습니다.` }, { status: 400 })
    }

    const tokenIds = [...new Set(rawIds.map((id: unknown) => String(id).trim()).filter(Boolean))]
    if (tokenIds.length === 0) {
      return NextResponse.json({ error: '삭제할 토큰을 선택해 주세요.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { error, count } = await supabase
      .from('pbs_qr_tokens')
      .delete({ count: 'exact' })
      .in('id', tokenIds)
      .eq('class_code_id', session.classroomId)

    if (error) {
      return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted: count ?? tokenIds.length })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
