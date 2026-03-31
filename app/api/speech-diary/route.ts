import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/speech-diary?studentId=...
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    const supabase = await createServerSupabase()
    let studentQuery = supabase
      .from('pbs_students')
      .select('id, name')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('name')

    if (studentId) {
      studentQuery = studentQuery.eq('id', studentId)
    }

    const { data: students, error: studentError } = await studentQuery
    if (studentError) {
      return NextResponse.json({ error: '학생 목록 조회에 실패했습니다.' }, { status: 500 })
    }

    const studentIds = (students || []).map((student) => student.id)
    if (studentIds.length === 0) {
      return NextResponse.json({ diaries: [], students: students || [] })
    }

    const { data: diaries, error } = await supabase
      .from('pbs_speech_diaries')
      .select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '말 일기 조회에 실패했습니다.' }, { status: 500 })
    }

    const studentMap = new Map((students || []).map((student) => [student.id, student.name]))
    const enriched = (diaries || []).map((diary) => ({
      ...diary,
      student_name: studentMap.get(diary.student_id) || '이름 없음',
    }))

    return NextResponse.json({
      diaries: enriched,
      students: students || [],
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
