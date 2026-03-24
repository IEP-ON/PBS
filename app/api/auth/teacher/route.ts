import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

// POST /api/auth/teacher — 교사 로그인
export async function POST(request: Request) {
  try {
    const { classCode, teacherPin } = await request.json()

    if (!classCode || !teacherPin) {
      return NextResponse.json({ error: '학급코드와 PIN을 입력해주세요.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: classroom, error } = await supabase
      .from('pbs_class_codes')
      .select('*')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (error || !classroom) {
      return NextResponse.json({ error: '학급코드를 확인해주세요.' }, { status: 401 })
    }

    const pinMatch = await bcrypt.compare(teacherPin, classroom.teacher_pin_hash)
    if (!pinMatch) {
      return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
    }

    const session = await getSession()
    session.role = 'teacher'
    session.classCode = classroom.code
    session.classroomId = classroom.id
    await session.save()

    return NextResponse.json({ ok: true, classCode: classroom.code })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
