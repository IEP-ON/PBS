'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Strategy {
  id: string
  strategy_name: string
  description: string
  evidence_level: string
}

function InterventionsContent() {
  const params = useParams()
  const classCode = params.classCode as string
  const searchParams = useSearchParams()
  const fromFbaFunction = searchParams.get('function') || ''

  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFunction, setFilterFunction] = useState(fromFbaFunction)
  const [showAddModal, setShowAddModal] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceLevel, setEvidenceLevel] = useState('emerging')
  const [applicableFunctions, setApplicableFunctions] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const fetchStrategies = async (func = '') => {
    const url = func ? `/api/interventions?function=${func}` : '/api/interventions'
    const res = await fetch(url)
    const data = await res.json()
    setStrategies(data.strategies || [])
    setLoading(false)
  }

  useEffect(() => { fetchStrategies(filterFunction) }, [filterFunction])

  const handleSubmit = async () => {
    if (!strategyName || !description) {
      setMessage('❌ 전략명과 설명을 입력하세요.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName,
          description,
          evidenceLevel,
          applicableFunctions,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage('✅ 중재 전략 추가 완료')
        setShowAddModal(false)
        setStrategyName('')
        setDescription('')
        setEvidenceLevel('emerging')
        setApplicableFunctions([])
        fetchStrategies(filterFunction)
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleFunction = (func: string) => {
    setApplicableFunctions(prev =>
      prev.includes(func) ? prev.filter(f => f !== func) : [...prev, func]
    )
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const functions = [
    { id: 'attention', label: '주의 추구' },
    { id: 'escape', label: '회피/도피' },
    { id: 'sensory', label: '감각 자극' },
    { id: 'tangible', label: '물건 획득' },
  ]

  const evidenceLevels: Record<string, string> = {
    'evidence-based': '근거기반',
    'promising': '유망',
    'emerging': '신규',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📚 중재 전략 라이브러리</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          + 전략 추가
        </button>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* FBA에서 연결된 경우 배너 */}
      {fromFbaFunction && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl">
          <span className="text-lg">🔍</span>
          <div className="flex-1">
            <p className="text-xs text-purple-600 font-medium">FBA 분석 연동</p>
            <p className="text-sm text-gray-700">
              <strong>'{functions.find(f => f.id === fromFbaFunction)?.label || fromFbaFunction}'</strong> 행동 기능에 추천되는 전략을 필터링 중입니다.
            </p>
          </div>
          <Link href={`/${classCode}/fba`} className="text-xs text-purple-500 hover:text-purple-700 whitespace-nowrap">FBA로 돌아가기</Link>
        </div>
      )}

      {/* 행동 기능 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterFunction('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!filterFunction ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >전체</button>
        {functions.map(f => (
          <button
            key={f.id}
            onClick={() => setFilterFunction(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterFunction === f.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >{f.label}</button>
        ))}
      </div>

      {/* 전략 목록 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">전략 목록 ({strategies.length}개)</h2>
        {strategies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">등록된 중재 전략이 없습니다.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              첫 전략 추가하기 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {strategies.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-bold text-gray-900">{s.strategy_name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    s.evidence_level === 'evidence-based' ? 'bg-green-100 text-green-700' :
                    s.evidence_level === 'promising' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {evidenceLevels[s.evidence_level] || s.evidence_level}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{s.description}</p>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <Link
                    href={`/${classCode}/pbs`}
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                  >
                    ✅ 이 전략으로 PBS 목표 설정하기 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 전략 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">중재 전략 추가</h2>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">전략명 *</span>
              <input
                type="text"
                value={strategyName}
                onChange={e => setStrategyName(e.target.value)}
                placeholder="예: 토큰 강화 시스템"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">설명 *</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="전략의 구체적인 방법과 절차"
                rows={4}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">근거 수준</span>
              <select
                value={evidenceLevel}
                onChange={e => setEvidenceLevel(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="evidence-based">근거기반</option>
                <option value="promising">유망</option>
                <option value="emerging">신규</option>
              </select>
            </label>

            <div>
              <span className="text-sm font-medium text-gray-700 block mb-2">적용 가능한 행동 기능</span>
              <div className="grid grid-cols-2 gap-2">
                {functions.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleFunction(f.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      applicableFunctions.includes(f.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >취소</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !strategyName || !description}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InterventionsPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center min-h-[300px]"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <InterventionsContent />
    </Suspense>
  )
}
