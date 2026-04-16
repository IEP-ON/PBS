'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import type { TrialOutcome } from '@/lib/preference-assessment'
import { TRIALS_PER_ITEM, normalizeTrials } from '@/lib/preference-assessment'

type ShopItem = {
  id: string
  name: string
  emoji: string | null
  price: number
}

type ItemRun = {
  itemId: string
  name: string
  trials: TrialOutcome[]
}

const OUTCOME_LABEL: Record<TrialOutcome, string> = {
  approach: '접근·선호',
  neutral: '무반응',
  reject: '거부·회피',
}

export default function PreferenceAssessmentPage() {
  const params = useParams()
  const classCode = params.classCode as string
  const studentId = params.studentId as string

  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selected, setSelected] = useState<string[]>([])
  const [phase, setPhase] = useState<'select' | 'run' | 'review'>('select')
  const [runIndex, setRunIndex] = useState(0)
  const [runs, setRuns] = useState<ItemRun[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/shop/items')
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data.error || '가게 목록을 불러오지 못했습니다.')
        setItems([])
        return
      }
      setItems(data.items || [])
    } catch {
      setLoadError('네트워크 오류가 발생했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 8) return prev
      return [...prev, id]
    })
  }

  const startRun = () => {
    if (selected.length < 5 || selected.length > 8) return
    const list: ItemRun[] = selected.map((id) => {
      const it = items.find((x) => x.id === id)!
      return { itemId: id, name: it.name, trials: [] }
    })
    setRuns(list)
    setRunIndex(0)
    setPhase('run')
    setSaveMessage('')
  }

  const currentRun = runs[runIndex]

  const recordOutcome = (o: TrialOutcome) => {
    if (!currentRun || currentRun.trials.length >= TRIALS_PER_ITEM) return
    setRuns((prev) => {
      const next = [...prev]
      const row = { ...next[runIndex] }
      row.trials = [...row.trials, o]
      next[runIndex] = row
      return next
    })
    const willCompleteItem = currentRun.trials.length + 1 >= TRIALS_PER_ITEM
    if (willCompleteItem) {
      if (runIndex + 1 >= runs.length) {
        setPhase('review')
      } else {
        setRunIndex((i) => i + 1)
      }
    }
  }

  const submit = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const payload = {
        studentId,
        items: runs.map((r) => ({
          itemId: r.itemId,
          name: r.name,
          trials: normalizeTrials(r.trials),
        })),
      }
      const res = await fetch('/api/preference-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMessage(data.error || '저장에 실패했습니다.')
        return
      }
      setSaveMessage('저장되었습니다. AI 프로필의 강화물 선호도가 갱신되었습니다.')
      setPhase('select')
      setSelected([])
      setRuns([])
    } catch {
      setSaveMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tablet-page p-8 text-center text-gray-500">가게 아이템을 불러오는 중…</div>
    )
  }

  return (
    <div className="tablet-page max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/${classCode}/students/${studentId}`} className="text-sm text-gray-500 hover:text-gray-800">
          ← 학생 상세
        </Link>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-2">
        <h1 className="text-xl font-bold text-gray-900">선호도 평가 (단일자극법)</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          가게에서 <strong>5~8개</strong> 강화물을 고른 뒤, 학생에게 <strong>한 번에 하나씩</strong> 제시합니다.
          각 아이템마다 <strong>3회</strong> 반응을 기록하면 접근률 기준 선호 서열이 만들어지고, AI 프로필의{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">reinforcement_preferences</code>에 반영됩니다.
        </p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
      )}

      {items.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 text-sm">
          등록된 가게 아이템이 없습니다. 먼저 토큰 가게에서 아이템을 등록해 주세요.
        </div>
      ) : null}

      {phase === 'select' && items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              선택 {selected.length}/8 (최소 5)
            </p>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              선택 초기화
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  selectedSet.has(it.id)
                    ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-200'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl">{it.emoji || '🎁'}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 block truncate">{it.name}</span>
                  <span className="text-xs text-gray-500">{formatCurrency(it.price)}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={selected.length < 5 || selected.length > 8}
            onClick={startRun}
            className="w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-violet-700 transition-colors"
          >
            평가 시작 (제시 순서는 선택 순서)
          </button>
        </div>
      )}

      {phase === 'run' && currentRun && (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            아이템 {runIndex + 1} / {runs.length}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{items.find((x) => x.id === currentRun.itemId)?.emoji || '🎁'}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{currentRun.name}</h2>
              <p className="text-sm text-gray-500">
                {currentRun.trials.length + 1}번째 제시 — 반응을 선택하세요
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['approach', 'neutral', 'reject'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => recordOutcome(o)}
                className={`rounded-2xl border py-4 font-semibold text-sm transition-colors ${
                  o === 'approach'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    : o === 'neutral'
                      ? 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
                      : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100'
                }`}
              >
                {OUTCOME_LABEL[o]}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900">요약</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {runs.map((r) => {
              const approach = normalizeTrials(r.trials).filter((t) => t === 'approach').length
              return (
                <li key={r.itemId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="text-gray-600">
                    접근 {approach}/{TRIALS_PER_ITEM}
                  </span>
                </li>
              )
            })}
          </ul>
          {saveMessage && (
            <p className={`text-sm ${saveMessage.includes('실패') || saveMessage.includes('오류') ? 'text-red-600' : 'text-emerald-700'}`}>
              {saveMessage}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase('select')
                setRuns([])
                setSelected([])
              }}
              className="flex-1 rounded-2xl border border-gray-200 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              취소하고 처음부터
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="flex-1 rounded-2xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:bg-gray-300"
            >
              {saving ? '저장 중…' : '결과 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
