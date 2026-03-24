import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/atm/balance?studentId=...&classCode=... — ATM: 잔액 조회 (세션 없이)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const classCode = searchParams.get('classCode')

    if (!studentId || !classCode) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학생이 해당 학급에 속하는지 확인
    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '잘못된 접근입니다.' }, { status: 401 })
    }

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name')
      .eq('id', studentId)
      .eq('class_code_id', classroom.id)
      .eq('is_active', true)
      .single()

    if (!student) {
      return NextResponse.json({ error: '잘못된 접근입니다.' }, { status: 401 })
    }

    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance')
      .eq('student_id', studentId)
      .single()

    return NextResponse.json({ balance: account?.balance ?? 0 })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
