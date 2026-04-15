import { getKstToday } from '@/lib/speech-diary'
import { createServerSupabase } from '@/lib/supabase/server'
import type {
  SupportBucketKey,
  SupportOverviewResponse,
  SupportOverviewStudentBrief,
} from '@/types'
import { classifyStudent } from './classify'

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>
type SupportProfileRow = { student_id: string; updated_at?: string | null }
type SupportFbaRow = { student_id: string; created_at?: string | null }
type SupportGoalRow = { student_id: string; daily_target: number | null; token_per_occurrence: number | null }
type SupportContractRow = { student_id: string; created_at?: string | null }
type SupportTimerRow = { student_id: string; started_at?: string | null }
type SupportAlertRow = { student_id: string; created_at?: string | null }
type SupportRecordRow = {
  student_id: string
  record_date: string
  created_at?: string | null
  token_granted: number | null
}

function getDateKeyDaysAgo(daysAgo: number) {
  const base = new Date(`${getKstToday()}T00:00:00+09:00`)
  base.setDate(base.getDate() - daysAgo)
  return base.toISOString().slice(0, 10)
}

function maxIsoDate(values: Array<string | null | undefined>) {
  const filtered = values.filter(Boolean) as string[]
  if (filtered.length === 0) return null
  return filtered.sort((a, b) => b.localeCompare(a))[0]
}

function createBucketMap(): Record<SupportBucketKey, SupportOverviewStudentBrief[]> {
  return {
    uncategorized: [],
    planNeeded: [],
    executing: [],
    reviewNeeded: [],
  }
}

export async function getSupportOverview(
  supabase: ServerSupabase,
  classroomId: string
): Promise<SupportOverviewResponse> {
  const { data: students } = await supabase
    .from('pbs_students')
    .select('id, name')
    .eq('class_code_id', classroomId)
    .eq('is_active', true)
    .order('name')

  if (!students || students.length === 0) {
    return {
      buckets: createBucketMap(),
      stats: {
        totalStudents: 0,
        activeContracts: 0,
        runningDroTimers: 0,
        unresolvedAlerts: 0,
      },
    }
  }

  const studentIds = students.map((student: { id: string }) => student.id)
  const fourteenDayKey = getDateKeyDaysAgo(13)
  const sevenDayKey = getDateKeyDaysAgo(6)

  const [
    { data: profiles },
    { data: fbaRecords },
    { data: goals },
    { data: contracts },
    { data: timers },
    { data: alerts },
    { data: records },
  ] = await Promise.all([
    supabase
      .from('pbs_student_ai_profiles')
      .select('student_id, updated_at')
      .in('student_id', studentIds),
    supabase
      .from('pbs_fba_records')
      .select('student_id, created_at')
      .in('student_id', studentIds),
    supabase
      .from('pbs_goals')
      .select('student_id, daily_target, token_per_occurrence')
      .in('student_id', studentIds)
      .eq('is_active', true),
    supabase
      .from('pbs_behavior_contracts')
      .select('student_id, created_at')
      .in('student_id', studentIds)
      .eq('is_active', true),
    supabase
      .from('pbs_dro_timers')
      .select('student_id, started_at')
      .in('student_id', studentIds)
      .eq('status', 'running'),
    supabase
      .from('pbs_extinction_alerts')
      .select('student_id, created_at')
      .in('student_id', studentIds)
      .eq('is_resolved', false),
    supabase
      .from('pbs_records')
      .select('student_id, record_date, created_at, token_granted')
      .in('student_id', studentIds)
      .gte('record_date', fourteenDayKey),
  ])

  const profileMap = new Map((profiles as SupportProfileRow[] | null | undefined || []).map((profile) => [profile.student_id, profile]))

  const groupByStudent = <T extends { student_id: string }>(rows: T[] | null | undefined) => {
    const map = new Map<string, T[]>()
    for (const row of rows || []) {
      const current = map.get(row.student_id) || []
      current.push(row)
      map.set(row.student_id, current)
    }
    return map
  }

  const fbaByStudent = groupByStudent(fbaRecords as SupportFbaRow[] | null | undefined)
  const goalsByStudent = groupByStudent(goals as SupportGoalRow[] | null | undefined)
  const contractsByStudent = groupByStudent(contracts as SupportContractRow[] | null | undefined)
  const timersByStudent = groupByStudent(timers as SupportTimerRow[] | null | undefined)
  const alertsByStudent = groupByStudent(alerts as SupportAlertRow[] | null | undefined)
  const recordsByStudent = groupByStudent(records as SupportRecordRow[] | null | undefined)

  const buckets = createBucketMap()

  for (const student of students as Array<{ id: string; name: string }>) {
    const studentFba = (fbaByStudent.get(student.id) || []) as SupportFbaRow[]
    const studentGoals = (goalsByStudent.get(student.id) || []) as SupportGoalRow[]
    const studentContracts = (contractsByStudent.get(student.id) || []) as SupportContractRow[]
    const studentTimers = (timersByStudent.get(student.id) || []) as SupportTimerRow[]
    const studentAlerts = (alertsByStudent.get(student.id) || []) as SupportAlertRow[]
    const studentRecords = (recordsByStudent.get(student.id) || []) as SupportRecordRow[]

    const fourteenDayTokenTotal = studentRecords.reduce((sum, record) => sum + (record.token_granted || 0), 0)
    const sevenDayTokenTotal = studentRecords
      .filter((record) => record.record_date >= sevenDayKey)
      .reduce((sum, record) => sum + (record.token_granted || 0), 0)
    const activeDailyTargetTokenTotal = studentGoals.reduce((sum, goal) => {
      if (!goal.daily_target || goal.daily_target <= 0) return sum
      return sum + goal.daily_target * (goal.token_per_occurrence || 0)
    }, 0)

    const latestRecordAt = maxIsoDate(studentRecords.map((record) => record.created_at || null))
    const latestFbaAt = maxIsoDate(studentFba.map((record) => record.created_at || null))
    const latestContractAt = maxIsoDate(studentContracts.map((record) => record.created_at || null))
    const latestDroAt = maxIsoDate(studentTimers.map((record) => record.started_at || null))
    const latestAlertAt = maxIsoDate(studentAlerts.map((record) => record.created_at || null))
    const latestProfileAt = profileMap.get(student.id)?.updated_at || null

    const brief = classifyStudent({
      id: student.id,
      name: student.name,
      hasAiProfile: profileMap.has(student.id),
      fbaCount: studentFba.length,
      activeGoalCount: studentGoals.length,
      activeContractCount: studentContracts.length,
      runningDroCount: studentTimers.length,
      unresolvedAlertCount: studentAlerts.length,
      fourteenDayTokenTotal,
      sevenDayAverageTokens: sevenDayTokenTotal / 7,
      activeDailyTargetTokenTotal,
      lastActivityAt: maxIsoDate([
        latestRecordAt,
        latestFbaAt,
        latestContractAt,
        latestDroAt,
        latestAlertAt,
        latestProfileAt,
      ]),
    })

    buckets[brief.currentBucket].push(brief)
  }

  for (const key of Object.keys(buckets) as SupportBucketKey[]) {
    buckets[key] = buckets[key].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
  }

  return {
    buckets,
    stats: {
      totalStudents: students.length,
      activeContracts: (contracts || []).length,
      runningDroTimers: (timers || []).length,
      unresolvedAlerts: (alerts || []).length,
    },
  }
}
