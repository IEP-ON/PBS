import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import SettleButton from './SettleButton'
import SalaryButtons from './SalaryButtons'
import RealtimeNotice from './RealtimeNotice'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ classCode: string }>
}) {
  const session = await getSession()
  if (!session.classroomId || session.role !== 'teacher') redirect('/login')

  const { classCode } = await params
  const supabase = await createServerSupabase()

  // 학급 정보
  const { data: classroom } = await supabase
    .from('pbs_class_codes')
    .select('*')
    .eq('id', session.classroomId)
    .single()

  // 학생 + 계좌 정보
  const { data: students } = await supabase
    .from('pbs_students')
    .select('*, pbs_accounts(*)')
    .eq('class_code_id', session.classroomId)
    .eq('is_active', true)
    .order('name')

  // 오늘 PBS 기록
  const today = new Date().toISOString().split('T')[0]
  const { data: todayRecords } = await supabase
    .from('pbs_records')
    .select('student_id, token_granted')
    .eq('record_date', today)

  // 학생별 오늘 정산 예정 합계
  const todayEarnings: Record<string, number> = {}
  todayRecords?.forEach((r) => {
    todayEarnings[r.student_id] = (todayEarnings[r.student_id] || 0) + r.token_granted
  })

  const totalBalance = students?.reduce((sum, s) => {
    const account = Array.isArray(s.pbs_accounts) ? s.pbs_accounts[0] : s.pbs_accounts
    return sum + (account?.balance || 0)
  }, 0) || 0

  // 미정산 PBS 기록 합계
  const { data: pendingRecords } = await supabase
    .from('pbs_records')
    .select('token_granted')
    .eq('is_settled', false)
    .gt('token_granted', 0)

  const pendingAmount = pendingRecords?.reduce((sum, r) => sum + r.token_granted, 0) || 0

  // 활성 계약서 수
  const { count: activeContractsCount } = await supabase
    .from('pbs_behavior_contracts')
    .select('id', { count: 'exact', head: true })
    .eq('class_code_id', session.classroomId)
    .eq('is_active', true)

  // 실행 중 DRO 타이머 수
  const { count: runningDroCount } = await supabase
    .from('pbs_dro_timers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'running')

  // 가게 아이템 수
  const { count: shopItemsCount } = await supabase
    .from('pbs_shop_items')
    .select('id', { count: 'exact', head: true })
    .eq('class_code_id', session.classroomId)
    .eq('is_active', true)

  // 커스텀 주식 수
  const { count: stocksCount } = await supabase
    .from('pbs_custom_stocks')
    .select('id', { count: 'exact', head: true })
    .eq('class_code_id', session.classroomId)
    .eq('is_active', true)

  // 활성 소거 알림 조회
  const { data: extinctionAlerts } = await supabase
    .from('pbs_extinction_alerts')
    .select('*, pbs_students(name), pbs_goals(behavior_name)')
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <>
    <div className="p-6 space-y-6">
      {/* 소거 알림 배너 */}
      {extinctionAlerts && extinctionAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="font-bold text-red-900">소거 위험 알림 ({extinctionAlerts.length}건)</p>
                <p className="text-xs text-red-600">소거 폭발(Extinction Burst) 패턴이 감지되었습니다</p>
              </div>
            </div>
            <Link
              href={`/${classCode}/behavior-analysis`}
              className="text-xs text-red-600 hover:text-red-800 underline whitespace-nowrap"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="space-y-2">
            {extinctionAlerts.map(alert => (
              <div key={alert.id} className="bg-white rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {alert.pbs_students?.name} · {alert.pbs_goals?.behavior_name}
                </p>
                <p className="text-gray-600 text-xs mt-1">{alert.description}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                  alert.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                  alert.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  위험도: {alert.risk_level === 'high' ? '높음' : alert.risk_level === 'medium' ? '중간' : '낮음'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {classroom?.class_name || '대시보드'}
          </h1>
          <p className="text-sm text-gray-500">
            {classroom?.school_name} · {classroom?.teacher_name} 선생님
          </p>
        </div>
        <div className="flex gap-3">
          <SettleButton
            pendingAmount={pendingAmount}
            studentNames={Object.fromEntries(students?.map(s => [s.id, s.name]) || [])}
          />
          <Link
            href={`/${classCode}/students`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + 학생 등록
          </Link>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">등록 학생</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{students?.length || 0}명</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">전체 잔액 합계</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">오늘 PBS 체크</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{todayRecords?.length || 0}건</p>
        </div>
      </div>

      {/* 퀵링크 네비 */}
      <div className="grid grid-cols-5 gap-3">
        <Link href={`/${classCode}/contracts`} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl">📝</p>
          <p className="text-xs font-medium text-gray-700 mt-1">행동계약서</p>
          {(activeContractsCount ?? 0) > 0 && <p className="text-xs text-blue-600 font-bold">{activeContractsCount}건 진행</p>}
        </Link>
        <Link href={`/${classCode}/dro`} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-md transition-shadow relative">
          <p className="text-2xl">⏱️</p>
          <p className="text-xs font-medium text-gray-700 mt-1">DRO 타이머</p>
          {(runningDroCount ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{runningDroCount}</span>
          )}
        </Link>
        <Link href={`/${classCode}/shop`} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl">🏪</p>
          <p className="text-xs font-medium text-gray-700 mt-1">가게</p>
          <p className="text-xs text-gray-400">{shopItemsCount ?? 0}개</p>
        </Link>
        <Link href={`/${classCode}/stocks`} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl">📈</p>
          <p className="text-xs font-medium text-gray-700 mt-1">주식</p>
          <p className="text-xs text-gray-400">{stocksCount ?? 0}종목</p>
        </Link>
        <Link href={`/${classCode}/class-account`} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-2xl">🏫</p>
          <p className="text-xs font-medium text-gray-700 mt-1">학급 계좌</p>
        </Link>
      </div>

      {/* 급여 수동 실행 */}
      <SalaryButtons />

      {/* 학생 잔액 카드 목록 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">학생 현황</h2>
        {(!students || students.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-4xl mb-3">👨‍🎓</p>
            <p className="text-gray-500">아직 등록된 학생이 없습니다.</p>
            <Link
              href={`/${classCode}/students`}
              className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              학생 등록하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => {
              const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
              const todayAmount = todayEarnings[student.id] || 0
              return (
                <Link
                  key={student.id}
                  href={`/${classCode}/students/${student.id}`}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-gray-900">{student.name}</p>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      LV.{student.pbs_stage}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(account?.balance || 0)}
                  </p>
                  {todayAmount > 0 && (
                    <p className="text-sm text-green-600 mt-1">
                      오늘 +{formatCurrency(todayAmount)} 예정
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
    <RealtimeNotice classroomId={session.classroomId} />
    </>
  )
}
