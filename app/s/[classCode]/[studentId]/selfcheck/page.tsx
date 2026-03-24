'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Goal {
  id: string
  behavior_name: string
  behavior_definition: string
  token_per_occurrence: number
  strategy_type: string
}

interface TodayRecord {
  goal_id: string
  occurrence_count: number
  token_granted: number
}

export default function StudentSelfCheckPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fetchData = async () => {
    const res = await fetch('/api/pbs/selfcheck')
    if (res.ok) {
      const data = await res.json()
      setGoals(data.goals || [])
      setTodayRecords(data.todayRecords || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCheck = async (goal: Goal) => {
    setChecking(goal.id)
    setMessage('')
    try {
      const res = await fetch('/api/pbs/selfcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: goal.id, occurrenceCount: 1 }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ ${data.goalName} +${formatCurrency(data.tokenGranted)} (정산 대기)`)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setChecking(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const todayTotal = todayRecords.reduce((sum, r) => sum + r.token_granted, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">✅ 셀프 체크</h1>
        {todayTotal > 0 && (
          <p className="text-sm font-bold text-green-600">오늘 +{formatCurrency(todayTotal)}</p>
        )}
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-gray-500">셀프체크 가능한 목표가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">선생님이 셀프체크를 허용한 목표만 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const todayCount = todayRecords
              .filter(r => r.goal_id === goal.id)
              .reduce((sum, r) => sum + r.occurrence_count, 0)
            return (
              <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{goal.behavior_name}</p>
                    {goal.behavior_definition && (
                      <p className="text-xs text-gray-500 mt-0.5">{goal.behavior_definition}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                        1회 {formatCurrency(goal.token_per_occurrence)}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        {goal.strategy_type}
                      </span>
                      {todayCount > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                          오늘 {todayCount}회
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCheck(goal)}
                  disabled={checking === goal.id}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl transition-colors text-lg"
                >
                  {checking === goal.id ? '기록 중...' : '✅ 체크!'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        셀프체크 기록은 선생님의 정산 시 통장에 반영됩니다.
      </p>
    </div>
  )
}
