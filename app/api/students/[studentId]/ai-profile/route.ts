import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { buildFeatureOutputs, mapStudentAiProfile, sanitizeAiProfilePayload } from '@/lib/ai-profile'

async function getOwnedStudent(studentId: string, classroomId: string) {
  const supabase = await createServerSupabase()
  const { data: student } = await supabase
    .from('pbs_students')
    .select('id, class_code_id')
    .eq('id', studentId)
    .eq('class_code_id', classroomId)
    .single()

  return { supabase, student }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId } = await params
    const { supabase, student } = await getOwnedStudent(studentId, session.classroomId)

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data } = await supabase
      .from('pbs_student_ai_profiles')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle()

    const profile = data ? mapStudentAiProfile(data as Record<string, unknown>) : null
    return NextResponse.json({ profile, featureOutputs: buildFeatureOutputs(profile) })
  } catch {
    return NextResponse.json({ error: '학생 AI 프로필 조회에 실패했습니다.' }, { status: 500 })
  }
}

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
    const { supabase, student } = await getOwnedStudent(studentId, session.classroomId)

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const body = await request.json()
    const payload = sanitizeAiProfilePayload(body.profile ?? body, {
      sourceFreeText: body.source_free_text ?? body.sourceFreeText ?? null,
      teacherVerified: body.teacher_verified ?? body.teacherVerified ?? true,
    })

    const { data, error } = await supabase
      .from('pbs_student_ai_profiles')
      .upsert(
        {
          student_id: studentId,
          class_code_id: session.classroomId,
          ...payload,
        },
        { onConflict: 'student_id' }
      )
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '학생 AI 프로필 저장에 실패했습니다.' }, { status: 500 })
    }

    const profile = mapStudentAiProfile(data as Record<string, unknown>)
    return NextResponse.json({ profile, featureOutputs: buildFeatureOutputs(profile) })
  } catch {
    return NextResponse.json({ error: '학생 AI 프로필 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
