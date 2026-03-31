import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

// POST /api/atm/login — ATM: 학생 인증 (세션 없이)
// 문서 스펙 기준: QR 스캔은 PIN 없이 즉시 로그인, 이름 입력은 PIN 필요
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const classCode = body.classCode?.trim()
    const studentName = body.studentName?.trim()
    const studentPin = body.studentPin?.toString().trim()
    const qrCode = body.qrCode?.trim() || body.passbookQrCode?.trim()

    if (!classCode) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }
    if (!studentName && !qrCode) {
      return NextResponse.json({ error: '이름 또는 QR 코드가 필요합니다.' }, { status: 400 })
    }
    if (studentName && !studentPin) {
      return NextResponse.json({ error: 'PIN이 필요합니다.' }, { status: 400 })
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

    if (qrCode) {
      studentQuery = studentQuery.eq('qr_code', qrCode)
    } else {
      studentQuery = studentQuery.eq('name', studentName)
    }

    const { data: student } = await studentQuery.single()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 확인해주세요.' }, { status: 401 })
    }

    // 이름 입력 로그인일 때만 PIN 검증
    if (!qrCode) {
      const pinMatch = await bcrypt.compare(studentPin, student.pin_hash)
      if (!pinMatch) {
        return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
      }
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
