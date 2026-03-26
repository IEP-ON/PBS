'use client'

import { useState, useEffect, useCallback } from 'react'
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

type GoalFormData = {
  behaviorName: string
  behaviorDefinition: string
  tokenPerOccurrence: string
  strategyType: string
}

const emptyForm: GoalFormData = { behaviorName: '', behaviorDefinition: '', tokenPerOccurrence: '', strategyType: '' }

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

  // 모달 상태
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<PbsGoal | null>(null)
  const [form, setForm] = useState<GoalFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const handleCheck = async (goalId: string, count: number) => {
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
      loadStudentData(selectedStudent)
    }
  }

  // 목표 추가 모달 열기
  const openAddModal = () => {
    setEditingGoal(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  // 목표 편집 모달 열기
  const openEditModal = (goal: PbsGoal) => {
    setEditingGoal(goal)
    setForm({
      behaviorName: goal.behavior_name,
      behaviorDefinition: goal.behavior_definition || '',
      tokenPerOccurrence: String(goal.token_per_occurrence),
      strategyType: goal.strategy_type || '',
    })
    setFormError('')
    setShowModal(true)
  }

  // 목표 저장 (추가 or 수정)
  const handleSaveGoal = async () => {
    if (!form.behaviorName.trim() || !form.tokenPerOccurrence) {
      setFormError('행동명과 토큰 단가는 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')

    try {
      if (editingGoal) {
        // 수정
        const res = await fetch(`/api/pbs/goals/${editingGoal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            behaviorName: form.behaviorName,
            behaviorDefinition: form.behaviorDefinition || null,
            tokenPerOccurrence: Number(form.tokenPerOccurrence),
            strategyType: form.strategyType || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          setFormError(data.error || '수정 실패')
          setSubmitting(false)
          return
        }
      } else {
        // 추가
        const res = await fetch('/api/pbs/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: selectedStudent,
            behaviorName: form.behaviorName,
            behaviorDefinition: form.behaviorDefinition || null,
            tokenPerOccurrence: Number(form.tokenPerOccurrence),
            strategyType: form.strategyType || null,
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

  // 목표 비활성화
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">✅ PBS 행동 체크</h1>
        <div className="text-right">
          <p className="text-sm text-gray-500">오늘 정산 예정</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(todayTotal)}</p>
        </div>
      </div>

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

      {/* 활성 행동계약서 요약 배너 */}
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
          <div className="flex justify-end">
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

              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
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
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <p className="text-sm text-gray-500">1회당</p>
                        <p className="font-bold text-blue-600">
                          {formatCurrency(goal.token_per_occurrence)}
                        </p>
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

                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
                      <span className="text-sm text-gray-500">오늘</span>
                      <span className="text-lg font-bold text-gray-900">{todayCount}회</span>
                      <span className="text-sm text-green-600">+{formatCurrency(todayTokens)}</span>
                    </div>

                    <div className="flex gap-2 ml-auto">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleCheck(goal.id, n)}
                          className="w-12 h-12 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors border border-blue-200"
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
                  <p className="font-medium text-gray-900">
                    {record.pbs_goals?.behavior_name}
                  </p>
                  <p className="text-sm text-gray-500">{record.occurrence_count}회 체크</p>
                </div>
                <p className="font-bold text-green-600">
                  +{formatCurrency(record.token_granted)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 목표 추가/편집 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
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
              {libraryStrategies.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">중재전략 라이브러리에 전략을 등록하면 여기에 표시됩니다.</p>
              )}
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
