'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface Student {
  id: string
  name: string
  grade: number | null
  pbs_stage: number
  qr_code: string
  response_cost_enabled: boolean
  ai_profile_summary: string | null
  public_safe_summary: string | null
  pbs_accounts: { balance: number; total_earned: number; total_spent: number } | null
}

export default function StudentsPage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', grade: '', pin: '', pinConfirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadStudents = () => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const handleSubmit = async () => {
    setError('')

    if (!form.name || !form.pin) {
      setError('이름과 PIN을 입력해주세요.')
      return
    }

    if (form.pin.length !== 4) {
      setError('PIN은 4자리여야 합니다.')
      return
    }

    if (form.pin !== form.pinConfirm) {
      setError('PIN이 일치하지 않습니다.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          grade: form.grade ? parseInt(form.grade) : undefined,
          pin: form.pin,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        setSubmitting(false)
        return
      }

      setForm({ name: '', grade: '', pin: '', pinConfirm: '' })
      setShowForm(false)
      loadStudents()
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900">👨‍🎓 학생 관리</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/${classCode}/students/qr-cards`}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl transition-colors"
          >
            🪪 QR 일괄 출력
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {showForm ? '취소' : '+ 학생 등록'}
          </button>
        </div>
      </div>

      {/* 학생 등록 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-gray-900">새 학생 등록</h2>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">이름 *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="학생 이름"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">학년</span>
              <input
                type="number"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 3"
                min={1}
                max={6}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">PIN 4자리 *</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="●●●●"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">PIN 확인 *</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={form.pinConfirm}
                onChange={(e) => setForm({ ...form, pinConfirm: e.target.value.replace(/\D/g, '') })}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="●●●●"
              />
            </label>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
          >
            {submitting ? '등록 중...' : '학생 등록'}
          </button>
        </div>
      )}

      {/* 학생 목록 */}
      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500">아직 등록된 학생이 없습니다.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            첫 학생 등록하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {students.map((student) => {
            const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
            return (
              <Link
                key={student.id}
                href={`/${classCode}/students/${student.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-500">
                      {student.grade ? `${student.grade}학년` : ''} · PBS LV.{student.pbs_stage}
                      {student.response_cost_enabled && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">RC</span>
                      )}
                    </p>
                    {student.ai_profile_summary && (
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500">
                        {student.ai_profile_summary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{formatCurrency(account?.balance || 0)}</p>
                  <p className="text-xs text-gray-400">잔액</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
