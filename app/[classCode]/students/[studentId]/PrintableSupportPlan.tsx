'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface PrintableGoal {
  id: string
  behaviorName: string
  tokenPerOccurrence: number
  dailyTarget: number | null
  strategyType: string | null
}

interface PrintableContractSummary {
  title: string
  targetBehavior: string
  achievementCriteria: string | null
  rewardAmount: number
}

interface PrintableTrendRow {
  date: string
  tokens: number
  occurrences: number
}

interface PrintableDroSummary {
  behaviorName: string
  rewardAmount: number
  resetCount: number
}

interface PrintableSupportPlanProps {
  studentName: string
  grade: string | null
  createdDate: string
  currentLevelSummary: string | null
  strengths: string[]
  preferences: string[]
  goals: PrintableGoal[]
  contracts: PrintableContractSummary[]
  todayEarned: number
  fourteenDayTokens: number
  fourteenDayOccurrences: number
  runningDro: PrintableDroSummary | null
  trendRows: PrintableTrendRow[]
}

export default function PrintableSupportPlan({
  studentName,
  grade,
  createdDate,
  currentLevelSummary,
  strengths,
  preferences,
  goals,
  contracts,
  todayEarned,
  fourteenDayTokens,
  fourteenDayOccurrences,
  runningDro,
  trendRows,
}: PrintableSupportPlanProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [parentRequest, setParentRequest] = useState('')

  const recentTrend = useMemo(() => trendRows.slice(-7), [trendRows])

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="touch-target rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
      >
        <p className="text-sm font-bold text-gray-900">🖨️ 보호자용 계획서 인쇄</p>
        <p className="mt-1 text-xs text-gray-500">사정 요약, 목표, 강화 계획, 최근 진전을 A4 출력물로 정리합니다.</p>
      </button>

      {isOpen && (
        <div className="print-support-plan fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 md:p-8">
          <style jsx global>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              body * {
                visibility: hidden !important;
              }
              .print-support-plan,
              .print-support-plan * {
                visibility: visible !important;
              }
              .print-support-plan {
                position: absolute !important;
                inset: 0 !important;
                background: white !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              .support-plan-shell {
                box-shadow: none !important;
                border: none !important;
                margin: 0 auto !important;
                max-width: 100% !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="mx-auto max-w-4xl">
            <div className="no-print mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-gray-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                ← 돌아가기
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                🖨️ 인쇄하기
              </button>
            </div>

            <div className="support-plan-shell rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
              <div className="rounded-[1.5rem] bg-slate-900 px-6 py-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">Parent Support Plan</p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">{studentName} 학생 지원 계획서</h1>
                    <p className="mt-2 text-sm text-slate-200">
                      {grade ? `${grade}학년 · ` : ''}작성일 {createdDate}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100">
                    학교-가정이 같은 목표를 바라보며 일관된 언어로 지원할 수 있도록 정리한 요약본입니다.
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-900">1. 사정 요약</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {currentLevelSummary || '현재 학생의 강점과 선호를 중심으로 교실 참여를 지원하고 있습니다.'}
                  </p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">강점</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {strengths.length > 0 ? strengths.map((strength) => (
                          <span key={strength} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                            {strength}
                          </span>
                        )) : (
                          <span className="text-xs text-slate-400">정리된 강점이 아직 없습니다.</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">선호</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {preferences.length > 0 ? preferences.map((preference) => (
                          <span key={preference} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-700">
                            {preference}
                          </span>
                        )) : (
                          <span className="text-xs text-slate-400">정리된 선호 정보가 아직 없습니다.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-bold text-emerald-900">2. 목표 행동 (Teach)</p>
                  <div className="mt-3 space-y-3">
                    {goals.length > 0 ? goals.map((goal) => (
                      <div key={goal.id} className="rounded-2xl bg-white p-4">
                        <p className="font-semibold text-slate-900">{goal.behaviorName}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          1회 {formatCurrency(goal.tokenPerOccurrence)}
                          {goal.dailyTarget ? ` · 하루 목표 ${goal.dailyTarget}회` : ''}
                        </p>
                        {goal.strategyType && (
                          <p className="mt-1 text-xs text-emerald-700">전략 연계: {goal.strategyType}</p>
                        )}
                      </div>
                    )) : (
                      <div className="rounded-2xl bg-white p-4 text-sm text-slate-500">
                        활성 목표가 아직 없습니다.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-bold text-amber-900">3. 강화 계획 (Reinforce)</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white p-4 text-center">
                      <p className="text-xs text-slate-500">오늘 토큰</p>
                      <p className="mt-1 text-lg font-bold text-amber-600">{formatCurrency(todayEarned)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-center">
                      <p className="text-xs text-slate-500">14일 토큰</p>
                      <p className="mt-1 text-lg font-bold text-amber-600">{formatCurrency(fourteenDayTokens)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-center">
                      <p className="text-xs text-slate-500">14일 체크</p>
                      <p className="mt-1 text-lg font-bold text-sky-600">{fourteenDayOccurrences}회</p>
                    </div>
                  </div>

                  {runningDro ? (
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">실행 중인 강화 타이머</p>
                      <p className="mt-2 text-sm text-slate-700">{runningDro.behaviorName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        보상 {formatCurrency(runningDro.rewardAmount)} · 리셋 {runningDro.resetCount}회
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">
                      현재 실행 중인 강화 타이머는 없습니다.
                    </div>
                  )}
                </section>

                <section className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5">
                  <p className="text-sm font-bold text-blue-900">4. 계약과 보상</p>
                  <div className="mt-3 space-y-3">
                    {contracts.length > 0 ? contracts.map((contract) => (
                      <div key={`${contract.title}-${contract.targetBehavior}`} className="rounded-2xl bg-white p-4">
                        <p className="font-semibold text-slate-900">{contract.title}</p>
                        <p className="mt-2 text-sm text-slate-700">{contract.targetBehavior}</p>
                        {contract.achievementCriteria && (
                          <p className="mt-1 text-xs text-slate-500">달성 기준: {contract.achievementCriteria}</p>
                        )}
                        <p className="mt-1 text-xs font-medium text-blue-700">
                          달성 보상: {formatCurrency(contract.rewardAmount)}
                        </p>
                      </div>
                    )) : (
                      <div className="rounded-2xl bg-white p-4 text-sm text-slate-500">
                        현재 진행 중인 행동계약은 없습니다.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-sm font-bold text-slate-900">5. 최근 14일 진전</p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
                  {recentTrend.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {recentTrend.map((row) => (
                        <div key={row.date} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-900">{row.date}</p>
                            <p className="text-xs text-slate-500">{row.occurrences}회 기록</p>
                          </div>
                          <p className="font-bold text-amber-600">+{formatCurrency(row.tokens)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-sm text-slate-500">최근 14일 기록이 아직 없습니다.</div>
                  )}
                </div>
              </section>

              <section className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5">
                <div className="no-print">
                  <p className="text-sm font-bold text-slate-900">6. 보호자 협조 요청 메모</p>
                  <p className="mt-1 text-xs text-slate-500">인쇄 전에 보호자에게 전달하고 싶은 한두 줄을 적어두면 출력물에 반영됩니다.</p>
                  <textarea
                    value={parentRequest}
                    onChange={(event) => setParentRequest(event.target.value)}
                    rows={4}
                    placeholder="예: 가정에서도 같은 문구로 칭찬해 주세요. 목표 행동이 보이면 짧게 즉시 강화해 주세요."
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-300"
                  />
                </div>

                <div className="mt-0 md:mt-1">
                  <p className="text-sm font-bold text-slate-900">보호자 협조 요청</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                    {parentRequest || '학교와 가정에서 같은 표현과 같은 기대 행동을 사용해 학생이 일관된 강화 경험을 하도록 도와주세요.'}
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
