import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import QrCardButton from './QrCardButton'
import EditStudentButton from './EditStudentButton'
import LevelUpButton from './LevelUpButton'
import AiBehaviorPlan from './AiBehaviorPlan'
import GoalDeleteButton from './GoalDeleteButton'
import InterventionDeleteButton from './InterventionDeleteButton'
import StudentSupportTabs from './StudentSupportTabs'
import PrintableSupportPlan from './PrintableSupportPlan'
import { buildFeatureOutputs, mapStudentAiProfile } from '@/lib/ai-profile'
import { dedupeInterventionsForDisplay } from '@/lib/intervention-utils'
import { redactForParent } from '@/lib/support/sanitize-for-parent'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ classCode: string; studentId: string }>
}) {
  const session = await getSession()
  if (!session.classroomId || session.role !== 'teacher') redirect('/login')

  const { classCode, studentId } = await params
  const supabase = await createServerSupabase()

  const { data: student } = await supabase
    .from('pbs_students')
    .select('*, pbs_accounts(*)')
    .eq('id', studentId)
    .eq('class_code_id', session.classroomId)
    .single()

  if (!student) redirect(`/${classCode}/students`)

  const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
  const { data: aiProfileRow } = await supabase
    .from('pbs_student_ai_profiles')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()

  const aiProfile = aiProfileRow ? mapStudentAiProfile(aiProfileRow as Record<string, unknown>) : null
  const aiFeatureOutputs = buildFeatureOutputs(aiProfile)
  const parentSafeProfile = aiProfile ? redactForParent(aiProfile) : null

  // PBS 목표
  const { data: goals } = await supabase
    .from('pbs_goals')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const strategyNames = [...new Set((goals || []).map((goal) => goal.strategy_type).filter(Boolean))]
  const { data: interventionsRaw } = strategyNames.length > 0
    ? await supabase
        .from('pbs_intervention_library')
        .select('id, name_ko, evidence_level, abbreviation')
        .in('name_ko', strategyNames)
        .order('name_ko')
    : { data: [] }

  const interventions = dedupeInterventionsForDisplay(interventionsRaw || [])

  // 최근 거래내역 10건
  const { data: transactions } = await supabase
    .from('pbs_transactions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(10)

  // 오늘 PBS 기록
  const today = new Date().toISOString().split('T')[0]
  const { data: todayRecords } = await supabase
    .from('pbs_records')
    .select('*, pbs_goals(behavior_name)')
    .eq('student_id', studentId)
    .eq('record_date', today)

  const todayEarned = todayRecords?.reduce((sum, r) => sum + r.token_granted, 0) || 0

  // 보유 주식
  const { data: holdings } = await supabase
    .from('pbs_stock_holdings')
    .select('stock_name, stock_type, quantity, avg_buy_price')
    .eq('student_id', studentId)
    .gt('quantity', 0)

  // 활성 계약서
  const { data: contracts } = await supabase
    .from('pbs_behavior_contracts')
    .select('contract_title, target_behavior, achievement_criteria, reward_amount, is_active')
    .eq('student_id', studentId)
    .eq('is_active', true)

  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  const fourteenDayKey = fourteenDaysAgo.toISOString().split('T')[0]

  const [{ data: fbaRecords }, { data: alerts }, { data: reviewRecords }, { data: runningDroTimer }] = await Promise.all([
    supabase
      .from('pbs_fba_records')
      .select('id, behavior_description, estimated_function, confidence, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('pbs_extinction_alerts')
      .select('id, risk_level, description, created_at')
      .eq('student_id', studentId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('pbs_records')
      .select('record_date, occurrence_count, token_granted')
      .eq('student_id', studentId)
      .gte('record_date', fourteenDayKey)
      .order('record_date', { ascending: false }),
    supabase
      .from('pbs_dro_timers')
      .select('id, started_at, ends_at, reset_count, pbs_goals(behavior_name, token_per_occurrence)')
      .eq('student_id', studentId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const trendMap = new Map<string, { date: string; tokens: number; occurrences: number }>()
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
  const trendRows = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const reviewTotalTokens = trendRows.reduce((sum, row) => sum + row.tokens, 0)
  const reviewTotalOccurrences = trendRows.reduce((sum, row) => sum + row.occurrences, 0)
  const createdDate = new Date().toLocaleDateString('ko-KR')

  const runningDroGoal = (() => {
    const raw = runningDroTimer?.pbs_goals as unknown
    if (!raw) return null
    if (Array.isArray(raw)) return raw[0] as { behavior_name: string; token_per_occurrence: number } | undefined
    return raw as { behavior_name: string; token_per_occurrence: number }
  })()

  const overviewContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">총 수입</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(account?.total_earned || 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">총 지출</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(account?.total_spent || 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">오늘 획득</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrency(todayEarned)}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">오늘 행동 체크 기록</h2>
        {todayRecords && todayRecords.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {todayRecords.map((record) => (
              <div key={record.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{record.pbs_goals?.behavior_name}</p>
                  <p className="text-sm text-gray-500">{record.occurrence_count}회</p>
                </div>
                <p className="font-bold text-green-600">+{formatCurrency(record.token_granted)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">오늘 기록된 행동 체크가 없습니다.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center space-y-3">
        <p className="text-xs text-gray-500">QR코드: <span className="font-mono">{student.qr_code}</span></p>
        <QrCardButton studentId={studentId} />
      </div>
    </div>
  )

  const hasFbaHistory = Boolean(fbaRecords && fbaRecords.length > 0)

  const fbaRecordsSection = (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3">행동 원인 분석 기록</h2>
      {hasFbaHistory ? (
        <div className="space-y-3">
          {fbaRecords!.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{record.behavior_description}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {record.estimated_function && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                        기능: {record.estimated_function}
                      </span>
                    )}
                    {record.confidence && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                        신뢰도: {record.confidence}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(record.created_at).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm">아직 기록된 행동 원인 분석이 없습니다.</p>
          <p className="mt-3 text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            신규 학급·첫 사정은 위쪽 <strong className="text-gray-700">AI 행동 지원 계획</strong>에서 초안을 만든 뒤
            「한 번에 저장」으로 첫 기록을 남길 수 있습니다. 곧바로 다시 저장할 때는 최근 분석 행만 갱신되어
            짧은 간격의 중복 기록이 쌓이지 않습니다.
          </p>
          <Link href={`/${classCode}/fba`} className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700">
            학급 화면에서 행동 원인 분석 기록하기 →
          </Link>
        </div>
      )}
    </div>
  )

  const aiBehaviorPlanSection = (
    <AiBehaviorPlan
      studentId={studentId}
      studentName={student.name}
      grade={student.grade}
      classCode={classCode}
      initialProfile={aiProfile}
    />
  )

  /** 기록이 없을 때는 AI를 먼저 두어 신규 학급의 사정 시작점을 맞춤 */
  const assessmentContent = (
    <div className="space-y-6">
      {hasFbaHistory ? (
        <>
          {fbaRecordsSection}
          {aiBehaviorPlanSection}
        </>
      ) : (
        <>
          {aiBehaviorPlanSection}
          {fbaRecordsSection}
        </>
      )}
    </div>
  )

  const planContent = (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">행동 목표</h2>
        {(!goals || goals.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">등록된 목표가 없습니다.</p>
            <Link
              href={`/${classCode}/pbs`}
              className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              행동 목표 체크에서 추가 →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {goals.map((goal) => (
              <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-gray-900">{goal.behavior_name}</p>
                  {goal.strategy_type && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {goal.strategy_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <p className="font-bold text-blue-600">{formatCurrency(goal.token_per_occurrence)}/회</p>
                  <GoalDeleteButton goalId={goal.id} goalName={goal.behavior_name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">중재 전략</h2>
        {(!interventions || interventions.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">학생에게 연결된 중재 전략이 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {interventions.map((intervention) => (
              <div key={intervention.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-gray-900">{intervention.name_ko}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    근거수준: {intervention.evidence_level === 'strong' ? '강함' : intervention.evidence_level === 'moderate' ? '중간' : '신규'}
                  </p>
                </div>
                <InterventionDeleteButton
                  strategyId={intervention.id}
                  strategyName={intervention.name_ko}
                  studentId={studentId}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const executeContent = (
    <div className="space-y-6">
      {runningDroTimer && runningDroGoal && (
        <div className="bg-white rounded-2xl border border-orange-200 p-4">
          <p className="text-sm font-bold text-orange-700">⏱️ 실행 중인 강화 타이머</p>
          <p className="mt-2 text-lg font-bold text-gray-900">{runningDroGoal.behavior_name}</p>
          <p className="mt-1 text-sm text-gray-600">
            보상 {formatCurrency(runningDroGoal.token_per_occurrence)} · 리셋 {runningDroTimer.reset_count}회
          </p>
          <p className="mt-1 text-xs text-gray-400">
            시작 {new Date(runningDroTimer.started_at).toLocaleString('ko-KR')} · 종료 {new Date(runningDroTimer.ends_at).toLocaleString('ko-KR')}
          </p>
        </div>
      )}

      {contracts && contracts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">행동 약속 계약서</h2>
          <div className="space-y-3">
            {contracts.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-bold text-gray-900">{c.contract_title}</p>
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">진행중</span>
                </div>
                <p className="text-sm text-gray-600">{c.target_behavior}</p>
                {c.achievement_criteria && (
                  <p className="text-xs text-gray-500 mt-1">목표: {c.achievement_criteria}</p>
                )}
                {c.reward_amount > 0 && (
                  <p className="text-xs text-green-600 mt-1">달성 보상: {formatCurrency(c.reward_amount)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {holdings && holdings.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">📈 보유 주식</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {holdings.map((h, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{h.stock_name}</p>
                  <p className="text-xs text-gray-400">평단 {formatCurrency(h.avg_buy_price)} · {h.stock_type}</p>
                </div>
                <p className="font-bold text-blue-600">{h.quantity}주</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">최근 거래내역</h2>
        {(!transactions || transactions.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">거래 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.created_at).toLocaleDateString('ko-KR', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className={`font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const reviewContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">미해결 알림</p>
          <p className="text-lg font-bold text-red-500">{alerts?.length || 0}건</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">14일 토큰 합계</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrency(reviewTotalTokens)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500">14일 체크 횟수</p>
          <p className="text-lg font-bold text-blue-600">{reviewTotalOccurrences}회</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">소거 위험 경보</h2>
        {alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-white rounded-2xl border border-red-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{alert.description}</p>
                    <p className="mt-1 text-xs text-gray-500">위험도: {alert.risk_level}</p>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(alert.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">현재 미해결 소거 위험 경보가 없습니다.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">최근 14일 기록 추세</h2>
        {trendRows.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {trendRows.map((row) => (
              <div key={row.date} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{row.date}</p>
                  <p className="text-xs text-gray-400">{row.occurrences}회 체크</p>
                </div>
                <p className="font-bold text-amber-600">+{formatCurrency(row.tokens)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">최근 14일 기록 추세가 없습니다.</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href={`/${classCode}/support?view=alerts`} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
          <p className="text-sm font-bold text-gray-900">🚨 경보 관리</p>
          <p className="mt-1 text-xs text-gray-500">소거 위험 경보 페이지로 이동</p>
        </Link>
        <Link href={`/${classCode}/token-economy`} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
          <p className="text-sm font-bold text-gray-900">💰 경제 건강도</p>
          <p className="mt-1 text-xs text-gray-500">토큰 경제 점검 보기</p>
        </Link>
        <Link href={`/${classCode}/support`} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
          <p className="text-sm font-bold text-gray-900">🧠 행동 지원 계획</p>
          <p className="mt-1 text-xs text-gray-500">학생 지원 허브로 바로가기</p>
        </Link>
      </div>

      <PrintableSupportPlan
        studentName={student.name}
        grade={student.grade}
        createdDate={createdDate}
        currentLevelSummary={parentSafeProfile?.current_level_summary || null}
        strengths={parentSafeProfile?.strengths || []}
        preferences={parentSafeProfile?.preferences || []}
        goals={(goals || []).map((goal) => ({
          id: goal.id,
          behaviorName: goal.behavior_name,
          tokenPerOccurrence: goal.token_per_occurrence,
          dailyTarget: goal.daily_target,
          strategyType: goal.strategy_type || null,
        }))}
        contracts={(contracts || []).map((contract) => ({
          title: contract.contract_title,
          targetBehavior: contract.target_behavior,
          achievementCriteria: contract.achievement_criteria,
          rewardAmount: contract.reward_amount,
        }))}
        todayEarned={todayEarned}
        fourteenDayTokens={reviewTotalTokens}
        fourteenDayOccurrences={reviewTotalOccurrences}
        runningDro={runningDroGoal && runningDroTimer ? {
          behaviorName: runningDroGoal.behavior_name,
          rewardAmount: runningDroGoal.token_per_occurrence,
          resetCount: runningDroTimer.reset_count,
        } : null}
        trendRows={trendRows}
      />
    </div>
  )

  return (
    <div className="tablet-page space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href={`/${classCode}/students`}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← 학생 목록
        </Link>
      </div>

      {/* 학생 프로필 카드 */}
      <div className="rounded-[1.9rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xl font-bold">
              {student.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
              <p className="text-sm text-gray-500">
                {student.grade ? `${student.grade}학년` : ''} · PBS LV.{student.pbs_stage}
                {student.response_cost_enabled && (
                  <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">반응대가 활성</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-left xl:text-right">
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(account?.balance || 0)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 lg:grid-cols-2">
          <EditStudentButton
            studentId={studentId}
            classCode={classCode}
            initialData={{
              name: student.name,
              grade: student.grade,
              pbs_stage: student.pbs_stage,
              response_cost_enabled: student.response_cost_enabled,
            }}
          />
          <LevelUpButton studentId={studentId} currentStage={student.pbs_stage} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          <Link
            href={`/${classCode}/students/${studentId}/ptr-insights`}
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            PTR·강화 인사이트
          </Link>
          <Link
            href={`/${classCode}/students/${studentId}/preference-assessment`}
            className="inline-flex items-center rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
          >
            선호도 평가 (가게 강화물)
          </Link>
        </div>
        {aiProfile && (
          <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-500">AI 학생 요약</p>
            <p className="mt-2 text-sm leading-6 text-gray-700">{aiFeatureOutputs.registrationSummary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {aiProfile.strengths.slice(0, 3).map((strength) => (
                <span key={strength} className="rounded-full border border-white bg-white px-3 py-1 text-xs font-medium text-purple-700">
                  강점 · {strength}
                </span>
              ))}
              {aiProfile.preferences.slice(0, 2).map((preference) => (
                <span key={preference} className="rounded-full border border-white bg-white px-3 py-1 text-xs font-medium text-blue-700">
                  선호 · {preference}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <StudentSupportTabs
        overview={overviewContent}
        assessment={assessmentContent}
        plan={planContent}
        execute={executeContent}
        review={reviewContent}
      />
    </div>
  )
}
