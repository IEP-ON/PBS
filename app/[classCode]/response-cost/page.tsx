'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Student {
  id: string
  name: string
  response_cost_enabled: boolean
  pbs_accounts?: { balance: number }[]
}

interface Record {
  id: string
  student_id: string
  amount: number
  description: string
  balance_after: number
  created_at: string
  pbs_students?: { name: string }
}

export default function ResponseCostPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const fetchData = async () => {
    const [sRes, rRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/response-cost'),
    ])
    const sData = await sRes.json()
    const rData = await rRes.json()
    setStudents(sData.students || [])
    setRecords(rData.records || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleDeduct = async () => {
    if (!selectedStudent || !amount || Number(amount) <= 0) {
      setMessage('❌ 학생과 차감 금액을 입력하세요.')
      return
    }

    const student = students.find(s => s.id === selectedStudent)
    if (!student?.response_cost_enabled) {
      setMessage('❌ 이 학생은 반응대가가 비활성화되어 있습니다.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/response-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent,
          amount: Number(amount),
          reason: reason || '문제행동 발생',
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(`✅ ${formatCurrency(data.deducted)} 차감 완료 (잔액: ${formatCurrency(data.newBalance)})`)
        setSelectedStudent('')
        setAmount('')
        setReason('')
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const enabledStudents = students.filter(s => s.response_cost_enabled)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">⚠️ 반응대가 (Response Cost)</h1>
        <p className="text-sm text-gray-500">문제 행동 발생 시 토큰 차감</p>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* 반응대가 실행 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">문제행동 차감</h2>
        <div className="grid grid-cols-3 gap-3">
          <select 
            value={selectedStudent} 
            onChange={e => setSelectedStudent(e.target.value)}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">학생 선택</option>
            {enabledStudents.map(s => {
              const balance = Array.isArray(s.pbs_accounts) ? s.pbs_accounts[0]?.balance : 0
              return (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatCurrency(balance || 0)})
                </option>
              )
            })}
          </select>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)}
            placeholder="차감 금액"
            min={1}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input 
            type="text" 
            value={reason} 
            onChange={e => setReason(e.target.value)}
            placeholder="사유 (선택)"
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button 
          onClick={handleDeduct}
          disabled={submitting || !selectedStudent || !amount}
          className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-xl transition-colors"
        >
          {submitting ? '차감 중...' : '⚠️ 토큰 차감 실행'}
        </button>
        <p className="text-xs text-gray-400 text-center">
          ※ 최저잔액 500원 보호 적용 (500원 이하로는 차감되지 않습니다)
        </p>
      </div>

      {/* 반응대가 활성 학생 목록 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">반응대가 활성 학생 ({enabledStudents.length}명)</h2>
        {enabledStudents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">반응대가가 활성화된 학생이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-2">학생 정보 수정에서 활성화할 수 있습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {enabledStudents.map(s => {
              const balance = Array.isArray(s.pbs_accounts) ? s.pbs_accounts[0]?.balance : 0
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-red-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900">{s.name}</p>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">활성</span>
                  </div>
                  <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(balance || 0)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 차감 기록 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">최근 차감 기록</h2>
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">차감 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {records.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.pbs_students?.name} · {r.description}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('ko-KR', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-500">{formatCurrency(r.amount)}</p>
                  <p className="text-xs text-gray-400">잔액 {formatCurrency(r.balance_after)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
