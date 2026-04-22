'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import PrintableContract from '../../contracts/PrintableContract'

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
  reward_description?: string | null
  behavior_image_url?: string | null
  reward_image_url?: string | null
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
  rewardDescription: string
  contractStart: string
  contractEnd: string
  teacherNote: string
  behaviorImageFile: File | null
  rewardImageFile: File | null
  behaviorImagePreview: string
  rewardImagePreview: string
  clearBehaviorImage: boolean
  clearRewardImage: boolean
}

const emptyForm = (): ContractForm => ({
  studentId: '',
  contractTitle: '',
  targetBehavior: '',
  behaviorDefinition: '',
  measurementMethod: '',
  achievementCriteria: '',
  rewardAmount: '',
  rewardDescription: '',
  contractStart: new Date().toISOString().split('T')[0],
  contractEnd: '',
  teacherNote: '',
  behaviorImageFile: null,
  rewardImageFile: null,
  behaviorImagePreview: '',
  rewardImagePreview: '',
  clearBehaviorImage: false,
  clearRewardImage: false,
})

function buildJsonPayload(form: ContractForm, editingId: string | null) {
  const base: Record<string, unknown> = {
    contractTitle: form.contractTitle,
    targetBehavior: form.targetBehavior,
    behaviorDefinition: form.behaviorDefinition || null,
    measurementMethod: form.measurementMethod || null,
    achievementCriteria: form.achievementCriteria || null,
    rewardAmount: form.rewardAmount ? Number(form.rewardAmount) : 0,
    contractStart: form.contractStart || null,
    contractEnd: form.contractEnd || null,
    teacherNote: form.teacherNote || null,
    rewardDescription: form.rewardDescription || null,
  }
  if (!editingId) {
    base.studentId = form.studentId
  }
  if (editingId) {
    if (form.clearBehaviorImage) base.behaviorImageUrl = null
    if (form.clearRewardImage) base.rewardImageUrl = null
  }
  return base
}

export function ContractsListView() {
  const params = useParams()
  const classCode = params.classCode as string

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
  const [qrIssueContract, setQrIssueContract] = useState<Contract | null>(null)
  const [qrIssueCount, setQrIssueCount] = useState('1')
  const [qrIssueAmount, setQrIssueAmount] = useState('')
  const [qrIssueLabel, setQrIssueLabel] = useState('')
  const [qrIssueBusy, setQrIssueBusy] = useState(false)
  const [qrIssueError, setQrIssueError] = useState('')
  const [qrIssueCodes, setQrIssueCodes] = useState<string[]>([])

  const fetchData = async () => {
    const [sRes, cRes] = await Promise.all([fetch('/api/students'), fetch('/api/contracts')])
    const sData = await sRes.json()
    const cData = await cRes.json()
    setStudents(sData.students || [])
    setContracts(cData.contracts || [])
    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const openAddModal = () => {
    setEditingId(null)
    setForm(emptyForm())
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
      rewardDescription: c.reward_description || '',
      contractStart: c.contract_start || '',
      contractEnd: c.contract_end || '',
      teacherNote: c.teacher_note || '',
      behaviorImageFile: null,
      rewardImageFile: null,
      behaviorImagePreview: c.behavior_image_url || '',
      rewardImagePreview: c.reward_image_url || '',
      clearBehaviorImage: false,
      clearRewardImage: false,
    })
    setFormError('')
    setShowModal(true)
  }

  const setBehaviorFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setForm((prev) => ({
      ...prev,
      behaviorImageFile: f,
      behaviorImagePreview: URL.createObjectURL(f),
      clearBehaviorImage: false,
    }))
  }

  const setRewardFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setForm((prev) => ({
      ...prev,
      rewardImageFile: f,
      rewardImagePreview: URL.createObjectURL(f),
      clearRewardImage: false,
    }))
  }

  const handleSave = async () => {
    if (!form.contractTitle || !form.targetBehavior || (!editingId && !form.studentId)) {
      setFormError('학생, 계약 제목, 표적 행동은 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')

    try {
      const payload = buildJsonPayload(form, editingId)
      let contractId: string | null = editingId

      if (editingId) {
        const res = await fetch(`/api/contracts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const patchJson = (await res.json()) as { error?: string; details?: string }
        if (!res.ok) {
          setFormError(
            [patchJson.error, patchJson.details].filter(Boolean).join(' — ') || '수정 실패'
          )
          return
        }
      } else {
        const res = await fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const postJson = (await res.json()) as {
          contract?: { id: string }
          error?: string
          details?: string
        }
        if (!res.ok) {
          setFormError(
            [postJson.error, postJson.details].filter(Boolean).join(' — ') || '등록 실패'
          )
          return
        }
        contractId = postJson.contract?.id ?? null
      }

      if (contractId && (form.behaviorImageFile || form.rewardImageFile)) {
        const fd = new FormData()
        if (form.behaviorImageFile) fd.append('behaviorImage', form.behaviorImageFile)
        if (form.rewardImageFile) fd.append('rewardImage', form.rewardImageFile)
        const imgRes = await fetch(`/api/contracts/${contractId}/images`, { method: 'POST', body: fd })
        const imgJson = (await imgRes.json()) as { error?: string; details?: string }
        if (!imgRes.ok) {
          setFormError(
            [imgJson.error, imgJson.details].filter(Boolean).join(' — ') ||
              '계약은 저장되었으나 이미지 업로드에 실패했습니다.'
          )
          void fetchData()
          return
        }
      }

      setShowModal(false)
      setForm(emptyForm())
      void fetchData()
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
    void fetchData()
  }

  const openQrIssueModal = (c: Contract) => {
    setQrIssueContract(c)
    setQrIssueCount('1')
    setQrIssueAmount(c.reward_amount > 0 ? String(c.reward_amount) : '100')
    setQrIssueLabel(`${c.contract_title} 보상`)
    setQrIssueError('')
    setQrIssueCodes([])
  }

  const issueQrTokens = async () => {
    if (!qrIssueContract) return
    const count = Math.min(50, Math.max(1, Math.floor(Number(qrIssueCount) || 1)))
    const amount = Math.max(1, Math.floor(Number(qrIssueAmount) || 0))
    if (!amount) {
      setQrIssueError('금액을 입력해 주세요.')
      return
    }
    setQrIssueBusy(true)
    setQrIssueError('')
    try {
      const res = await fetch('/api/qr-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          count,
          label: qrIssueLabel.trim() || `${qrIssueContract.contract_title} 보상`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setQrIssueError(data.error || '발급에 실패했습니다.')
        return
      }
      const codes = (data.tokens as { code: string }[] | undefined)?.map((t) => t.code) || []
      setQrIssueCodes(codes)
    } catch {
      setQrIssueError('네트워크 오류가 발생했습니다.')
    } finally {
      setQrIssueBusy(false)
    }
  }

  const toggleSign = async (c: Contract, field: 'studentSigned' | 'parentSigned') => {
    const current = field === 'studentSigned' ? c.student_signed : c.parent_signed
    await fetch(`/api/contracts/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })
    void fetchData()
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const filtered = filterStudent ? contracts.filter((c) => c.student_id === filterStudent) : contracts

  const activeContracts = contracts.filter((c) => c.is_active)
  const fullySignedCount = contracts.filter((c) => c.teacher_signed && c.student_signed && c.parent_signed).length
  const totalReward = activeContracts.reduce((s, c) => s + c.reward_amount, 0)
  const today = new Date().toISOString().split('T')[0]

  const signProgress = (c: Contract) => {
    const total = 3
    const done = [c.teacher_signed, c.student_signed, c.parent_signed].filter(Boolean).length
    return Math.round((done / total) * 100)
  }

  const imageSlot = (
    label: string,
    preview: string,
    onPick: (e: ChangeEvent<HTMLInputElement>) => void,
    onClear: () => void,
    inputId: string
  ) => (
    <div className="space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-2 items-start">
        <label className="cursor-pointer inline-flex px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-800">
          파일 선택
          <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </label>
        {preview && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-red-600 hover:underline px-1 py-2"
          >
            제거
          </button>
        )}
      </div>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="mt-1 w-24 h-24 object-cover rounded-lg border border-gray-200" />
      ) : (
        <p className="text-xs text-gray-400 mt-1">인쇄 시 아이콘으로 대체됩니다.</p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">📝 행동계약서</h1>
        <div className="flex items-center gap-2">
          <Link href={`/${classCode}/qr-tokens`} className="text-sm text-emerald-700 hover:underline">
            QR 토큰 관리 →
          </Link>
          <Link
            href={`/${classCode}/students/qr-cards`}
            className="text-sm text-blue-600 hover:underline"
          >
            QR 카드·토큰 인쇄 →
          </Link>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + 계약서 작성
          </button>
        </div>
      </div>

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

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilterStudent('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            !filterStudent ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          전체 ({contracts.length})
        </button>
        {students.map((s) => {
          const cnt = contracts.filter((c) => c.student_id === s.id && c.is_active).length
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterStudent(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStudent === s.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {s.name}
              {cnt > 0 && <span className="ml-1 text-xs opacity-70">({cnt})</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">행동계약서가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-2">학생 상세 페이지 → AI 행동 지원 계획에서 자동 생성할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const isExpiring = c.is_active && c.contract_end && c.contract_end <= today
            const signPct = signProgress(c)
            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border p-5 space-y-3 ${
                  isExpiring ? 'border-red-300' : c.is_active ? 'border-green-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{c.contract_title}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {c.is_active ? '진행중' : '종료'}
                      </span>
                      {isExpiring && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">⚠️ 만료</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {c.pbs_students?.name || '학생'} · {c.target_behavior}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setPrintContract(c)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors text-sm"
                      title="계약서 출력"
                    >
                      🖨️
                    </button>
                    <button
                      type="button"
                      onClick={() => openQrIssueModal(c)}
                      className="p-2 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors text-sm"
                      title="달성 보상 QR 토큰 발급"
                    >
                      🪙
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        c.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {c.is_active ? '종료' : '재활성'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {(c.behavior_image_url || c.reward_image_url) && (
                    <div className="flex gap-2">
                      {c.behavior_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.behavior_image_url}
                          alt="행동"
                          className="w-14 h-14 object-cover rounded-lg border border-gray-100"
                        />
                      )}
                      {c.reward_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.reward_image_url}
                          alt="보상"
                          className="w-14 h-14 object-cover rounded-lg border border-gray-100"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {c.behavior_definition && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-900 font-medium">행동 정의</p>
                      <p className="text-gray-900 text-xs mt-0.5">{c.behavior_definition}</p>
                    </div>
                  )}
                  {c.measurement_method && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-900 font-medium">측정 방법</p>
                      <p className="text-gray-900 text-xs mt-0.5">{c.measurement_method}</p>
                    </div>
                  )}
                  {c.achievement_criteria && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 font-medium">달성 기준</p>
                      <p className="text-gray-700 text-xs mt-0.5">{c.achievement_criteria}</p>
                    </div>
                  )}
                  {c.reward_description && (
                    <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                      <p className="text-xs text-violet-700 font-medium">보상 설명</p>
                      <p className="text-gray-700 text-xs mt-0.5">{c.reward_description}</p>
                    </div>
                  )}
                  {c.reward_amount > 0 && (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-green-600 font-medium">달성 보상</p>
                      <p className="text-green-700 font-bold mt-0.5">{formatCurrency(c.reward_amount)}</p>
                    </div>
                  )}
                </div>

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
                      {c.contract_start}
                      {c.contract_end ? ` ~ ${c.contract_end}` : ' ~'}
                    </p>
                    <div className="flex gap-1.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-lg ${
                          c.teacher_signed ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        교사 {c.teacher_signed ? '✓' : '○'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSign(c, 'studentSigned')}
                        className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                          c.student_signed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50'
                        }`}
                      >
                        학생 {c.student_signed ? '✓' : '○'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSign(c, 'parentSigned')}
                        className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                          c.parent_signed ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 hover:bg-purple-50'
                        }`}
                      >
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">{editingId ? '계약서 수정' : '행동계약서 작성'}</h2>

            {!editingId && (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">학생 *</span>
                <select
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">학생 선택</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">계약 제목 *</span>
              <input
                type="text"
                value={form.contractTitle}
                onChange={(e) => setForm({ ...form, contractTitle: e.target.value })}
                placeholder="예: 수업 중 이탈 행동 감소"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">표적 행동 *</span>
              <input
                type="text"
                value={form.targetBehavior}
                onChange={(e) => setForm({ ...form, targetBehavior: e.target.value })}
                placeholder="예: 자리 이탈"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">행동 정의</span>
              <textarea
                value={form.behaviorDefinition}
                onChange={(e) => setForm({ ...form, behaviorDefinition: e.target.value })}
                placeholder="관찰 가능한 행동 정의"
                rows={2}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {imageSlot(
                '표적 행동 그림 (난독 지원)',
                form.behaviorImagePreview,
                setBehaviorFile,
                () =>
                  setForm((prev) => ({
                    ...prev,
                    behaviorImageFile: null,
                    behaviorImagePreview: '',
                    clearBehaviorImage: Boolean(editingId),
                  })),
                'contract-behavior-img'
              )}
              {imageSlot(
                '보상 그림 (난독 지원)',
                form.rewardImagePreview,
                setRewardFile,
                () =>
                  setForm((prev) => ({
                    ...prev,
                    rewardImageFile: null,
                    rewardImagePreview: '',
                    clearRewardImage: Boolean(editingId),
                  })),
                'contract-reward-img'
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">측정 방법</span>
                <input
                  type="text"
                  value={form.measurementMethod}
                  onChange={(e) => setForm({ ...form, measurementMethod: e.target.value })}
                  placeholder="빈도/지속시간"
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">달성 기준</span>
                <input
                  type="text"
                  value={form.achievementCriteria}
                  onChange={(e) => setForm({ ...form, achievementCriteria: e.target.value })}
                  placeholder="하루 2회 이하"
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">보상 내용 설명</span>
              <input
                type="text"
                value={form.rewardDescription}
                onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })}
                placeholder="예: 쉬는 시간 5분 더, 스티커 1장"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">보상 금액</span>
                <input
                  type="number"
                  value={form.rewardAmount}
                  onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
                  placeholder="500"
                  min={0}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">시작일</span>
                <input
                  type="date"
                  value={form.contractStart}
                  onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">종료일</span>
                <input
                  type="date"
                  value={form.contractEnd}
                  onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">교사 메모</span>
              <textarea
                value={form.teacherNote}
                onChange={(e) => setForm({ ...form, teacherNote: e.target.value })}
                placeholder="교사 참고 메모 (학생에게 미공개)"
                rows={2}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '저장 중...' : editingId ? '수정' : '작성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrIssueContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-gray-900">QR 토큰 발급</h2>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{qrIssueContract.contract_title}</span> ·{' '}
              {qrIssueContract.pbs_students?.name || '학생'}
            </p>
            <label className="block text-sm font-medium text-gray-700">
              금액 (원)
              <input
                type="number"
                min={1}
                value={qrIssueAmount}
                onChange={(e) => setQrIssueAmount(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              개수 (최대 50)
              <input
                type="number"
                min={1}
                max={50}
                value={qrIssueCount}
                onChange={(e) => setQrIssueCount(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              라벨
              <input
                type="text"
                value={qrIssueLabel}
                onChange={(e) => setQrIssueLabel(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>
            {qrIssueError ? <p className="text-sm text-red-600">{qrIssueError}</p> : null}
            {qrIssueCodes.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-emerald-800">발급 완료 · 코드 {qrIssueCodes.length}개</p>
                <textarea
                  readOnly
                  className="mt-2 h-32 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs"
                  value={qrIssueCodes.join('\n')}
                />
                <p className="mt-2 text-xs text-gray-500">
                  QR 토큰 관리 화면에서 동전 형태로 인쇄할 수 있습니다.
                </p>
                <Link
                  href={`/${classCode}/qr-tokens`}
                  className="mt-2 inline-block text-sm font-bold text-emerald-700 hover:underline"
                >
                  QR 토큰 관리로 이동 →
                </Link>
              </div>
            ) : null}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQrIssueContract(null)}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={qrIssueBusy || qrIssueCodes.length > 0}
                onClick={() => void issueQrTokens()}
                className="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-500 disabled:bg-amber-300"
              >
                {qrIssueBusy ? '발급 중…' : '발급'}
              </button>
            </div>
          </div>
        </div>
      )}

      {printContract && <PrintableContract contract={printContract} onClose={() => setPrintContract(null)} />}
    </div>
  )
}
