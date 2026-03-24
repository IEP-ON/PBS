import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

// POST /api/atm/login — ATM: 학생 인증 (세션 없이)
// 이름+PIN 방식 또는 통장QR+PIN 방식
export async function POST(request: Request) {
  try {
    const { classCode, studentName, studentPin, passbookQrCode } = await request.json()

    if (!classCode || !studentPin) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }
    if (!studentName && !passbookQrCode) {
      return NextResponse.json({ error: '이름 또는 통장 QR이 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학급 확인
    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '학급코드가 올바르지 않습니다.' }, { status: 401 })
    }

    // 학생 조회 (이름 또는 통장 QR)
    let studentQuery = supabase
      .from('pbs_students')
      .select('id, name, pin_hash')
      .eq('class_code_id', classroom.id)
      .eq('is_active', true)

    if (passbookQrCode) {
      studentQuery = studentQuery.eq('passbook_qr_code', passbookQrCode)
    } else {
      studentQuery = studentQuery.eq('name', studentName)
    }

    const { data: student } = await studentQuery.single()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 확인해주세요.' }, { status: 401 })
    }

    // PIN 검증
    const pinMatch = await bcrypt.compare(studentPin, student.pin_hash)
    if (!pinMatch) {
      return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
    }

    // 잔액 조회
    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance')
      .eq('student_id', student.id)
      .single()

    return NextResponse.json({
      ok: true,
      studentId: student.id,
      studentName: student.name,
      balance: account?.balance ?? 0,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
