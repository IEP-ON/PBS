'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface StudentRanking {
  id: string
  name: string
  pbs_stage: number
  balance: number
  todayEarned: number
  rank: number
}

type SortMode = 'balance' | 'today'

const MEDAL = ['🥇', '🥈', '🥉']

export default function TvModePage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [rankings, setRankings] = useState<StudentRanking[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('today')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [className, setClassName] = useState('')

  const loadRankings = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/rankings')
      if (!res.ok) return
      const data = await res.json()
      setRankings(data.rankings || [])
      setClassName(data.className || '')
      setLastUpdated(new Date())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRankings()
    const interval = setInterval(loadRankings, 30000) // 30초마다 갱신
    return () => clearInterval(interval)
  }, [loadRankings])

  const sorted = [...rankings].sort((a, b) =>
    sortMode === 'today' ? b.todayEarned - a.todayEarned : b.balance - a.balance
  )

  const top = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-900 to-blue-900 flex items-center justify-center">
        <p className="text-white text-2xl">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 p-6 flex flex-col">
      {/* 헤더 */}
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">
            {className || classCode} 🏆 순위판
          </h1>
          <p className="text-blue-300 text-sm mt-1">
            {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준 · 30초마다 자동 갱신
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSortMode('today')}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              sortMode === 'today'
                ? 'bg-yellow-400 text-gray-900 shadow-lg shadow-yellow-400/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            오늘 획득
          </button>
          <button
            onClick={() => setSortMode('balance')}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              sortMode === 'balance'
                ? 'bg-yellow-400 text-gray-900 shadow-lg shadow-yellow-400/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            전체 잔액
          </button>
          <button
            onClick={loadRankings}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      {/* TOP 3 */}
      {top.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 2등 (가운데를 높게) */}
          {[top[1], top[0], top[2]].map((student, idx) => {
            if (!student) return <div key={idx} />
            const originalIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2
            const isFirst = originalIdx === 0
            const value = sortMode === 'today' ? student.todayEarned : student.balance

            return (
              <div
                key={student.id}
                className={`flex flex-col items-center rounded-3xl p-6 transition-all ${
                  isFirst
                    ? 'bg-gradient-to-b from-yellow-400 to-yellow-500 shadow-2xl shadow-yellow-400/40 scale-105'
                    : originalIdx === 1
                    ? 'bg-gradient-to-b from-gray-300 to-gray-400 shadow-xl'
                    : 'bg-gradient-to-b from-amber-600 to-amber-700 shadow-xl'
                } ${isFirst ? 'py-8' : ''}`}
              >
                <span className="text-4xl mb-2">{MEDAL[originalIdx]}</span>
                <p className={`font-black text-center ${isFirst ? 'text-2xl text-gray-900' : 'text-xl text-white'}`}>
                  {student.name}
                </p>
                <p className={`text-sm mt-1 ${isFirst ? 'text-yellow-900' : 'text-white/80'}`}>
                  LV.{student.pbs_stage}
                </p>
                <p className={`text-2xl font-black mt-3 ${isFirst ? 'text-gray-900' : 'text-white'}`}>
                  {sortMode === 'today'
                    ? value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)
                    : formatCurrency(value)
                  }
                </p>
                <p className={`text-xs mt-1 ${isFirst ? 'text-yellow-800' : 'text-white/60'}`}>
                  {sortMode === 'today' ? '오늘 획득' : '현재 잔액'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* 4등 이하 */}
      {rest.length > 0 && (
        <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
          {rest.map((student, idx) => {
            const value = sortMode === 'today' ? student.todayEarned : student.balance
            return (
              <div
                key={student.id}
                className="flex items-center gap-4 bg-white/10 backdrop-blur rounded-2xl px-5 py-4"
              >
                <span className="text-2xl font-black text-white/60 w-8 text-center">
                  {idx + 4}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-white text-lg">{student.name}</p>
                  <p className="text-blue-300 text-xs">LV.{student.pbs_stage}</p>
                </div>
                <p className="font-black text-white text-xl">
                  {sortMode === 'today'
                    ? value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)
                    : formatCurrency(value)
                  }
                </p>
              </div>
            )
          })}
        </div>
      )}

      {rankings.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl mb-4">🏫</p>
            <p className="text-white text-xl">등록된 학생이 없습니다.</p>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="mt-6 text-center">
        <p className="text-blue-400 text-xs">PBS 토큰 이코노미 · 잘하고 있어요! 🌟</p>
      </div>
    </div>
  )
}
