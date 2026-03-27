import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

export interface TeachGoal {
  id: string
  behavior_name: string
  token_per_occurrence: number
  daily_target: number | null
  todayCount: number
}

export interface TeachTimer {
  id: string
  ends_at: string
  started_at: string
  reset_count: number
  goal_name: string
  duration_ms: number
}

export interface TeachStudent {
  id: string
  name: string
  pbs_stage: number
  balance: number
  todayTokens: number
  pendingTokens: number
  goals: TeachGoal[]
  activeTimer: TeachTimer | null
}

// GET /api/teach/summary — 수업 모드용 전체 학급 현황 (원콜)
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()
    const today = new Date().toISOString().split('T')[0]

    const [studentsRes, goalsRes, timersRes] = await Promise.all([
      supabase
        .from('pbs_students')
        .select('id, name, pbs_stage, pbs_accounts(balance)')
        .eq('class_code_id', session.classroomId)
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('pbs_goals')
        .select('id, student_id, behavior_name, token_per_occurrence, daily_target')
        .eq('class_code_id', session.classroomId)
        .eq('is_active', true)
        .order('created_at'),

      supabase
        .from('pbs_dro_timers')
        .select('id, student_id, goal_id, started_at, ends_at, reset_count, pbs_goals(behavior_name)')
        .eq('status', 'running')
        .order('started_at', { ascending: false }),
    ])

    const students = studentsRes.data || []
    const goals = goalsRes.data || []
    const timers = timersRes.data || []

    if (students.length === 0) {
      return NextResponse.json({ students: [] })
    }

    const studentIds = students.map(s => s.id)

    // 오늘 모든 학생 PBS 기록
    const { data: records } = await supabase
      .from('pbs_records')
      .select('student_id, goal_id, occurrence_count, token_granted, is_settled')
      .eq('record_date', today)
      .in('student_id', studentIds)

    const allRecords = records || []

    const result: TeachStudent[] = students.map(student => {
      const account = Array.isArray(student.pbs_accounts)
        ? student.pbs_accounts[0]
        : student.pbs_accounts

      const studentGoals = goals.filter(g => g.student_id === student.id)
      const studentRecords = allRecords.filter(r => r.student_id === student.id)

      const todayTokens = studentRecords.reduce((sum, r) => sum + r.token_granted, 0)
      const pendingTokens = studentRecords
        .filter(r => !r.is_settled)
        .reduce((sum, r) => sum + r.token_granted, 0)

      const goalsWithProgress: TeachGoal[] = studentGoals.map(g => {
        const goalRecords = studentRecords.filter(r => r.goal_id === g.id)
        const todayCount = goalRecords.reduce((sum, r) => sum + r.occurrence_count, 0)
        return { ...g, todayCount }
      })

      // 해당 학생의 실행 중 DRO (가장 최근 1개)
      const timer = timers.find(t => t.student_id === student.id) || null
      const activeTimer: TeachTimer | null = timer
        ? {
            id: timer.id,
            ends_at: timer.ends_at,
            started_at: timer.started_at,
            reset_count: timer.reset_count,
            goal_name: (() => {
              const g = timer.pbs_goals as unknown
              if (!g) return ''
              if (Array.isArray(g)) return (g[0] as { behavior_name: string })?.behavior_name || ''
              return (g as { behavior_name: string }).behavior_name || ''
            })(),
            duration_ms:
              new Date(timer.ends_at).getTime() - new Date(timer.started_at).getTime(),
          }
        : null

      return {
        id: student.id,
        name: student.name,
        pbs_stage: student.pbs_stage,
        balance: account?.balance || 0,
        todayTokens,
        pendingTokens,
        goals: goalsWithProgress,
        activeTimer,
      }
    })

    return NextResponse.json({ students: result })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
