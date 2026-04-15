import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupportOverview } from '@/lib/support/overview'
import type { SupportBucketKey, SupportOverviewStudentBrief, SupportRiskBadge } from '@/types'
import { ContractsListView } from './views/ContractsListView'
import { DroManagementView } from './views/DroManagementView'
import { FbaClassView } from './views/FbaClassView'
import { AlertsView } from './views/AlertsView'
import { ResponseCostView } from './views/ResponseCostView'
import { InterventionsLibraryView } from './views/InterventionsLibraryView'

const BUCKET_LABELS: Record<SupportBucketKey, string> = {
  uncategorized: '미사정',
  planNeeded: '계획 필요',
  executing: '실행 중',
  reviewNeeded: '점검 필요',
}

const BUCKET_DESCRIPTIONS: Record<SupportBucketKey, string> = {
  uncategorized: 'AI 프로필과 행동 원인 분석이 아직 없는 학생',
  planNeeded: '사정은 있으나 목표·계약 구성이 더 필요한 학생',
  executing: '계약서나 강화 타이머가 돌아가고 있는 학생',
  reviewNeeded: '소거 위험이나 정체로 점검이 필요한 학생',
}

const RISK_LABELS: Record<SupportRiskBadge, string> = {
  extinction: '소거위험',
  stagnant: '정체',
  over_reinforced: '강화과다',
}

const PTR_STAGE_LABELS: Record<SupportOverviewStudentBrief['ptrStage'], string> = {
  assess: '사정',
  plan: '계획',
  execute: '실행',
  review: '점검',
}

const MANAGEMENT_VIEWS = [
  { key: 'contracts', label: '행동계약서', hrefSuffix: '/contracts', description: '계약 체결, 활성화, 인쇄 흐름을 관리합니다.' },
  { key: 'dro', label: '강화 타이머', hrefSuffix: '/dro', description: '무문제 구간 강화 타이머와 완료 이력을 봅니다.' },
  { key: 'fba', label: '행동 원인 분석', hrefSuffix: '/fba', description: 'ABC 패턴과 행동 기능 가설 기록을 관리합니다.' },
  { key: 'alerts', label: '소거 위험 경보', hrefSuffix: '/extinction-alerts', description: '위험 경보와 권장 조치를 검토합니다.' },
  { key: 'response-cost', label: '반응대가', hrefSuffix: '/response-cost', description: '차감 이력과 실행 상황을 확인합니다.' },
  { key: 'interventions', label: '중재 전략 목록', hrefSuffix: '/interventions', description: '기능별 전략 라이브러리와 추천 전략을 확인합니다.' },
] as const

const BUCKET_VALUES = Object.keys(BUCKET_LABELS) as SupportBucketKey[]
type ManagementViewKey = (typeof MANAGEMENT_VIEWS)[number]['key']

function formatLastActivity(value: string | null) {
  if (!value) return '활동 기록 없음'
  return new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderManagementView(view: ManagementViewKey) {
  switch (view) {
    case 'contracts':
      return <ContractsListView />
    case 'dro':
      return <DroManagementView />
    case 'fba':
      return <FbaClassView />
    case 'alerts':
      return <AlertsView />
    case 'response-cost':
      return <ResponseCostView />
    case 'interventions':
      return <InterventionsLibraryView />
    default:
      return null
  }
}

export default async function SupportHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ classCode: string }>
  searchParams: Promise<{ bucket?: string; view?: string }>
}) {
  const session = await getSession()
  if (!session.classroomId || session.role !== 'teacher') redirect('/login')

  const { classCode } = await params
  const resolvedSearchParams = await searchParams
  const rawBucket = resolvedSearchParams.bucket || 'all'
  const bucketFilter: SupportBucketKey | 'all' =
    rawBucket === 'all' || BUCKET_VALUES.includes(rawBucket as SupportBucketKey)
      ? (rawBucket as SupportBucketKey | 'all')
      : 'all'
  const rawView = resolvedSearchParams.view || ''
  const view = MANAGEMENT_VIEWS.some((item) => item.key === rawView) ? rawView : ''

  const supabase = await createServerSupabase()
  const overview = await getSupportOverview(supabase, session.classroomId)

  const activeView = MANAGEMENT_VIEWS.find((item) => item.key === view) || null
  const flatStudents =
    bucketFilter === 'all'
      ? (Object.values(overview.buckets).flat() as SupportOverviewStudentBrief[])
      : overview.buckets[bucketFilter] || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-500">학생 지원 허브</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">행동 지원 계획</h1>
          <p className="mt-2 text-sm text-gray-500">
            사정 → 계획 → 실행 → 점검 흐름으로 학생 상태를 한 번에 보고, 상세 관리 화면으로 이어집니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${classCode}/students`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            학생 관리 →
          </Link>
          <Link
            href={`/${classCode}/pbs`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            행동 목표 체크 →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">전체 학생</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{overview.stats.totalStudents}명</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">활성 계약</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">{overview.stats.activeContracts}건</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
          <p className="text-sm text-orange-700">실행 중 강화 타이머</p>
          <p className="mt-1 text-3xl font-bold text-orange-700">{overview.stats.runningDroTimers}건</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
          <p className="text-sm text-rose-700">미해결 알림</p>
          <p className="mt-1 text-3xl font-bold text-rose-700">{overview.stats.unresolvedAlerts}건</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${classCode}/support`}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              bucketFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            전체
          </Link>
          {BUCKET_VALUES.map((bucket) => (
            <Link
              key={bucket}
              href={`/${classCode}/support?bucket=${bucket}${activeView ? `&view=${activeView.key}` : ''}`}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                bucketFilter === bucket
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {BUCKET_LABELS[bucket]} ({overview.buckets[bucket].length})
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {bucketFilter === 'all'
            ? '전체 학생을 표시합니다.'
            : BUCKET_DESCRIPTIONS[bucketFilter]}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">상세 관리</h2>
            <p className="mt-1 text-sm text-gray-500">각 영역의 상세 관리 화면을 바로 열 수 있습니다.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {MANAGEMENT_VIEWS.map((item) => {
            const isActive = activeView?.key === item.key
            return (
              <Link
                key={item.key}
                href={`/${classCode}/support?${bucketFilter !== 'all' ? `bucket=${bucketFilter}&` : ''}view=${item.key}`}
                className={`rounded-2xl border p-4 transition-colors ${
                  isActive
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-100 hover:bg-gray-50'
                }`}
              >
                <p className="font-semibold text-gray-900">{item.label}</p>
                <p className="mt-2 text-sm text-gray-500">{item.description}</p>
              </Link>
            )
          })}
        </div>

        {activeView && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-900">{activeView.label}</p>
              <p className="mt-2 text-sm text-blue-800">{activeView.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/${classCode}${activeView.hrefSuffix}`}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  독립 화면으로 열기 →
                </Link>
                <Link
                  href={`/${classCode}/support${bucketFilter !== 'all' ? `?bucket=${bucketFilter}` : ''}`}
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  보기 닫기
                </Link>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-gray-100 bg-slate-50 p-4">
              {renderManagementView(activeView.key)}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {bucketFilter === 'all' ? (
          BUCKET_VALUES.map((bucket) => (
            <section key={bucket} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{BUCKET_LABELS[bucket]}</h2>
                  <p className="text-xs text-gray-500 mt-1">{BUCKET_DESCRIPTIONS[bucket]}</p>
                </div>
                <span className="text-sm font-semibold text-gray-400">{overview.buckets[bucket].length}명</span>
              </div>
              {overview.buckets[bucket].length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-400">
                  해당 상태의 학생이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {overview.buckets[bucket].map((student) => (
                    <SupportStudentCard key={student.id} classCode={classCode} student={student} />
                  ))}
                </div>
              )}
            </section>
          ))
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{BUCKET_LABELS[bucketFilter]}</h2>
                <p className="text-xs text-gray-500 mt-1">{BUCKET_DESCRIPTIONS[bucketFilter]}</p>
              </div>
              <span className="text-sm font-semibold text-gray-400">{flatStudents.length}명</span>
            </div>
            {flatStudents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-400">
                해당 상태의 학생이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {flatStudents.map((student) => (
                  <SupportStudentCard key={student.id} classCode={classCode} student={student} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function SupportStudentCard({
  classCode,
  student,
}: {
  classCode: string
  student: SupportOverviewStudentBrief
}) {
  return (
    <Link
      href={`/${classCode}/students/${student.id}`}
      className="rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">{student.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              PTR 단계 · {PTR_STAGE_LABELS[student.ptrStage]}
            </span>
            {student.riskBadges.map((badge) => (
              <span
                key={badge}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  badge === 'extinction'
                    ? 'bg-rose-100 text-rose-700'
                    : badge === 'stagnant'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700'
                }`}
              >
                {RISK_LABELS[badge]}
              </span>
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400">{formatLastActivity(student.lastActivityAt)}</span>
      </div>
      <p className="mt-3 text-sm text-gray-500">
        학생 상세에서 지원 계획과 실행 상태를 이어서 확인하세요.
      </p>
    </Link>
  )
}
