import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { mapStudentAiProfile } from '@/lib/ai-profile'
import { classifyStudent } from '@/lib/support/classify'
import { getKstToday } from '@/lib/speech-diary'
import type {
  SupportWorkspace,
  SupportWorkspaceAssessmentRecord,
  SupportWorkspaceAlert,
  SupportWorkspaceContractSummary,
  SupportWorkspaceDroTimer,
  SupportWorkspaceIntervention,
  SupportWorkspaceTodayReinforcement,
  SupportWorkspaceTrendPoint,
} from '@/types'

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
    const supabase = await createServerSupabase()

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, grade, pbs_stage')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .maybeSingle()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const today = getKstToday()
    const fourteenDayKey = getDateKeyDaysAgo(13)

    const [
      { data: aiProfileRow },
      { data: fbaRecords },
      { data: goals },
      { data: contractRows },
      { data: runningDroRows },
      { data: todayRecords },
      { data: reviewRecords },
      { data: alertRows },
    ] = await Promise.all([
      supabase
        .from('pbs_student_ai_profiles')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle(),
      supabase
        .from('pbs_fba_records')
        .select('id, behavior_description, estimated_function, confidence, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('pbs_goals')
        .select('id, behavior_name, behavior_definition, token_per_occurrence, daily_target, strategy_type')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('pbs_behavior_contracts')
        .select('id, contract_title, target_behavior, achievement_criteria, reward_amount, is_active, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      supabase
        .from('pbs_dro_timers')
        .select('id, goal_id, started_at, ends_at, reset_count, status, pbs_goals(behavior_name, token_per_occurrence)')
        .eq('student_id', studentId)
        .eq('status', 'running')
        .order('started_at', { ascending: false }),
      supabase
        .from('pbs_records')
        .select('goal_id, occurrence_count, token_granted, pbs_goals(behavior_name, daily_target)')
        .eq('student_id', studentId)
        .eq('record_date', today),
      supabase
        .from('pbs_records')
        .select('record_date, created_at, occurrence_count, token_granted')
        .eq('student_id', studentId)
        .gte('record_date', fourteenDayKey)
        .order('record_date', { ascending: true }),
      supabase
        .from('pbs_extinction_alerts')
        .select('id, risk_level, description, gpt_recommendation, created_at')
        .eq('student_id', studentId)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const aiProfile = aiProfileRow ? mapStudentAiProfile(aiProfileRow as Record<string, unknown>) : null

    const strategyNames = [...new Set((goals || []).map((goal) => goal.strategy_type).filter(Boolean))]
    const { data: interventionRows } = strategyNames.length > 0
      ? await supabase
          .from('pbs_intervention_library')
          .select('id, name_ko, evidence_level, abbreviation')
          .in('name_ko', strategyNames)
          .order('name_ko')
      : { data: [] }

    const todayReinforcementMap = new Map<string, SupportWorkspaceTodayReinforcement>()
    for (const record of todayRecords || []) {
      const rawGoal = record.pbs_goals as
        | { behavior_name?: string | null; daily_target?: number | null }
        | Array<{ behavior_name?: string | null; daily_target?: number | null }>
        | null
      const goalMeta = Array.isArray(rawGoal) ? rawGoal[0] : rawGoal
      const current = todayReinforcementMap.get(record.goal_id) || {
        goalId: record.goal_id,
        behaviorName: goalMeta?.behavior_name || '행동 목표',
        todayCount: 0,
        targetPerDay: goalMeta?.daily_target ?? null,
        todayTokens: 0,
      }
      current.todayCount += record.occurrence_count || 0
      current.todayTokens += record.token_granted || 0
      todayReinforcementMap.set(record.goal_id, current)
    }

    const trendMap = new Map<string, SupportWorkspaceTrendPoint>()
    for (const record of reviewRecords || []) {
      const current = trendMap.get(record.record_date) || {
        date: record.record_date,
        tokens: 0,
        occurrences: 0,
      }
      current.tokens += record.token_granted || 0
      current.occurrences += record.occurrence_count || 0
      trendMap.set(record.record_date, current)
    }

    const activeGoalTokenTotal = (goals || []).reduce((sum, goal) => {
      if (!goal.daily_target || goal.daily_target <= 0) return sum
      return sum + goal.daily_target * goal.token_per_occurrence
    }, 0)

    const fourteenDayTokenTotal = (reviewRecords || []).reduce((sum, record) => sum + (record.token_granted || 0), 0)
    const sevenDayTokenTotal = (reviewRecords || [])
      .filter((record) => record.record_date >= getDateKeyDaysAgo(6))
      .reduce((sum, record) => sum + (record.token_granted || 0), 0)

    const latestRecordAt = maxIsoDate((reviewRecords || []).map((record) => record.created_at))
    const latestFbaAt = maxIsoDate((fbaRecords || []).map((record) => record.created_at))
    const latestContractAt = maxIsoDate((contractRows || []).map((record) => record.created_at))
    const latestDroAt = maxIsoDate((runningDroRows || []).map((record) => record.started_at))
    const latestAlertAt = maxIsoDate((alertRows || []).map((record) => record.created_at))

    const ptrStage = classifyStudent({
      id: student.id,
      name: student.name,
      hasAiProfile: Boolean(aiProfile),
      fbaCount: (fbaRecords || []).length,
      activeGoalCount: (goals || []).length,
      activeContractCount: (contractRows || []).filter((contract) => contract.is_active).length,
      runningDroCount: (runningDroRows || []).length,
      unresolvedAlertCount: (alertRows || []).length,
      fourteenDayTokenTotal,
      sevenDayAverageTokens: sevenDayTokenTotal / 7,
      activeDailyTargetTokenTotal: activeGoalTokenTotal,
      lastActivityAt: maxIsoDate([
        latestRecordAt,
        latestFbaAt,
        latestContractAt,
        latestDroAt,
        latestAlertAt,
        aiProfile?.updated_at || null,
      ]),
    }).ptrStage

    const contractSummaries: SupportWorkspaceContractSummary[] = (contractRows || []).map((contract) => ({
      id: contract.id,
      contract_title: contract.contract_title,
      target_behavior: contract.target_behavior,
      achievement_criteria: contract.achievement_criteria,
      reward_amount: contract.reward_amount,
      is_active: contract.is_active,
      created_at: contract.created_at,
    }))

    const runningDroTimers: SupportWorkspaceDroTimer[] = (runningDroRows || []).map((timer) => {
      const rawGoal = timer.pbs_goals as
        | { behavior_name?: string | null; token_per_occurrence?: number | null }
        | Array<{ behavior_name?: string | null; token_per_occurrence?: number | null }>
        | null
      const goalMeta = Array.isArray(rawGoal) ? rawGoal[0] : rawGoal
      return {
        id: timer.id,
        goal_id: timer.goal_id,
        started_at: timer.started_at,
        ends_at: timer.ends_at,
        reset_count: timer.reset_count,
        status: timer.status,
        goal_name: goalMeta?.behavior_name || null,
        token_reward: goalMeta?.token_per_occurrence ?? null,
      }
    })

    const payload: SupportWorkspace = {
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        pbs_stage: student.pbs_stage,
      },
      ptrStage,
      assessment: {
        aiProfile,
        fbaRecords: (fbaRecords || []) as SupportWorkspaceAssessmentRecord[],
        hypothesizedFunctions: aiProfile?.hypothesized_functions || [],
      },
      plan: {
        goals: goals || [],
        interventions: (interventionRows || []) as SupportWorkspaceIntervention[],
        contractDrafts: contractSummaries,
      },
      execute: {
        activeContracts: contractSummaries.filter((contract) => contract.is_active),
        runningDroTimers,
        todayReinforcement: Array.from(todayReinforcementMap.values()),
      },
      review: {
        extinctionAlerts: (alertRows || []) as SupportWorkspaceAlert[],
        last14DaysTrend: Array.from(trendMap.values()),
        economyHealthLink: `/${session.classCode}/token-economy`,
      },
    }

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: '학생 지원 워크스페이스 조회에 실패했습니다.' }, { status: 500 })
  }
}
