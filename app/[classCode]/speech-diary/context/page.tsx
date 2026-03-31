'use client'

import { useEffect, useState } from 'react'

function getTodayKst() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default function SpeechDiaryContextPage() {
  const [date, setDate] = useState(getTodayKst())
  const [lunchMenu, setLunchMenu] = useState('')
  const [event, setEvent] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadContext = async (targetDate: string) => {
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch(`/api/speech-diary/context?date=${targetDate}`)
      const data = await res.json()
      if (res.ok) {
        setLunchMenu(data.context?.lunch_menu || '')
        setEvent(data.context?.event || '')
        setMemo(data.context?.memo || '')
      } else {
        setMessage(data.error || '맥락 조회에 실패했습니다.')
      }
    } catch {
      setMessage('맥락 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadContext(date)
  }, [date])

  const saveContext = async () => {
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/speech-diary/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          lunchMenu,
          event,
          memo,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || '저장에 실패했습니다.')
      } else {
        setMessage('오늘의 학교 맥락을 저장했습니다.')
      }
    } catch {
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🏫 오늘의 학교 맥락</h1>
        <p className="text-sm text-gray-500 mt-1">급식, 행사, 메모를 저장하면 말 일기 보정에 참고됩니다.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">날짜</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900"
          />
        </label>

        {loading ? (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">오늘의 급식</span>
              <textarea
                value={lunchMenu}
                onChange={(e) => setLunchMenu(e.target.value)}
                rows={3}
                placeholder="예: 돈까스, 미역국, 과일"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">오늘의 행사</span>
              <input
                type="text"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                placeholder="예: 현장체험학습, 체육 수업"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">교사 메모</span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={4}
                placeholder="예: 비 오는 날이라 실내 활동 위주"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </>
        )}

        {message && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {message}
          </div>
        )}

        <button
          onClick={() => void saveContext()}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
