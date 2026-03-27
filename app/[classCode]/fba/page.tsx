'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Student {
  id: string
  name: string
}

interface FbaRecord {
  id: string
  student_id: string
  behavior_description: string
  estimated_function: string | null
  confidence: string | null
  gpt_analysis: string | null
  created_at: string
  pbs_students?: { name: string }
}

interface Strategy {
  id: string
  strategy_name: string
  description: string
  evidence_level: string
}

export default function FbaPage() {
  const params = useParams()
  const router = useRouter()
  const classCode = params.classCode as string
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<FbaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [behaviorDescription, setBehaviorDescription] = useState('')
  const [antecedents, setAntecedents] = useState('')
  const [consequences, setConsequences] = useState('')
  const [requestAi, setRequestAi] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [filterStudent, setFilterStudent] = useState('')
  // 중재전략 인라인 캐시 (기능별)
  const [strategiesCache, setStrategiesCache] = useState<Record<string, Strategy[]>>({})
  const [expandedStrategies, setExpandedStrategies] = useState<string | null>(null)
  const [loadingStrategies, setLoadingStrategies] = useState(false)

  const fetchStrategies = async (fn: string) => {
    if (strategiesCache[fn]) {
      setExpandedStrategies(prev => prev === fn ? null : fn)
      return
    }
    setLoadingStrategies(true)
    try {
      const res = await fetch(`/api/interventions?function=${fn}`)
      const data = await res.json()
      setStrategiesCache(prev => ({ ...prev, [fn]: data.strategies || [] }))
      setExpandedStrategies(fn)
    } finally {
      setLoadingStrategies(false)
    }
  }

  const fetchData = async () => {
    const [sRes, fRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/fba'),
    ])
    const sData = await sRes.json()
    const fData = await fRes.json()
    setStudents(sData.students || [])
    setRecords(fData.records || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async () => {
    if (!selectedStudent || !behaviorDescription) {
      setMessage('❌ 학생과 행동 설명을 입력하세요.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/fba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent,
          behaviorDescription,
          antecedentPatterns: antecedents.split(',').map(s => s.trim()).filter(Boolean),
          consequencePatterns: consequences.split(',').map(s => s.trim()).filter(Boolean),
          requestAiAnalysis: requestAi,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(`✅ FBA 기록 완료${data.aiAnalysisPerformed ? ' (AI 분석 포함)' : ''}`)
        setSelectedStudent('')
        setBehaviorDescription('')
        setAntecedents('')
        setConsequences('')
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const functionLabels: Record<string, string> = {
    attention: '주의 추구',
    escape: '회피/도피',
    sensory: '감각 자극',
    tangible: '물건 획득',
  }

  const functionColors: Record<string, string> = {
    attention: 'bg-purple-100 text-purple-700 border-purple-200',
    escape: 'bg-orange-100 text-orange-700 border-orange-200',
    sensory: 'bg-green-100 text-green-700 border-green-200',
    tangible: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const functionBg: Record<string, string> = {
    attention: 'border-l-purple-400',
    escape: 'border-l-orange-400',
    sensory: 'border-l-green-400',
    tangible: 'border-l-blue-400',
  }

  const functionStats = ['attention', 'escape', 'sensory', 'tangible'].map(fn => ({
    fn,
    count: records.filter(r => r.estimated_function === fn).length,
  }))

  const filteredRecords = filterStudent ? records.filter(r => r.student_id === filterStudent) : records

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔍 기능행동분석 (FBA)</h1>
        <p className="text-xs text-gray-400 mt-0.5">Functional Behavior Assessment · Cooper et al. (2020) ABA 3판 기반</p>
      </div>

      {/* 행동 기능별 통계 */}
      {records.some(r => r.estimated_function) && (
        <div className="grid grid-cols-4 gap-2">
          {functionStats.map(({ fn, count }) => (
            <div key={fn} className={`rounded-xl border p-3 text-center ${functionColors[fn]}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs mt-0.5">{functionLabels[fn]}</p>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* FBA 기록 작성 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">새 FBA 기록</h2>
        <select 
          value={selectedStudent} 
          onChange={e => setSelectedStudent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">학생 선택</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <textarea 
          value={behaviorDescription} 
          onChange={e => setBehaviorDescription(e.target.value)}
          placeholder="문제 행동 설명 (예: 수업 중 자리를 이탈하여 교실을 돌아다님)"
          rows={3}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <input 
          type="text" 
          value={antecedents} 
          onChange={e => setAntecedents(e.target.value)}
          placeholder="선행 사건 (쉼표로 구분, 예: 어려운 과제 제시, 교사의 지시)"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input 
          type="text" 
          value={consequences} 
          onChange={e => setConsequences(e.target.value)}
          placeholder="결과 사건 (쉼표로 구분, 예: 또래의 웃음, 교사의 관심)"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={requestAi} 
            onChange={e => setRequestAi(e.target.checked)}
            className="w-4 h-4"
          />
          <span>AI 분석 요청 (GPT-4o)</span>
        </label>
        <button 
          onClick={handleSubmit}
          disabled={submitting || !selectedStudent || !behaviorDescription}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
        >
          {submitting ? 'FBA 기록 중...' : '🔍 FBA 기록 저장'}
        </button>
      </div>

      {/* 학생 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterStudent('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!filterStudent ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>전체</button>
        {students.map(s => (
          <button key={s.id} onClick={() => setFilterStudent(s.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStudent === s.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{s.name}</button>
        ))}
      </div>

      {/* FBA 기록 목록 */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">FBA 기록 ({filteredRecords.length}건)</h2>
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">FBA 기록이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-2">학생 상세 페이지 → AI 행동 지원 계획에서 자동 생성할 수 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map(r => (
              <div key={r.id} className={`bg-white rounded-2xl border border-l-4 p-5 ${
                r.estimated_function ? functionBg[r.estimated_function] || 'border-l-gray-300' : 'border-l-gray-200'
              } border-gray-100`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{r.pbs_students?.name}</p>
                    <p className="text-sm text-gray-600 mt-1">{r.behavior_description}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {r.estimated_function && (
                  <div className="space-y-1.5 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        추정 기능: {functionLabels[r.estimated_function] || r.estimated_function}
                      </span>
                      {r.confidence && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          r.confidence === 'high' ? 'bg-green-100 text-green-700' :
                          r.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          신뢰도: {r.confidence === 'high' ? '높음' : r.confidence === 'medium' ? '중간' : '낮음'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => fetchStrategies(r.estimated_function!)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {loadingStrategies && expandedStrategies === null ? '⏳' : '📚'}
                        {' '}{expandedStrategies === r.estimated_function ? '중재전략 접기 ▲' : `'${functionLabels[r.estimated_function]}' 중재전략 보기 ▼`}
                      </button>
                      <Link
                        href={`/${classCode}/interventions?function=${r.estimated_function}`}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        전략 라이브러리 →
                      </Link>
                    </div>

                    {/* 중재전략 인라인 표시 */}
                    {expandedStrategies === r.estimated_function && (
                      <div className="mt-2 space-y-2">
                        {(strategiesCache[r.estimated_function] || []).length === 0 ? (
                          <p className="text-xs text-gray-400 p-2">등록된 전략이 없습니다. 중재전략 라이브러리에서 추가하세요.</p>
                        ) : (
                          <>
                            {(strategiesCache[r.estimated_function] || []).slice(0, 3).map(s => (
                              <div key={s.id} className="bg-gray-50 rounded-xl p-3 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-semibold text-gray-900">{s.strategy_name}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      s.evidence_level === 'evidence-based' ? 'bg-green-100 text-green-700' :
                                      s.evidence_level === 'promising' ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-500'
                                    }`}>
                                      {s.evidence_level === 'evidence-based' ? '근거기반' : s.evidence_level === 'promising' ? '유망' : '신규'}
                                    </span>
                                  </div>
                                  {s.description && (
                                    <p className="text-xs text-gray-500 line-clamp-2">{s.description}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => router.push(`/${classCode}/pbs`)}
                                  className="shrink-0 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg whitespace-nowrap transition-colors"
                                >
                                  PBS 목표로 →
                                </button>
                              </div>
                            ))}
                            {(strategiesCache[r.estimated_function] || []).length > 3 && (
                              <Link
                                href={`/${classCode}/interventions?function=${r.estimated_function}`}
                                className="block text-xs text-center text-blue-500 hover:text-blue-700 py-1"
                              >
                                전체 {strategiesCache[r.estimated_function].length}개 전략 보기 →
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {r.gpt_analysis && (
                  <div>
                    <button
                      onClick={() => setExpandedRecord(expandedRecord === r.id ? null : r.id)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {expandedRecord === r.id ? '▼ AI 분석 숨기기' : '▶ AI 분석 보기'}
                    </button>
                    {expandedRecord === r.id && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                        {r.gpt_analysis}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
