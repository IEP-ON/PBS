'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

export default function SalaryButtons() {
  const router = useRouter()
  const [dailyLoading, setDailyLoading] = useState(false)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleDailySalary = async () => {
    if (!confirm('오늘 출석 기본급을 지급하시겠습니까?')) return
    setDailyLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/cron/daily-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ 기본급: ${data.students}명 · ${formatCurrency(data.totalAmount)} 지급 완료`)
        router.refresh()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setDailyLoading(false)
    }
  }

  const handleWeeklyBonus = async () => {
    if (!confirm('주간 개근 보너스 + 이자를 지급하시겠습니까?')) return
    setWeeklyLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/cron/weekly-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        const bonusMsg = data.bonus.students > 0
          ? `개근 ${data.bonus.students}명 +${formatCurrency(data.bonus.totalAmount)}`
          : '개근 해당 없음'
        const interestMsg = data.interest.students > 0
          ? `이자 ${data.interest.students}명 +${formatCurrency(data.interest.totalAmount)}`
          : '이자 해당 없음'
        setMessage(`✅ ${bonusMsg} / ${interestMsg}`)
        router.refresh()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setWeeklyLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <h3 className="font-bold text-gray-900 text-sm">급여 수동 실행</h3>
      <div className="flex gap-2">
        <button
          onClick={handleDailySalary}
          disabled={dailyLoading}
          className="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 disabled:bg-gray-100 border border-amber-200 text-amber-700 text-sm font-medium rounded-xl transition-colors"
        >
          {dailyLoading ? '처리 중...' : '📅 출석 기본급'}
        </button>
        <button
          onClick={handleWeeklyBonus}
          disabled={weeklyLoading}
          className="flex-1 py-2.5 bg-purple-50 hover:bg-purple-100 disabled:bg-gray-100 border border-purple-200 text-purple-700 text-sm font-medium rounded-xl transition-colors"
        >
          {weeklyLoading ? '처리 중...' : '🏆 주간 보너스'}
        </button>
      </div>
      {message && (
        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{message}</p>
      )}
    </div>
  )
}
