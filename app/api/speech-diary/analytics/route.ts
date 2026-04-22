import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { withStudentRosterOrder } from '@/lib/student-roster-order'
import { buildSpeechDiaryAnalytics, type SpeechDiaryRow } from '@/lib/speech-diary/analytics'

// GET /api/speech-diary/analytics — 교사: 학급 말 일기 집계
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()

    const { data: students, error: studentError } = await withStudentRosterOrder(
      supabase
        .from('pbs_students')
        .select('id, name')
        .eq('class_code_id', session.classroomId)
        .eq('is_active', true)
    )

    if (studentError) {
      return NextResponse.json({ error: '학생 목록을 불러오지 못했습니다.' }, { status: 500 })
    }

    const studentIds = (students || []).map((s) => s.id)
    if (studentIds.length === 0) {
      return NextResponse.json(buildSpeechDiaryAnalytics([], []))
    }

    const { data: diaries, error } = await supabase
      .from('pbs_speech_diaries')
      .select(
        'id, student_id, raw_transcript, corrected_text, sentiment, keywords, created_at, duration_seconds'
      )
      .in('student_id', studentIds)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: '말 일기를 불러오지 못했습니다.' }, { status: 500 })
    }

    const analytics = buildSpeechDiaryAnalytics(
      (diaries || []) as SpeechDiaryRow[],
      (students || []).map((s) => ({ id: s.id, name: s.name }))
    )

    return NextResponse.json(analytics)
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
