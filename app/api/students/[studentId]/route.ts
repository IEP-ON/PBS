import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

// GET /api/students/[studentId] — 학생 상세 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { studentId } = await params
    const supabase = await createServerSupabase()

    const { data: student, error } = await supabase
      .from('pbs_students')
      .select('*, pbs_accounts(*)')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (error || !student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ student, account: student.pbs_accounts })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/students/[studentId] — 학생 정보 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId } = await params
    const body = await request.json()
    const supabase = await createServerSupabase()

    // PIN 변경 시 해시 처리
    const updateData: Record<string, unknown> = { ...body }
    if (body.pin) {
      updateData.pin_hash = await bcrypt.hash(body.pin, 10)
      delete updateData.pin
    }

    const { data: student, error } = await supabase
      .from('pbs_students')
      .update(updateData)
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '학생 정보 수정에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ student })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
