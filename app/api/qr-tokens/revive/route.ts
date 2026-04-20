import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// POST /api/qr-tokens/revive — 교사: 사용된 QR 토큰을 미사용으로 되돌림 (실물 코인 재활용)
// 잔액·거래내역은 변경하지 않음
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    if (!code || !code.startsWith('PT:')) {
      return NextResponse.json({ error: '올바른 토큰 코드(PT:…)를 입력해 주세요.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: token, error: fetchError } = await supabase
      .from('pbs_qr_tokens')
      .select('id, code, amount, label, is_used, used_by, used_at')
      .eq('code', code)
      .eq('class_code_id', session.classroomId)
      .single()

    if (fetchError || !token) {
      return NextResponse.json({ error: '해당 토큰을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!token.is_used) {
      return NextResponse.json({ error: '이미 미사용 토큰입니다.' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('pbs_qr_tokens')
      .update({
        is_used: false,
        used_by: null,
        used_at: null,
      })
      .eq('id', token.id)
      .select('id, code, amount, label, is_used, used_at, used_by')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: '토큰 부활에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, token: updated })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
