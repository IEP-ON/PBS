import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  getKstDateRange,
  getKstToday,
  SPEECH_DIARY_REWARD_TYPE,
} from '@/lib/speech-diary'
import type { SpeechDiaryStatus } from '@/types'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedStudentId = searchParams.get('studentId')?.trim()

    if (session.role === 'student' && requestedStudentId && requestedStudentId !== session.studentId) {
      return NextResponse.json({ error: '다른 학생 정보는 조회할 수 없습니다.' }, { status: 403 })
    }

    const targetStudentId = session.role === 'student' ? session.studentId : requestedStudentId
    const supabase = await createServerSupabase()

    let studentQuery = supabase
      .from('pbs_students')
      .select('id, name')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('name')

    if (targetStudentId) {
      studentQuery = studentQuery.eq('id', targetStudentId)
    }

    const { data: students, error: studentError } = await studentQuery
    if (studentError) {
      return NextResponse.json({ error: '학생 목록 조회에 실패했습니다.' }, { status: 500 })
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        date: getKstToday(),
        statuses: [],
        status: null,
      })
    }

    const studentIds = students.map((student) => student.id)
    const today = getKstToday()
    const { startIso, endIso } = getKstDateRange(today)

    const [{ data: diaries, error: diaryError }, { data: rewards, error: rewardError }] = await Promise.all([
      supabase
        .from('pbs_speech_diaries')
        .select('student_id, created_at, sentiment')
        .in('student_id', studentIds)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('pbs_transactions')
        .select('student_id')
        .eq('type', SPEECH_DIARY_REWARD_TYPE)
        .in('student_id', studentIds)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
    ])

    if (diaryError || rewardError) {
      return NextResponse.json({ error: '말 일기 상태 조회에 실패했습니다.' }, { status: 500 })
    }

    const rewardStudentIds = new Set((rewards || []).map((reward) => reward.student_id))
    const diaryMap = new Map<string, { count: number; latestAt: string | null; latestSentiment: SpeechDiaryStatus['latest_sentiment'] }>()

    for (const diary of diaries || []) {
      const current = diaryMap.get(diary.student_id)
      if (!current) {
        diaryMap.set(diary.student_id, {
          count: 1,
          latestAt: diary.created_at,
          latestSentiment: diary.sentiment,
        })
        continue
      }

      diaryMap.set(diary.student_id, {
        count: current.count + 1,
        latestAt: current.latestAt,
        latestSentiment: current.latestSentiment,
      })
    }

    const statuses: SpeechDiaryStatus[] = students.map((student) => {
      const diary = diaryMap.get(student.id)
      return {
        student_id: student.id,
        student_name: student.name,
        has_today_diary: Boolean(diary),
        diary_count_today: diary?.count || 0,
        reward_granted_today: rewardStudentIds.has(student.id),
        latest_diary_at: diary?.latestAt || null,
        latest_sentiment: diary?.latestSentiment || null,
      }
    })

    return NextResponse.json({
      date: today,
      statuses,
      status: targetStudentId ? statuses[0] || null : null,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
