'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface Student {
  id: string
  name: string
  pbs_stage: number
}

interface PbsGoal {
  id: string
  student_id: string
  behavior_name: string
  behavior_definition: string | null
  token_per_occurrence: number
  strategy_type: string | null
  allow_self_check: boolean
  daily_target: number | null
}

interface PbsRecord {
  id: string
  student_id: string
  goal_id: string
  occurrence_count: number
  token_granted: number
  pbs_goals: { behavior_name: string; token_per_occurrence: number }
}

interface ActiveContract {
  id: string
  contract_title: string
  target_behavior: string
  achievement_criteria: string | null
  reward_amount: number
}

interface LibraryStrategy {
  id: string
  strategy_name: string
  evidence_level: string
}

interface UndoToast {
  recordId: string
  goalName: string
  count: number
  tokens: number
  secondsLeft: number
}

// 일괄 체크 모달용 - 모든 학생의 목표
interface AllGoal {
  id: string
  student_id: string
  behavior_name: string
  token_per_occurrence: number
}

type GoalFormData = {
  behaviorName: string
  behaviorDefinition: string
  tokenPerOccurrence: string
  strategyType: string
  dailyTarget: string
  allowSelfCheck: boolean
}

const emptyForm: GoalFormData = {
  behaviorName: '',
  behaviorDefinition: '',
  tokenPerOccurrence: '',
  strategyType: '',
  dailyTarget: '',
  allowSelfCheck: false,
}

export default function PbsCheckPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [goals, setGoals] = useState<PbsGoal[]>([])
  const [todayRecords, setTodayRecords] = useState<PbsRecord[]>([])
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([])
  const [libraryStrategies, setLibraryStrategies] = useState<LibraryStrategy[]>([])
  const [loading, setLoading] = useState(true)

  // 목표 추가/편집 모달
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<PbsGoal | null>(null)
  const [form, setForm] = useState<GoalFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // undo 토스트
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 일괄 체크 모달
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [allGoals, setAllGoals] = useState<AllGoal[]>([])
  const [bulkBehaviorName, setBulkBehaviorName] = useState('')
  const [bulkSelectedStudents, setBulkSelectedStudents] = useState<string[]>([])
  const [bulkCount, setBulkCount] = useState(1)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // 학생 목록 + 라이브러리 전략 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/students').then(r => r.json()),
      fetch('/api/interventions').then(r => r.json()),
    ]).then(([sData, iData]) => {
      setStudents(sData.students || [])
      setLibraryStrategies(iData.strategies || [])
      if (sData.students?.length > 0) {
        setSelectedStudent(sData.students[0].id)
      }
      setLoading(false)
    })
  }, [])

  // 선택 학생의 PBS 목표 + 오늘 기록 + 활성 계약서 로드
  const loadStudentData = useCallback(async (studentId: string) => {
    const [goalsRes, recordsRes, contractsRes] = await Promise.all([
      fetch(`/api/pbs/goals?studentId=${studentId}`),
      fetch(`/api/pbs/records?studentId=${studentId}`),
      fetch(`/api/contracts?studentId=${studentId}`),
    ])
    const goalsData = await goalsRes.json()
    const recordsData = await recordsRes.json()
    const contractsData = await contractsRes.json()
    setGoals(goalsData.goals || [])
    setTodayRecords(recordsData.records || [])
    setActiveContracts((contractsData.contracts || []).filter((c: ActiveContract & { is_active: boolean }) => c.is_active))
  }, [])

  useEffect(() => {
    if (selectedStudent) {
      loadStudentData(selectedStudent)
    }
  }, [selectedStudent, loadStudentData])

  // undo 토스트 타이머
  const startUndoTimer = useCallback((toast: UndoToast) => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current)
    setUndoToast(toast)
    undoTimerRef.current = setInterval(() => {
      setUndoToast(prev => {
        if (!prev) return null
        if (prev.secondsLeft <= 1) {
          clearInterval(undoTimerRef.current!)
          return null
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 }
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current)
    }
  }, [])

  const handleCheck = async (goalId: string, count: number, goalName: string) => {
    if (!selectedStudent) return

    const res = await fetch('/api/pbs/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: selectedStudent,
        goalId,
        occurrenceCount: count,
        prompted: false,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      loadStudentData(selectedStudent)
      startUndoTimer({
        recordId: data.recordId,
        goalName,
        count,
        tokens: data.tokenGranted,
        secondsLeft: 6,
      })
    }
  }

  const handleUndo = async () => {
    if (!undoToast) return
    if (undoTimerRef.current) clearInterval(undoTimerRef.current)
    const id = undoToast.recordId
    setUndoToast(null)
    await fetch(`/api/pbs/records/${id}`, { method: 'DELETE' })
    if (selectedStudent) loadStudentData(selectedStudent)
  }

  // 일괄 체크 모달 열기
  const openBulkModal = async () => {
    const res = await fetch('/api/pbs/goals')
    const data = await res.json()
    setAllGoals(data.goals || [])
    setBulkBehaviorName('')
    setBulkSelectedStudents([])
    setBulkCount(1)
    setShowBulkModal(true)
  }

  // 일괄 체크에서 선택된 행동명에 해당하는 학생 목록
  const bulkEligibleStudents = allGoals
    .filter(g => g.behavior_name === bulkBehaviorName)
    .map(g => {
      const student = students.find(s => s.id === g.student_id)
      return student ? { student, goalId: g.id } : null
    })
    .filter(Boolean) as { student: Student; goalId: string }[]

  const handleBulkCheck = async () => {
    if (!bulkBehaviorName || bulkSelectedStudents.length === 0) return
    setBulkSubmitting(true)

    const promises = bulkSelectedStudents.map(studentId => {
      const goal = allGoals.find(g => g.student_id === studentId && g.behavior_name === bulkBehaviorName)
      if (!goal) return Promise.resolve()
      return fetch('/api/pbs/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          goalId: goal.id,
          occurrenceCount: bulkCount,
          prompted: false,
        }),
      })
    })

    await Promise.all(promises)
    setBulkSubmitting(false)
    setShowBulkModal(false)
    if (selectedStudent) loadStudentData(selectedStudent)
  }

  // 목표 추가 모달 열기
  const openAddModal = () => {
    setEditingGoal(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (goal: PbsGoal) => {
    setEditingGoal(goal)
    setForm({
      behaviorName: goal.behavior_name,
      behaviorDefinition: goal.behavior_definition || '',
      tokenPerOccurrence: String(goal.token_per_occurrence),
      strategyType: goal.strategy_type || '',
      dailyTarget: goal.daily_target ? String(goal.daily_target) : '',
      allowSelfCheck: goal.allow_self_check,
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSaveGoal = async () => {
    if (!form.behaviorName.trim() || !form.tokenPerOccurrence) {
      setFormError('행동명과 토큰 단가는 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')

    try {
      if (editingGoal) {
        const res = await fetch(`/api/pbs/goals/${editingGoal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            behaviorName: form.behaviorName,
            behaviorDefinition: form.behaviorDefinition || null,
            tokenPerOccurrence: Number(form.tokenPerOccurrence),
            strategyType: form.strategyType || null,
            dailyTarget: form.dailyTarget ? Number(form.dailyTarget) : null,
            allowSelfCheck: form.allowSelfCheck,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          setFormError(data.error || '수정 실패')
          setSubmitting(false)
          return
        }
      } else {
        const res = await fetch('/api/pbs/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: selectedStudent,
            behaviorName: form.behaviorName,
            behaviorDefinition: form.behaviorDefinition || null,
            tokenPerOccurrence: Number(form.tokenPerOccurrence),
            strategyType: form.strategyType || null,
            dailyTarget: form.dailyTarget ? Number(form.dailyTarget) : null,
            allowSelfCheck: form.allowSelfCheck,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          setFormError(data.error || '등록 실패')
          setSubmitting(false)
          return
        }
      }
      setShowModal(false)
      if (selectedStudent) loadStudentData(selectedStudent)
    } catch {
      setFormError('서버 연결에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivateGoal = async (goalId: string) => {
    if (!confirm('이 PBS 목표를 비활성화하시겠습니까?')) return
    const res = await fetch(`/api/pbs/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    if (res.ok && selectedStudent) {
      loadStudentData(selectedStudent)
    }
  }

  const todayTotal = todayRecords.reduce((sum, r) => sum + r.token_granted, 0)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  const activeGoalCount = goals.length
  const checkedGoalCount = goals.filter(g => todayRecords.some(r => r.goal_id === g.id)).length
  const achievementRate = activeGoalCount > 0 ? Math.round((checkedGoalCount / activeGoalCount) * 100) : 0

  // 일괄 체크용 행동명 목록 (중복 제거)
  const uniqueBehaviorNames = [...new Set(allGoals.map(g => g.behavior_name))]

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">✅ PBS 행동 체크</h1>
          <p className="text-xs text-gray-400 mt-0.5">Positive Behavior Support · Cooper et al. (2020) 토큰 강화 기반</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">오늘 정산 예정</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(todayTotal)}</p>
        </div>
      </div>

      {/* 오늘 달성률 */}
      {selectedStudent && activeGoalCount > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-900">오늘 목표 달성률</p>
            <p className="text-sm font-bold text-blue-700">{checkedGoalCount}/{activeGoalCount} ({achievementRate}%)</p>
          </div>
          <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${achievementRate === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${achievementRate}%` }}
            />
          </div>
        </div>
      )}

      {/* 학생 선택 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {students.map((student) => (
          <button
            key={student.id}
            onClick={() => setSelectedStudent(student.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              selectedStudent === student.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {student.name}
            <span className="ml-1 text-xs opacity-70">LV.{student.pbs_stage}</span>
          </button>
        ))}
      </div>

      {/* 활성 행동계약서 배너 */}
      {activeContracts.length > 0 && (
        <div className="space-y-2">
          {activeContracts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-lg">📝</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-600 font-medium">진행 중 행동계약서</p>
                <p className="text-sm font-bold text-gray-900 truncate">{c.contract_title}</p>
                <p className="text-xs text-gray-500 truncate">표적: {c.target_behavior}{c.achievement_criteria ? ` · 기준: ${c.achievement_criteria}` : ''}</p>
              </div>
              {c.reward_amount > 0 && (
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg whitespace-nowrap">
                  달성 +{formatCurrency(c.reward_amount)}
                </span>
              )}
              <a
                href={`/${classCode}/contracts`}
                className="text-xs text-amber-500 hover:text-amber-700 whitespace-nowrap"
              >
                계약서 →
              </a>
            </div>
          ))}
        </div>
      )}

      {/* PBS 목표 체크 보드 */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">이 학생의 PBS 목표가 아직 없습니다.</p>
          <button
            onClick={openAddModal}
            className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            PBS 목표 추가
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={openBulkModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-medium rounded-xl transition-colors"
            >
              <span>👥</span> 일괄 체크
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              + 목표 추가
            </button>
          </div>

          <div className="grid gap-4">
            {goals.map((goal) => {
              const records = todayRecords.filter((r) => r.goal_id === goal.id)
              const todayCount = records.reduce((sum, r) => sum + r.occurrence_count, 0)
              const todayTokens = records.reduce((sum, r) => sum + r.token_granted, 0)
              const progressPct = goal.daily_target && goal.daily_target > 0
                ? Math.min(100, Math.round((todayCount / goal.daily_target) * 100))
                : null

              return (
                <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900">{goal.behavior_name}</h3>
                      {goal.behavior_definition && (
                        <p className="text-sm text-gray-500 mt-0.5">{goal.behavior_definition}</p>
                      )}
                      {goal.strategy_type && (
                        <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {goal.strategy_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <div className="text-right mr-2">
                        <p className="text-sm text-gray-500">1회당</p>
                        <p className="font-bold text-blue-600">{formatCurrency(goal.token_per_occurrence)}</p>
                      </div>
                      <button
                        onClick={() => openEditModal(goal)}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm transition-colors"
                        title="수정"
                      >✏️</button>
                      <button
                        onClick={() => handleDeactivateGoal(goal.id)}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 flex items-center justify-center text-sm transition-colors"
                        title="비활성화"
                      >🗑️</button>
                    </div>
                  </div>

                  {/* 일일 목표 진행바 */}
                  {progressPct !== null && (
                    <div className="mb-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>일일 목표</span>
                        <span className={progressPct >= 100 ? 'text-green-600 font-bold' : ''}>
                          {todayCount} / {goal.daily_target}회 {progressPct >= 100 ? '🎉' : `(${progressPct}%)`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-green-500' : 'bg-blue-400'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
                      <span className="text-sm text-gray-500">오늘</span>
                      <span className="text-lg font-bold text-gray-900">{todayCount}회</span>
                      <span className="text-sm text-green-600">+{formatCurrency(todayTokens)}</span>
                    </div>
                    <div className="flex gap-2 ml-auto">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleCheck(goal.id, n, goal.behavior_name)}
                          className="w-12 h-12 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 font-bold rounded-xl transition-colors border border-blue-200"
                        >
                          +{n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 오늘 체크 기록 */}
      {todayRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">오늘 체크 기록</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {todayRecords.map((record) => (
              <div key={record.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{record.pbs_goals?.behavior_name}</p>
                  <p className="text-sm text-gray-500">{record.occurrence_count}회 체크</p>
                </div>
                <p className="font-bold text-green-600">+{formatCurrency(record.token_granted)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* undo 토스트 */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4">
          <span className="text-sm">
            ✅ <strong>{undoToast.goalName}</strong> +{undoToast.count}회 체크 (+{formatCurrency(undoToast.tokens)})
          </span>
          <button
            onClick={handleUndo}
            className="text-xs font-bold text-yellow-300 hover:text-yellow-200 border border-yellow-400/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            실행취소 ({undoToast.secondsLeft}s)
          </button>
        </div>
      )}

      {/* 일괄 체크 모달 */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">👥 일괄 체크</h2>
            <p className="text-sm text-gray-500">같은 행동 목표를 여러 학생에게 동시에 체크합니다.</p>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">행동 목표 선택</span>
              <select
                value={bulkBehaviorName}
                onChange={(e) => {
                  setBulkBehaviorName(e.target.value)
                  setBulkSelectedStudents([])
                }}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {uniqueBehaviorNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>

            {bulkBehaviorName && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    해당 목표가 있는 학생 ({bulkEligibleStudents.length}명)
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {bulkEligibleStudents.length === 0 ? (
                      <p className="text-sm text-gray-400">해당 목표가 있는 학생이 없습니다.</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const all = bulkEligibleStudents.map(e => e.student.id)
                            setBulkSelectedStudents(
                              bulkSelectedStudents.length === all.length ? [] : all
                            )
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {bulkSelectedStudents.length === bulkEligibleStudents.length ? '전체 해제' : '전체 선택'}
                        </button>
                        {bulkEligibleStudents.map(({ student }) => (
                          <label key={student.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bulkSelectedStudents.includes(student.id)}
                              onChange={(e) => {
                                setBulkSelectedStudents(prev =>
                                  e.target.checked
                                    ? [...prev, student.id]
                                    : prev.filter(id => id !== student.id)
                                )
                              }}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-900">{student.name}</span>
                            <span className="text-xs text-gray-400">LV.{student.pbs_stage}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">체크 횟수</p>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBulkCount(n)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                          bulkCount === n
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleBulkCheck}
                disabled={bulkSubmitting || !bulkBehaviorName || bulkSelectedStudents.length === 0}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors"
              >
                {bulkSubmitting ? '체크 중...' : `${bulkSelectedStudents.length}명 체크`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 목표 추가/편집 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">
              {editingGoal ? 'PBS 목표 수정' : 'PBS 목표 추가'}
            </h2>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">목표 행동명 *</span>
              <input
                type="text"
                value={form.behaviorName}
                onChange={(e) => setForm({ ...form, behaviorName: e.target.value })}
                placeholder="예: 손 들고 발표하기"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">행동 정의 (선택)</span>
              <textarea
                value={form.behaviorDefinition}
                onChange={(e) => setForm({ ...form, behaviorDefinition: e.target.value })}
                placeholder="관찰 가능한 행동 정의를 적어주세요"
                rows={2}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">1회당 토큰 (원) *</span>
                <input
                  type="number"
                  value={form.tokenPerOccurrence}
                  onChange={(e) => setForm({ ...form, tokenPerOccurrence: e.target.value })}
                  placeholder="예: 100"
                  min={1}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">일일 목표 횟수</span>
                <input
                  type="number"
                  value={form.dailyTarget}
                  onChange={(e) => setForm({ ...form, dailyTarget: e.target.value })}
                  placeholder="예: 5"
                  min={1}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                중재 전략 (선택)
                {libraryStrategies.length > 0 && (
                  <span className="ml-1.5 text-xs text-blue-500">— 라이브러리 {libraryStrategies.length}개</span>
                )}
              </span>
              <select
                value={form.strategyType}
                onChange={(e) => setForm({ ...form, strategyType: e.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택 안 함</option>
                {libraryStrategies.length > 0 ? (
                  libraryStrategies.map((s) => (
                    <option key={s.id} value={s.strategy_name}>{s.strategy_name}</option>
                  ))
                ) : (
                  ['DRA', 'DRI', 'DRO', 'DRL', 'FCT', 'NCR', 'BC', 'Shaping', 'SM', 'TA', 'TM-CM'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))
                )}
              </select>
            </label>

            <label className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">학생 셀프체크 허용</span>
                <p className="text-xs text-gray-400 mt-0.5">학생이 직접 이 목표를 체크할 수 있습니다</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.allowSelfCheck}
                onClick={() => setForm({ ...form, allowSelfCheck: !form.allowSelfCheck })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.allowSelfCheck ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.allowSelfCheck ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '저장 중...' : editingGoal ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
