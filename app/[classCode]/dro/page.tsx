'use client'

import { useEffect, useState, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Student {
  id: string
  name: string
}

interface Goal {
  id: string
  behavior_name: string
  token_per_occurrence: number
}

interface Timer {
  id: string
  student_id: string
  goal_id: string
  started_at: string
  ends_at: string
  status: string
  reset_count: number
  completed_at: string | null
  pbs_goals: { behavior_name: string; token_per_occurrence: number } | null
}

export default function DroPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [timers, setTimers] = useState<Timer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedGoal, setSelectedGoal] = useState('')
  const [duration, setDuration] = useState('5')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = async () => {
    const [sRes, tRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/dro'),
    ])
    const sData = await sRes.json()
    const tData = await tRes.json()
    setStudents(sData.students || [])
    setTimers(tData.timers || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // 실시간 타이머 갱신 (1초마다)
  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // 학생 선택 시 목표 로드
  useEffect(() => {
    if (!selectedStudent) { setGoals([]); return }
    fetch(`/api/pbs/goals?studentId=${selectedStudent}`)
      .then(r => r.json())
      .then(d => setGoals(d.goals || []))
  }, [selectedStudent])

  const handleStart = async () => {
    if (!selectedStudent || !selectedGoal || !duration) return
    setMessage('')
    const res = await fetch('/api/dro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: selectedStudent,
        goalId: selectedGoal,
        durationMinutes: Number(duration),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`⏱️ ${data.timer.pbs_goals?.behavior_name} 타이머 시작 (${duration}분)`)
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  const handleAction = async (timerId: string, action: string) => {
    setMessage('')
    const res = await fetch(`/api/dro/${timerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (res.ok) {
      if (action === 'reset') setMessage(`🔄 타이머 리셋 (${data.resetCount}회차)`)
      else if (action === 'complete') setMessage(`✅ 완료! ${formatCurrency(data.tokenGranted)} 지급`)
      else if (action === 'cancel') setMessage('🚫 타이머 취소')
      fetchData()
    }
  }

  const formatRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - now
    if (diff <= 0) return '00:00'
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const runningTimers = timers.filter(t => t.status === 'running')
  const recentTimers = timers.filter(t => t.status !== 'running').slice(0, 10)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">⏱️ DRO 타이머</h1>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* 새 타이머 시작 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">새 타이머 시작</h2>
        <div className="grid grid-cols-4 gap-3">
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">학생 선택</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={selectedGoal} onChange={e => setSelectedGoal(e.target.value)} className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">목표 선택</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.behavior_name} ({formatCurrency(g.token_per_occurrence)})</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={1} max={60} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-gray-500 whitespace-nowrap">분</span>
          </div>
          <button onClick={handleStart} disabled={!selectedStudent || !selectedGoal} className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium rounded-xl transition-colors">
            ▶ 시작
          </button>
        </div>
      </div>

      {/* 실행 중 타이머 */}
      {runningTimers.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900">🔴 실행 중 ({runningTimers.length})</h2>
          {runningTimers.map(t => {
            const studentName = students.find(s => s.id === t.student_id)?.name || '학생'
            const remaining = formatRemaining(t.ends_at)
            const isExpired = new Date(t.ends_at).getTime() <= now
            return (
              <div key={t.id} className={`bg-white rounded-2xl border-2 p-5 ${isExpired ? 'border-green-400 bg-green-50' : 'border-orange-300'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{studentName} · {t.pbs_goals?.behavior_name}</p>
                    <p className="text-xs text-gray-500">리셋 {t.reset_count}회</p>
                  </div>
                  <div className={`text-4xl font-mono font-bold ${isExpired ? 'text-green-600' : 'text-orange-600'}`}>
                    {isExpired ? '✅ 완료!' : remaining}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(t.id, 'reset')} className="flex-1 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 font-medium rounded-xl transition-colors">
                    🔄 리셋 (문제행동 발생)
                  </button>
                  <button onClick={() => handleAction(t.id, 'complete')} disabled={!isExpired} className="flex-1 py-2.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 font-medium rounded-xl transition-colors disabled:opacity-40">
                    ✅ 완료 (+{formatCurrency(t.pbs_goals?.token_per_occurrence || 0)})
                  </button>
                  <button onClick={() => handleAction(t.id, 'cancel')} className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 font-medium rounded-xl transition-colors">
                    취소
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 최근 이력 */}
      {recentTimers.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-gray-900">📋 최근 이력</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {recentTimers.map(t => {
              const studentName = students.find(s => s.id === t.student_id)?.name || '학생'
              return (
                <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{studentName} · {t.pbs_goals?.behavior_name}</p>
                    <p className="text-xs text-gray-400">리셋 {t.reset_count}회 · {new Date(t.started_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {t.status === 'completed' ? '✅ 완료' : '🚫 취소'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
