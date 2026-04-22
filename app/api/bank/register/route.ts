import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { normalizeClassCode } from '@/lib/utils'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

// POST /api/bank/register — 기기 최초 등록: 학급·이름·PIN 검증 후 기기 토큰 발급
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const classCode = normalizeClassCode(body.classCode)
    const studentName = body.studentName?.trim()
    const studentPin = body.studentPin?.toString().trim()

    if (!classCode || !studentName || !studentPin) {
      return NextResponse.json({ error: '학급 코드, 이름, PIN을 입력해 주세요.' }, { status: 400 })
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

    await supabase
      .from('pbs_bank_devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('student_id', student.id)
      .is('revoked_at', null)

    const deviceToken = `BK-${randomUUID()}${randomUUID()}`.replace(/-/g, '')
    const tokenHash = await bcrypt.hash(deviceToken, 10)

    const { error: insertError } = await supabase.from('pbs_bank_devices').insert({
      student_id: student.id,
      token_hash: tokenHash,
    })

    if (insertError) {
      return NextResponse.json({ error: '기기 등록에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deviceToken,
      studentId: student.id,
      studentName: student.name,
      classCode,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
