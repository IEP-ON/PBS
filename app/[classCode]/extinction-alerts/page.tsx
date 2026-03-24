'use client'

import { useEffect, useState } from 'react'

interface Alert {
  id: string
  student_id: string
  goal_id: string
  alert_type: string
  risk_level: string
  description: string
  gpt_recommendation: string | null
  is_resolved: boolean
  created_at: string
  pbs_students?: { name: string }
  pbs_goals?: { behavior_name: string }
}

export default function ExtinctionAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [message, setMessage] = useState('')

  const fetchAlerts = async (includeResolved = false) => {
    const url = `/api/extinction-alerts${includeResolved ? '?showResolved=true' : ''}`
    const res = await fetch(url)
    const data = await res.json()
    setAlerts(data.alerts || [])
    setLoading(false)
  }

  useEffect(() => { fetchAlerts(showResolved) }, [showResolved])

  const handleResolve = async (alertId: string) => {
    if (!window.confirm('이 알림을 해결 처리하시겠습니까?')) return

    try {
      const res = await fetch('/api/extinction-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      })

      if (res.ok) {
        setMessage('✅ 알림 해결 처리 완료')
        fetchAlerts(showResolved)
      } else {
        const data = await res.json()
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const activeAlerts = alerts.filter(a => !a.is_resolved)
  const resolvedAlerts = alerts.filter(a => a.is_resolved)

  const riskColors: Record<string, string> = {
    high: 'bg-red-100 border-red-300 text-red-700',
    medium: 'bg-yellow-100 border-yellow-300 text-yellow-700',
    low: 'bg-blue-100 border-blue-300 text-blue-700',
  }

  const riskLabels: Record<string, string> = {
    high: '높음',
    medium: '중간',
    low: '낮음',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🚨 소거 위험 모니터링</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
            className="w-4 h-4"
          />
          <span>해결된 알림 표시</span>
        </label>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>소거 폭발(Extinction Burst)</strong>: PBS 목표 행동이 급증 후 연속 감소하는 패턴으로, 소거 과정에서 일시적으로 문제 행동이 증가할 수 있는 현상입니다.
        </p>
        <p className="text-xs text-blue-600 mt-2">
          💡 시스템이 자동으로 감지하며, 크론 작업으로 주기적으로 업데이트됩니다.
        </p>
      </div>

      {/* 활성 알림 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">
          🔔 활성 알림 ({activeAlerts.length}건)
        </h2>
        {activeAlerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-400">현재 활성 알림이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-2">소거 위험이 감지되면 자동으로 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className={`rounded-2xl border-2 p-5 ${riskColors[alert.risk_level] || 'bg-gray-100 border-gray-300'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900">{alert.pbs_students?.name}</p>
                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full">
                        위험도: {riskLabels[alert.risk_level] || alert.risk_level}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{alert.pbs_goals?.behavior_name}</p>
                    <p className="text-sm mt-1">{alert.description}</p>
                  </div>
                  <p className="text-xs opacity-70">
                    {new Date(alert.created_at).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {alert.gpt_recommendation && (
                  <div className="bg-white/50 rounded-lg p-3 mb-3">
                    <p className="text-xs font-medium mb-1">💡 권장 조치</p>
                    <p className="text-sm">{alert.gpt_recommendation}</p>
                  </div>
                )}

                <button
                  onClick={() => handleResolve(alert.id)}
                  className="w-full py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  ✓ 해결 처리
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 해결된 알림 */}
      {showResolved && resolvedAlerts.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-900 mb-3">
            ✅ 해결된 알림 ({resolvedAlerts.length}건)
          </h2>
          <div className="space-y-2">
            {resolvedAlerts.map(alert => (
              <div
                key={alert.id}
                className="bg-white rounded-xl border border-gray-200 p-4 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {alert.pbs_students?.name} · {alert.pbs_goals?.behavior_name}
                    </p>
                    <p className="text-xs text-gray-500">{alert.description}</p>
                  </div>
                  <span className="text-xs text-green-600 font-medium">해결됨</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
