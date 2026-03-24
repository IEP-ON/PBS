'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface PreviewRecord {
  student_id: string
  token_granted: number
  pbs_goals: { behavior_name: string } | null
}

interface Props {
  pendingAmount: number
  studentNames?: Record<string, string>
}

export default function SettleButton({ pendingAmount, studentNames = {} }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [settling, setSettling] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState<{ studentTotals: Record<string, number>; records: PreviewRecord[] } | null>(null)
  const [result, setResult] = useState<{ totalAmount: number; settled: number } | null>(null)

  const handlePreview = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/salary/settle')
      const data = await res.json()
      setPreview({ studentTotals: data.studentTotals || {}, records: data.records || [] })
      setShowPreview(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSettle = async () => {
    setSettling(true)
    setResult(null)
    try {
      const res = await fetch('/api/salary/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ totalAmount: data.totalAmount, settled: data.settled })
        setShowPreview(false)
        router.refresh()
      }
    } finally {
      setSettling(false)
    }
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        ✅ {result.settled}명 · {formatCurrency(result.totalAmount)} 정산 완료
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handlePreview}
        disabled={loading || !pendingAmount}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors"
      >
        {loading ? '조회 중...' : pendingAmount > 0 ? `💰 정산 (+${formatCurrency(pendingAmount)})` : '정산할 내역 없음'}
      </button>

      {showPreview && preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">정산 미리보기</h2>

            {Object.keys(preview.studentTotals).length === 0 ? (
              <p className="text-gray-500 text-sm">정산할 내역이 없습니다.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {Object.entries(preview.studentTotals).map(([sid, amount]) => (
                    <div key={sid} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                      <span className="font-medium text-gray-900">{studentNames[sid] || sid.slice(0, 8)}</span>
                      <span className="font-bold text-green-600">+{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                  <span className="font-bold text-gray-900">합계</span>
                  <span className="font-bold text-green-700 text-lg">
                    {formatCurrency(Object.values(preview.studentTotals).reduce((a, b) => a + b, 0))}
                  </span>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSettle}
                disabled={settling || Object.keys(preview.studentTotals).length === 0}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors"
              >
                {settling ? '정산 중...' : '정산 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
