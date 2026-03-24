'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface LevelUpButtonProps {
  studentId: string
  currentStage: number
}

export default function LevelUpButton({ studentId, currentStage }: LevelUpButtonProps) {
  const [checking, setChecking] = useState(false)
  const [info, setInfo] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [leveling, setLeveling] = useState(false)

  const checkEligibility = async () => {
    setChecking(true)
    setMessage('')
    try {
      const res = await fetch(`/api/pbs/levelup?studentId=${studentId}`)
      const data = await res.json()
      setInfo(data)
      if (!data.canLevelUp) {
        if (data.currentStage >= 5) {
          setMessage('🏆 이미 최고 레벨입니다!')
        } else {
          setMessage(`📊 레벨업 조건: ${data.requirement.minRecords}회 이상 달성 필요 (현재 ${data.totalRecords}회)`)
        }
      }
    } catch {
      setMessage('❌ 확인 실패')
    } finally {
      setChecking(false)
    }
  }

  const handleLevelUp = async () => {
    if (!window.confirm(`정말 레벨업하시겠습니까? (보너스: ${formatCurrency(info.bonus)})`)) return

    setLeveling(true)
    setMessage('')
    try {
      const res = await fetch('/api/pbs/levelup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`🎉 ${data.message}`)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 레벨업 실패')
    } finally {
      setLeveling(false)
    }
  }

  if (currentStage >= 5) {
    return (
      <div className="text-center py-3 bg-yellow-50 rounded-xl">
        <p className="text-sm font-bold text-yellow-700">🏆 최고 레벨 달성!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={checkEligibility}
        disabled={checking}
        className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        {checking ? '확인 중...' : '🆙 레벨업 자격 확인'}
      </button>

      {message && (
        <p className="text-xs text-center text-gray-600">{message}</p>
      )}

      {info?.canLevelUp && (
        <button
          onClick={handleLevelUp}
          disabled={leveling}
          className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg"
        >
          {leveling ? '레벨업 중...' : `✨ 레벨 ${info.nextStage} 승급 (+${formatCurrency(info.bonus)})`}
        </button>
      )}
    </div>
  )
}
