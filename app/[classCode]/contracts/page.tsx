'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import PrintableContract from './PrintableContract'

interface Student {
  id: string
  name: string
}

interface Contract {
  id: string
  student_id: string
  contract_title: string
  target_behavior: string
  behavior_definition: string | null
  measurement_method: string | null
  achievement_criteria: string | null
  reward_amount: number
  contract_start: string
  contract_end: string | null
  is_active: boolean
  teacher_signed: boolean
  student_signed: boolean
  parent_signed: boolean
  teacher_note: string | null
  created_at: string
  pbs_students: { name: string } | null
}

type ContractForm = {
  studentId: string
  contractTitle: string
  targetBehavior: string
  behaviorDefinition: string
  measurementMethod: string
  achievementCriteria: string
  rewardAmount: string
  contractStart: string
  contractEnd: string
  teacherNote: string
}

const emptyForm: ContractForm = {
  studentId: '',
  contractTitle: '',
  targetBehavior: '',
  behaviorDefinition: '',
  measurementMethod: '',
  achievementCriteria: '',
  rewardAmount: '',
  contractStart: new Date().toISOString().split('T')[0],
  contractEnd: '',
  teacherNote: '',
}

export default function ContractsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ContractForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStudent, setFilterStudent] = useState('')
  const [printContract, setPrintContract] = useState<Contract | null>(null)

  const fetchData = async () => {
    const [sRes, cRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/contracts'),
    ])
    const sData = await sRes.json()
    const cData = await cRes.json()
    setStudents(sData.students || [])
    setContracts(cData.contracts || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openAddModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (c: Contract) => {
    setEditingId(c.id)
    setForm({
      studentId: c.student_id,
      contractTitle: c.contract_title,
      targetBehavior: c.target_behavior,
      behaviorDefinition: c.behavior_definition || '',
      measurementMethod: c.measurement_method || '',
      achievementCriteria: c.achievement_criteria || '',
      rewardAmount: String(c.reward_amount || ''),
      contractStart: c.contract_start || '',
      contractEnd: c.contract_end || '',
      teacherNote: c.teacher_note || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.contractTitle || !form.targetBehavior || (!editingId && !form.studentId)) {
      setFormError('학생, 계약 제목, 표적 행동은 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')

    try {
      if (editingId) {
        const res = await fetch(`/api/contracts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractTitle: form.contractTitle,
            targetBehavior: form.targetBehavior,
            behaviorDefinition: form.behaviorDefinition || null,
            measurementMethod: form.measurementMethod || null,
            achievementCriteria: form.achievementCriteria || null,
            rewardAmount: form.rewardAmount ? Number(form.rewardAmount) : 0,
            contractStart: form.contractStart || null,
            contractEnd: form.contractEnd || null,
            teacherNote: form.teacherNote || null,
          }),
        })
        if (!res.ok) { setFormError('수정 실패'); return }
      } else {
        const res = await fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) { setFormError('등록 실패'); return }
      }
      setShowModal(false)
      fetchData()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (c: Contract) => {
    await fetch(`/api/contracts/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.is_active }),
    })
    fetchData()
  }

  const toggleSign = async (c: Contract, field: 'studentSigned' | 'parentSigned') => {
    const current = field === 'studentSigned' ? c.student_signed : c.parent_signed
    await fetch(`/api/contracts/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })
    fetchData()
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const filtered = filterStudent
    ? contracts.filter(c => c.student_id === filterStudent)
    : contracts

  const activeContracts = contracts.filter(c => c.is_active)
  const fullySignedCount = contracts.filter(c => c.teacher_signed && c.student_signed && c.parent_signed).length
  const totalReward = activeContracts.reduce((s, c) => s + c.reward_amount, 0)

  const today = new Date().toISOString().split('T')[0]

  const signProgress = (c: Contract) => {
    const total = 3
    const done = [c.teacher_signed, c.student_signed, c.parent_signed].filter(Boolean).length
    return Math.round((done / total) * 100)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📝 행동계약서</h1>
        <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
          + 계약서 작성
        </button>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{activeContracts.length}</p>
          <p className="text-xs text-green-600 mt-0.5">진행 중 계약서</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{fullySignedCount}</p>
          <p className="text-xs text-blue-600 mt-0.5">3자 서명 완료</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
          <p className="text-lg font-bold text-amber-700">{formatCurrency(totalReward)}</p>
          <p className="text-xs text-amber-600 mt-0.5">진행 중 보상 합계</p>
        </div>
      </div>

      {/* 학생 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterStudent('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!filterStudent ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >전체 ({contracts.length})</button>
        {students.map(s => {
          const cnt = contracts.filter(c => c.student_id === s.id && c.is_active).length
          return (
            <button
              key={s.id}
              onClick={() => setFilterStudent(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStudent === s.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              {s.name}{cnt > 0 && <span className="ml-1 text-xs opacity-70">({cnt})</span>}
            </button>
          )
        })}
      </div>

      {/* 계약서 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">행동계약서가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-2">학생 상세 페이지 → AI 행동 지원 계획에서 자동 생성할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => {
            const isExpiring = c.is_active && c.contract_end && c.contract_end <= today
            const signPct = signProgress(c)
            return (
              <div key={c.id} className={`bg-white rounded-2xl border p-5 space-y-3 ${isExpiring ? 'border-red-300' : c.is_active ? 'border-green-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{c.contract_title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {c.is_active ? '진행중' : '종료'}
                      </span>
                      {isExpiring && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">⚠️ 만료</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {c.pbs_students?.name || '학생'} · {c.target_behavior}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPrintContract(c)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors text-sm" title="계약서 출력">🖨️</button>
                    <button onClick={() => openEditModal(c)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors text-sm">✏️</button>
                    <button onClick={() => toggleActive(c)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${c.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {c.is_active ? '종료' : '재활성'}
                    </button>
                  </div>
                </div>

                {/* 상세 정보 */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {c.behavior_definition && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">행동 정의</p>
                      <p className="text-gray-700 text-xs mt-0.5">{c.behavior_definition}</p>
                    </div>
                  )}
                  {c.measurement_method && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">측정 방법</p>
                      <p className="text-gray-700 text-xs mt-0.5">{c.measurement_method}</p>
                    </div>
                  )}
                  {c.achievement_criteria && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 font-medium">달성 기준</p>
                      <p className="text-gray-700 text-xs mt-0.5">{c.achievement_criteria}</p>
                    </div>
                  )}
                  {c.reward_amount > 0 && (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-green-600 font-medium">달성 보상</p>
                      <p className="text-green-700 font-bold mt-0.5">{formatCurrency(c.reward_amount)}</p>
                    </div>
                  )}
                </div>

                {/* 서명 진행률 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">서명 진행률</p>
                    <p className="text-xs font-medium text-gray-700">{signPct}%</p>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${signPct === 100 ? 'bg-green-500' : 'bg-blue-400'}`}
                      style={{ width: `${signPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      {c.contract_start}{c.contract_end ? ` ~ ${c.contract_end}` : ' ~'}
                    </p>
                    <div className="flex gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${c.teacher_signed ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>교사 {c.teacher_signed ? '✓' : '○'}</span>
                      <button onClick={() => toggleSign(c, 'studentSigned')} className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${c.student_signed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50'}`}>
                        학생 {c.student_signed ? '✓' : '○'}
                      </button>
                      <button onClick={() => toggleSign(c, 'parentSigned')} className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${c.parent_signed ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 hover:bg-purple-50'}`}>
                        보호자 {c.parent_signed ? '✓' : '○'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? '계약서 수정' : '행동계약서 작성'}
            </h2>

            {!editingId && (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">학생 *</span>
                <select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">학생 선택</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">계약 제목 *</span>
              <input type="text" value={form.contractTitle} onChange={e => setForm({ ...form, contractTitle: e.target.value })} placeholder="예: 수업 중 이탈 행동 감소" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">표적 행동 *</span>
              <input type="text" value={form.targetBehavior} onChange={e => setForm({ ...form, targetBehavior: e.target.value })} placeholder="예: 자리 이탈" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">행동 정의</span>
              <textarea value={form.behaviorDefinition} onChange={e => setForm({ ...form, behaviorDefinition: e.target.value })} placeholder="관찰 가능한 행동 정의" rows={2} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">측정 방법</span>
                <input type="text" value={form.measurementMethod} onChange={e => setForm({ ...form, measurementMethod: e.target.value })} placeholder="빈도/지속시간" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">달성 기준</span>
                <input type="text" value={form.achievementCriteria} onChange={e => setForm({ ...form, achievementCriteria: e.target.value })} placeholder="하루 2회 이하" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">보상 금액</span>
                <input type="number" value={form.rewardAmount} onChange={e => setForm({ ...form, rewardAmount: e.target.value })} placeholder="500" min={0} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">시작일</span>
                <input type="date" value={form.contractStart} onChange={e => setForm({ ...form, contractStart: e.target.value })} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">종료일</span>
                <input type="date" value={form.contractEnd} onChange={e => setForm({ ...form, contractEnd: e.target.value })} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">교사 메모</span>
              <textarea value={form.teacherNote} onChange={e => setForm({ ...form, teacherNote: e.target.value })} placeholder="교사 참고 메모 (학생에게 미공개)" rows={2} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </label>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">취소</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors">
                {submitting ? '저장 중...' : editingId ? '수정' : '작성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄용 계약서 */}
      {printContract && (
        <PrintableContract
          contract={printContract}
          onClose={() => setPrintContract(null)}
        />
      )}
    </div>
  )
}
