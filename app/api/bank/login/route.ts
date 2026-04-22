import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getBankSession } from '@/lib/bank-session'
import { normalizeClassCode } from '@/lib/utils'
import bcrypt from 'bcryptjs'

// POST /api/bank/login — 기기 토큰 + PIN으로 뱅킹 세션 생성
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const classCode = normalizeClassCode(body.classCode)
    const studentName = body.studentName?.trim()
    const studentPin = body.studentPin?.toString().trim()
    const deviceToken = body.deviceToken?.toString().trim()

    if (!classCode || !studentName || !studentPin || !deviceToken) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id')
      .eq('code', classCode)
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '학급 코드를 확인해 주세요.' }, { status: 401 })
    }

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, pin_hash')
      .eq('class_code_id', classroom.id)
      .eq('name', studentName)
      .eq('is_active', true)
      .maybeSingle()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 확인해 주세요.' }, { status: 401 })
    }

    const pinMatch = await bcrypt.compare(studentPin, student.pin_hash)
    if (!pinMatch) {
      return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
    }

    const { data: devices } = await supabase
      .from('pbs_bank_devices')
      .select('id, token_hash')
      .eq('student_id', student.id)
      .is('revoked_at', null)

    let matched = false
    for (const row of devices || []) {
      const ok = await bcrypt.compare(deviceToken, row.token_hash)
      if (ok) {
        matched = true
        await supabase
          .from('pbs_bank_devices')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', row.id)
        break
      }
    }

    if (!matched) {
      return NextResponse.json({ error: '등록된 기기가 아닙니다. 기기 등록을 다시 해 주세요.' }, { status: 401 })
    }

    const session = await getBankSession()
    session.studentId = student.id
    session.classCode = classCode
    session.studentName = student.name
    await session.save()

    return NextResponse.json({ ok: true, studentName: student.name })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
