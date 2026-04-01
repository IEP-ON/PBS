'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  studentId: string
  classCode: string
  initialData: {
    name: string
    grade: number | null
    pbs_stage: number
    response_cost_enabled: boolean
  }
}

export default function EditStudentButton({ studentId, classCode, initialData }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: initialData.name,
    grade: initialData.grade?.toString() || '',
    pbsStage: initialData.pbs_stage.toString(),
    responseCostEnabled: initialData.response_cost_enabled,
    pin: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('이름은 필수입니다.')
      return
    }
    setSubmitting(true)
    setError('')

    const body: Record<string, unknown> = {
      name: form.name,
      grade: form.grade ? Number(form.grade) : null,
      pbs_stage: Number(form.pbsStage),
      response_cost_enabled: form.responseCostEnabled,
    }
    if (form.pin.length === 4) {
      body.pin = form.pin
    }

    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowModal(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || '수정 실패')
      }
    } catch {
      setError('서버 연결 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('학생을 완전히 삭제할까요? 통장, 거래내역, PBS 기록, 말 일기 등 모든 데이터가 함께 삭제됩니다.')) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setShowModal(false)
        router.push(`/${classCode}/students`)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || '학생 삭제 실패')
      }
    } catch {
      setError('서버 연결 실패')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
      >
        ✏️ 정보 수정
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">학생 정보 수정</h2>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">이름 *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">학년</span>
              <input
                type="number"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                min={1} max={6}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">PBS 단계</span>
              <select
                value={form.pbsStage}
                onChange={(e) => setForm({ ...form, pbsStage: e.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">LV.1 (기본)</option>
                <option value="2">LV.2 (심화)</option>
                <option value="3">LV.3 (자립)</option>
              </select>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.responseCostEnabled}
                onChange={(e) => setForm({ ...form, responseCostEnabled: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">반응대가 활성화</span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">PIN 변경 (4자리, 비워두면 유지)</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="●●●●"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">위험 작업</p>
              <p className="mt-1 text-xs text-red-600">학생 정보, 통장, PBS 기록, 말 일기 등 모든 백엔드 데이터가 함께 삭제됩니다.</p>
              <button
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="mt-3 w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:bg-red-300"
              >
                {deleting ? '삭제 중...' : '학생 완전 삭제'}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={submitting || deleting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
