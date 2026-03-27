'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import type { TeachStudent, TeachGoal } from '@/app/api/teach/summary/route'

// ─── 상수 ────────────────────────────────────────────────────────────────────
const PERIODS = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '방과후']

const INCIDENT_TYPES = [
  { label: '자리 이탈', icon: '🚶' },
  { label: '공격 행동', icon: '👊' },
  { label: '자해 행동', icon: '⚠️' },
  { label: '수업 방해', icon: '📣' },
  { label: '물건 던지기', icon: '🪃' },
  { label: '거부/회피', icon: '🙅' },
  { label: '기타', icon: '📝' },
]

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface DroUiState {
  completed: boolean
  remainingMs: number
  elapsedPct: number
  mmss: string
}

// ─── DRO 계산 헬퍼 ──────────────────────────────────────────────────────────
function calcDro(student: TeachStudent, now: Date): DroUiState | null {
  if (!student.activeTimer) return null
  const endsAt = new Date(student.activeTimer.ends_at).getTime()
  const startedAt = new Date(student.activeTimer.started_at).getTime()
  const nowMs = now.getTime()
  const remainingMs = Math.max(0, endsAt - nowMs)
  const total = student.activeTimer.duration_ms || (endsAt - startedAt)
  const elapsed = nowMs - startedAt
  const elapsedPct = Math.min(100, (elapsed / total) * 100)
  const mins = Math.floor(remainingMs / 60000)
  const secs = Math.floor((remainingMs % 60000) / 1000)
  return {
    completed: remainingMs === 0,
    remainingMs,
    elapsedPct,
    mmss: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
  }
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export default function TeachPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [students, setStudents] = useState<TeachStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [currentPeriod, setCurrentPeriod] = useState(0) // 0 = 미설정
  const [sessionStart, setSessionStart] = useState<Date | null>(null)

  // PBS 체크 관련
  const [checkingGoal, setCheckingGoal] = useState<string | null>(null)
  const [promptedStudent, setPromptedStudent] = useState<string | null>(null) // P 토글
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<{ name: string; count: number; tokens: number } | null>(null)

  // 사건 기록 모달
  const [showIncident, setShowIncident] = useState(false)
  const [incidentStudentId, setIncidentStudentId] = useState('')
  const [incidentType, setIncidentType] = useState('')
  const [incidentNote, setIncidentNote] = useState('')
  const [savingIncident, setSavingIncident] = useState(false)

  // 수업 종료 모달
  const [showEndModal, setShowEndModal] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settleResult, setSettleResult] = useState<{ settled: number; totalAmount: number } | null>(null)

  // DRO 완료 알림
  const [droAlert, setDroAlert] = useState<{ studentId: string; timerId: string; goalName: string } | null>(null)

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTimerDoneRef = useRef<Set<string>>(new Set())

  // ── 데이터 로드 ─────────────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    const res = await fetch('/api/teach/summary')
    if (!res.ok) return
    const data = await res.json()
    setStudents(data.students || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSummary()
    refreshIntervalRef.current = setInterval(loadSummary, 30000)
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [loadSummary])

  // ── 1초 틱 + DRO 완료 감지 ──────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const n = new Date()
      setNow(n)

      // DRO 완료 감지 (처음 한 번만 알림)
      students.forEach(s => {
        if (!s.activeTimer) return
        const remaining = new Date(s.activeTimer.ends_at).getTime() - n.getTime()
        if (remaining <= 0 && !prevTimerDoneRef.current.has(s.activeTimer.id)) {
          prevTimerDoneRef.current.add(s.activeTimer.id)
          setDroAlert({ studentId: s.id, timerId: s.activeTimer.id, goalName: s.activeTimer.goal_name })
        }
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [students])

  // ── 교시 선택 시 세션 시작 ───────────────────────────────────────────────────
  const handleSelectPeriod = (idx: number) => {
    setCurrentPeriod(idx + 1)
    setSessionStart(new Date())
  }

  // ── PBS 체크 ────────────────────────────────────────────────────────────────
  const handleCheck = async (student: TeachStudent, goal: TeachGoal, count: number) => {
    const prompted = promptedStudent === student.id
    setCheckingGoal(goal.id)

    // 옵티미스틱 업데이트
    setStudents(prev => prev.map(s => {
      if (s.id !== student.id) return s
      return {
        ...s,
        todayTokens: s.todayTokens + goal.token_per_occurrence * count,
        pendingTokens: s.pendingTokens + goal.token_per_occurrence * count,
        goals: s.goals.map(g =>
          g.id === goal.id ? { ...g, todayCount: g.todayCount + count } : g
        ),
      }
    }))

    setLastCheck({ name: `${student.name} · ${goal.behavior_name}`, count, tokens: goal.token_per_occurrence * count })
    setTimeout(() => setLastCheck(null), 3000)

    await fetch('/api/pbs/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        goalId: goal.id,
        occurrenceCount: count,
        prompted,
      }),
    })

    setCheckingGoal(null)
  }

  // ── DRO 리셋 (문제행동 발생) ─────────────────────────────────────────────────
  const handleDroReset = async (student: TeachStudent) => {
    if (!student.activeTimer) return
    await fetch(`/api/dro/${student.activeTimer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    prevTimerDoneRef.current.delete(student.activeTimer.id)
    loadSummary()
  }

  // ── DRO 완료 처리 ────────────────────────────────────────────────────────────
  const handleDroComplete = async (timerId: string) => {
    await fetch(`/api/dro/${timerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    setDroAlert(null)
    loadSummary()
  }

  // ── 사건 기록 ────────────────────────────────────────────────────────────────
  const openIncident = (studentId?: string) => {
    setIncidentStudentId(studentId || '')
    setIncidentType('')
    setIncidentNote('')
    setShowIncident(true)
  }

  const handleSaveIncident = async () => {
    if (!incidentStudentId || !incidentType) return
    setSavingIncident(true)
    await fetch('/api/fba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: incidentStudentId,
        behaviorDescription: incidentNote ? `${incidentType}: ${incidentNote}` : incidentType,
        antecedentPatterns: [],
        consequencePatterns: [],
        requestAiAnalysis: false,
      }),
    })
    setSavingIncident(false)
    setShowIncident(false)
  }

  // ── 수업 종료 & 정산 ─────────────────────────────────────────────────────────
  const handleSettle = async () => {
    setSettling(true)
    const res = await fetch('/api/salary/settle', { method: 'POST' })
    const data = await res.json()
    setSettleResult({ settled: data.settled, totalAmount: data.totalAmount })
    setSettling(false)
    loadSummary()
  }

  // ── 세션 경과 시간 ───────────────────────────────────────────────────────────
  const sessionElapsed = sessionStart
    ? Math.floor((now.getTime() - sessionStart.getTime()) / 60000)
    : null

  const totalPending = students.reduce((sum, s) => sum + s.pendingTokens, 0)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-gray-400">수업 모드 로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── 상단 바 ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* 교시 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-600">교시:</span>
            <div className="flex gap-1 overflow-x-auto">
              {PERIODS.map((p, i) => (
                <button
                  key={p}
                  onClick={() => handleSelectPeriod(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    currentPeriod === i + 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 세션 정보 */}
          <div className="flex items-center gap-2 shrink-0">
            {sessionElapsed !== null && (
              <span className="text-xs text-gray-400">
                {sessionElapsed}분 경과
              </span>
            )}
            {totalPending > 0 && (
              <button
                onClick={() => setShowEndModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors"
              >
                🏁 수업 종료 ({formatCurrency(totalPending)})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 토스트: 마지막 체크 ──────────────────────────────────────────────── */}
      {lastCheck && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-xl animate-in slide-in-from-top-2 whitespace-nowrap">
          ✅ {lastCheck.name} +{lastCheck.count}회 (+{formatCurrency(lastCheck.tokens)})
        </div>
      )}

      {/* ── DRO 완료 알림 ────────────────────────────────────────────────────── */}
      {droAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <span className="text-2xl">⏱</span>
          <div>
            <p className="font-bold text-sm">DRO 완료!</p>
            <p className="text-xs text-green-200">
              {students.find(s => s.id === droAlert.studentId)?.name} · {droAlert.goalName}
            </p>
          </div>
          <button
            onClick={() => handleDroComplete(droAlert.timerId)}
            className="ml-2 px-3 py-1.5 bg-white text-green-800 font-bold text-xs rounded-lg"
          >
            ✅ 토큰 지급
          </button>
          <button onClick={() => setDroAlert(null)} className="text-green-300 text-xs">
            나중에
          </button>
        </div>
      )}

      {/* ── 학생 그리드 ──────────────────────────────────────────────────────── */}
      <div className="p-3 grid grid-cols-2 gap-3">
        {students.map(student => {
          const dro = calcDro(student, now)
          const isPrompted = promptedStudent === student.id
          const isExpanded = expandedStudent === student.id
          const primaryGoal = student.goals[0] || null

          return (
            <div
              key={student.id}
              className={`bg-white rounded-2xl border transition-all ${
                dro?.completed
                  ? 'border-green-400 ring-2 ring-green-300 shadow-green-100 shadow-lg'
                  : 'border-gray-200 shadow-sm'
              }`}
            >
              {/* 학생 헤더 */}
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <div>
                  <p className="font-bold text-gray-900 text-base leading-tight">{student.name}</p>
                  <p className="text-xs text-gray-400">LV.{student.pbs_stage}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">⭐ {formatCurrency(student.todayTokens)}</p>
                  {student.pendingTokens > 0 && (
                    <p className="text-[10px] text-orange-400">미정산 {formatCurrency(student.pendingTokens)}</p>
                  )}
                </div>
              </div>

              {/* DRO 타이머 */}
              {student.activeTimer && dro && (
                <div className={`mx-3 mb-2 rounded-xl p-2 ${dro.completed ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-600 truncate">
                      ⏱ {student.activeTimer.goal_name}
                    </p>
                    <p className={`text-xs font-bold tabular-nums ${dro.completed ? 'text-green-600' : 'text-blue-700'}`}>
                      {dro.completed ? '완료!' : dro.mmss}
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${dro.completed ? 'bg-green-500' : 'bg-blue-400'}`}
                      style={{ width: `${dro.elapsedPct}%` }}
                    />
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {dro.completed ? (
                      <button
                        onClick={() => handleDroComplete(student.activeTimer!.id)}
                        className="flex-1 text-[10px] py-1 bg-green-600 text-white rounded-lg font-bold"
                      >
                        ✅ 토큰 지급
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDroReset(student)}
                        className="flex-1 text-[10px] py-1 bg-red-100 text-red-600 rounded-lg font-medium"
                      >
                        ↩ 행동 발생 (리셋)
                      </button>
                    )}
                    <button
                      onClick={() => { openIncident(student.id); handleDroReset(student) }}
                      className="text-[10px] px-2 py-1 bg-gray-100 text-gray-500 rounded-lg"
                      title="사건 기록 + DRO 리셋"
                    >
                      📝
                    </button>
                  </div>
                </div>
              )}

              {/* 주요 목표 (첫 번째) */}
              {primaryGoal && (
                <div className="px-3 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-700 font-medium truncate flex-1 mr-2">
                      {primaryGoal.behavior_name}
                    </p>
                    {primaryGoal.daily_target && (
                      <p className={`text-[10px] font-bold shrink-0 ${
                        primaryGoal.todayCount >= primaryGoal.daily_target
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`}>
                        {primaryGoal.todayCount}/{primaryGoal.daily_target}
                      </p>
                    )}
                  </div>
                  {primaryGoal.daily_target && (
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          primaryGoal.todayCount >= primaryGoal.daily_target ? 'bg-green-500' : 'bg-blue-400'
                        }`}
                        style={{ width: `${Math.min(100, (primaryGoal.todayCount / primaryGoal.daily_target) * 100)}%` }}
                      />
                    </div>
                  )}

                  {/* 촉구 토글 + 체크 버튼 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPromptedStudent(prev => prev === student.id ? null : student.id)}
                      className={`shrink-0 text-[10px] px-2 py-1.5 rounded-lg font-bold transition-colors ${
                        isPrompted
                          ? 'bg-amber-400 text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title="촉구 토글 (ON = 다음 체크가 촉구 행동으로 기록됨)"
                    >
                      {isPrompted ? 'P✓' : 'P'}
                    </button>
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => handleCheck(student, primaryGoal, n)}
                        disabled={checkingGoal === primaryGoal.id}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                          isPrompted
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                            : 'bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-200'
                        } disabled:opacity-50`}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 목표 없음 */}
              {student.goals.length === 0 && (
                <div className="px-3 pb-3 text-center">
                  <p className="text-xs text-gray-400">PBS 목표 없음</p>
                  <a href={`/${classCode}/pbs`} className="text-xs text-blue-500 underline">목표 추가 →</a>
                </div>
              )}

              {/* 하단: 전체 목표 + 사건 기록 */}
              <div className="flex border-t border-gray-50">
                {student.goals.length > 1 && (
                  <button
                    onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                    className="flex-1 text-[10px] text-gray-400 py-2 hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? '▲ 접기' : `▼ 전체 ${student.goals.length}개 목표`}
                  </button>
                )}
                <button
                  onClick={() => openIncident(student.id)}
                  className="px-3 py-2 text-[10px] text-red-400 hover:bg-red-50 transition-colors"
                  title="사건 기록"
                >
                  ⚠️
                </button>
              </div>

              {/* 전체 목표 펼침 */}
              {isExpanded && student.goals.slice(1).map(goal => (
                <div key={goal.id} className="px-3 pb-3 border-t border-gray-50 pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-gray-700 truncate flex-1 mr-2">{goal.behavior_name}</p>
                    {goal.daily_target && (
                      <p className="text-[10px] text-gray-400 shrink-0">{goal.todayCount}/{goal.daily_target}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => handleCheck(student, goal, n)}
                        disabled={checkingGoal === goal.id}
                        className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* ── 없음 상태 ──────────────────────────────────────────────────────────── */}
      {students.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">👨‍🏫</p>
          <p className="text-gray-500">등록된 학생이 없습니다.</p>
          <a href={`/${classCode}/students`} className="text-blue-500 text-sm underline mt-2 block">학생 등록하러 가기 →</a>
        </div>
      )}

      {/* ── 하단 FAB ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-4 flex flex-col items-end gap-2 z-40">
        <button
          onClick={() => openIncident()}
          className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-xl flex items-center justify-center text-xl transition-all"
          title="사건 기록"
        >
          ⚠️
        </button>
        <button
          onClick={() => loadSummary()}
          className="w-10 h-10 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full shadow flex items-center justify-center text-sm transition-all"
          title="새로고침"
        >
          🔄
        </button>
      </div>

      {/* ── 사건 기록 모달 ───────────────────────────────────────────────────── */}
      {showIncident && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
            <h2 className="text-lg font-bold text-gray-900">⚠️ 행동 사건 기록</h2>
            <p className="text-xs text-gray-400">수업 중 즉시 기록 — FBA 탭에 자동 저장됩니다.</p>

            {/* 학생 선택 */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setIncidentStudentId(s.id)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    incidentStudentId === s.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* 행동 유형 선택 */}
            <div className="grid grid-cols-4 gap-2">
              {INCIDENT_TYPES.map(t => (
                <button
                  key={t.label}
                  onClick={() => setIncidentType(t.label)}
                  className={`flex flex-col items-center p-2 rounded-xl text-xs font-medium transition-colors ${
                    incidentType === t.label
                      ? 'bg-red-100 border-2 border-red-400 text-red-700'
                      : 'bg-gray-50 border border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="text-xl mb-0.5">{t.icon}</span>
                  <span className="text-center leading-tight">{t.label}</span>
                </button>
              ))}
            </div>

            {/* 메모 (선택) */}
            <input
              value={incidentNote}
              onChange={e => setIncidentNote(e.target.value)}
              placeholder="선행사건 메모 (선택, 예: 수학 과제 제시 직후)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowIncident(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleSaveIncident}
                disabled={!incidentStudentId || !incidentType || savingIncident}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors"
              >
                {savingIncident ? '기록 중...' : '기록 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수업 종료 모달 ───────────────────────────────────────────────────── */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
            <h2 className="text-lg font-bold text-gray-900">
              🏁 {currentPeriod > 0 ? PERIODS[currentPeriod - 1] : '수업'} 종료
            </h2>

            {settleResult ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-green-700">{formatCurrency(settleResult.totalAmount)}</p>
                  <p className="text-sm text-green-600 mt-1">학생 {settleResult.settled}명 정산 완료</p>
                </div>
                <button
                  onClick={() => { setShowEndModal(false); setSettleResult(null) }}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl"
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">미정산 PBS 토큰을 학생 계좌에 입금합니다.</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {students.filter(s => s.pendingTokens > 0).map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-orange-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                        <p className="text-xs text-gray-500">오늘 {formatCurrency(s.todayTokens)} 획득</p>
                      </div>
                      <p className="font-bold text-orange-600">+{formatCurrency(s.pendingTokens)}</p>
                    </div>
                  ))}
                  {students.every(s => s.pendingTokens === 0) && (
                    <p className="text-center text-gray-400 text-sm py-4">미정산 토큰이 없습니다.</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSettle}
                    disabled={settling || students.every(s => s.pendingTokens === 0)}
                    className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors"
                  >
                    {settling ? '정산 중...' : `💰 일괄 정산 (${formatCurrency(totalPending)})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
