import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

// POST /api/auth/student — 학생 로그인
export async function POST(request: Request) {
  try {
    const { classCode, studentName, studentPin } = await request.json()

    if (!classCode || !studentName || !studentPin) {
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학급 확인
    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id, code')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '학급코드를 확인해주세요.' }, { status: 401 })
    }

    // 학생 확인
    const { data: student } = await supabase
      .from('pbs_students')
      .select('*')
      .eq('class_code_id', classroom.id)
      .eq('name', studentName)
      .eq('is_active', true)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 확인해주세요.' }, { status: 401 })
    }

    const pinMatch = await bcrypt.compare(studentPin, student.pin_hash)
    if (!pinMatch) {
      return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
    }

    const session = await getSession()
    session.role = 'student'
    session.classCode = classroom.code
    session.classroomId = classroom.id
    session.studentId = student.id
    session.studentName = student.name
    await session.save()

    return NextResponse.json({
      ok: true,
      studentId: student.id,
      classCode: classroom.code,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
