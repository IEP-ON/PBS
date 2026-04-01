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
import { buildFeatureOutputs, mapStudentAiProfile } from '@/lib/ai-profile'

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

  // PBS 목표
  const { data: goals } = await supabase
    .from('pbs_goals')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const strategyNames = [...new Set((goals || []).map((goal) => goal.strategy_type).filter(Boolean))]
  const { data: interventions } = strategyNames.length > 0
    ? await supabase
        .from('pbs_intervention_library')
        .select('id, name_ko, evidence_level, abbreviation')
        .in('name_ko', strategyNames)
        .order('name_ko')
    : { data: [] }

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

  return (
    <div className="p-6 space-y-6">
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
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between">
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
          <div className="text-right">
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(account?.balance || 0)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* PBS 목표 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">PBS 행동 목표</h2>
        {(!goals || goals.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">등록된 목표가 없습니다.</p>
            <Link
              href={`/${classCode}/pbs`}
              className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              PBS 체크에서 목표 추가 →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {goals.map((goal) => (
              <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-900">{goal.behavior_name}</p>
                  {goal.strategy_type && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {goal.strategy_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-blue-600">{formatCurrency(goal.token_per_occurrence)}/회</p>
                  <GoalDeleteButton goalId={goal.id} goalName={goal.behavior_name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">행동 중재</h2>
        {(!interventions || interventions.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">학생에게 연결된 중재 전략이 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {interventions.map((intervention) => (
              <div key={intervention.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4">
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

      {/* 오늘 PBS 기록 */}
      {todayRecords && todayRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">오늘 PBS 기록</h2>
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
        </div>
      )}

      {/* 보유 주식 */}
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

      {/* 활성 계약서 */}
      {contracts && contracts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">📝 행동계약서</h2>
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

      {/* 최근 거래내역 */}
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

      {/* AI 행동 지원 계획 */}
      <AiBehaviorPlan
        studentId={studentId}
        studentName={student.name}
        grade={student.grade}
        classCode={classCode}
        initialProfile={aiProfile}
      />

      {/* QR 코드 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center space-y-3">
        <p className="text-xs text-gray-500">QR코드: <span className="font-mono">{student.qr_code}</span></p>
        <QrCardButton studentId={studentId} />
      </div>
    </div>
  )
}
