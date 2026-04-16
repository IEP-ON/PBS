'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PROMPT_LEVEL_LABELS, type PromptLevel } from '@/lib/pbs-record-fields'

type FidelityBlock = { score: number; details: string }
type PtrFidelityResponse = {
  weekStart: string
  weekEnd: string
  recordCount: number
  fidelity: {
    prevent: FidelityBlock & { antecedentTagRate: number }
    teach: FidelityBlock & { promptLevelRate: number; independenceRate: number }
    reinforce: FidelityBlock & { goalCheckRate: number; settlementRate: number }
    overall: number
  }
  warnings: string[]
  recommendation: string
}

type TeachProgressResponse = {
  behaviorName: string
  dateFrom: string
  dateTo: string
  progress: {
    totalRecords: number
    levelDistribution: Record<string, number>
    trend: string
    independenceRate: number
    readyToFade: boolean
  }
  recommendation: string
}

type FctResponse = {
  script: {
    setup: string
    prompt: string
    expectedResponse: string
    reinforcement: string
    errorCorrection: string
  }
  fadingPlan: {
    currentLevel: string
    nextLevel: string
    criterionToAdvance: string
    rationale: string
  }
}

type EfficacyRow = {
  goalName: string
  preReinforcement: { avgOccurrence: number; trend: string }
  postReinforcement: { avgOccurrence: number; trend: string }
  effectSize: string
}

function mondayOfWeekContaining(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  const y2 = dt.getFullYear()
  const m2 = String(dt.getMonth() + 1).padStart(2, '0')
  const d2 = String(dt.getDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type PbsGoalRow = { id: string; behavior_name: string }

export default function PtrInsightsPage() {
  const params = useParams()
  const classCode = params.classCode as string
  const studentId = params.studentId as string

  const [goals, setGoals] = useState<PbsGoalRow[]>([])
  const [profileHint, setProfileHint] = useState<{
    replacement?: string
    behaviorFunction?: string
    antecedents: string[]
  }>({ antecedents: [] })

  const [weekStart, setWeekStart] = useState(() => mondayOfWeekContaining(todayLocalIso()))
  const [ptrIncludeGpt, setPtrIncludeGpt] = useState(false)
  const [ptrLoading, setPtrLoading] = useState(false)
  const [ptrError, setPtrError] = useState('')
  const [ptrData, setPtrData] = useState<PtrFidelityResponse | null>(null)

  const [goalId, setGoalId] = useState('')
  const [teachDays, setTeachDays] = useState(14)
  const [teachIncludeGpt, setTeachIncludeGpt] = useState(false)
  const [teachLoading, setTeachLoading] = useState(false)
  const [teachError, setTeachError] = useState('')
  const [teachData, setTeachData] = useState<TeachProgressResponse | null>(null)

  const [fctReplacement, setFctReplacement] = useState('')
  const [fctFunction, setFctFunction] = useState('attention')
  const [fctPrompt, setFctPrompt] = useState<PromptLevel>('full')
  const [fctLoading, setFctLoading] = useState(false)
  const [fctError, setFctError] = useState('')
  const [fctData, setFctData] = useState<FctResponse | null>(null)

  const [effDays, setEffDays] = useState(30)
  const [effIncludeGpt, setEffIncludeGpt] = useState(false)
  const [effLoading, setEffLoading] = useState(false)
  const [effError, setEffError] = useState('')
  const [effEfficacy, setEffEfficacy] = useState<EfficacyRow[]>([])
  const [effRec, setEffRec] = useState('')
  const [effMeta, setEffMeta] = useState<{ from: string; to: string } | null>(null)

  const loadContext = useCallback(async () => {
    try {
      const [gRes, pRes] = await Promise.all([
        fetch(`/api/pbs/goals?studentId=${encodeURIComponent(studentId)}`),
        fetch(`/api/students/${encodeURIComponent(studentId)}/ai-profile`),
      ])
      const gJson = await gRes.json()
      if (gRes.ok && Array.isArray(gJson.goals)) {
        setGoals(gJson.goals.map((x: { id: string; behavior_name: string }) => ({ id: x.id, behavior_name: x.behavior_name })))
        if (gJson.goals[0]?.id) setGoalId((prev) => prev || gJson.goals[0].id)
      }
      const pJson = pRes.ok ? await pRes.json() : {}
      const prof = pJson.profile
      if (prof) {
        const rep =
          (Array.isArray(prof.replacement_behaviors) && prof.replacement_behaviors[0]) ||
          (Array.isArray(prof.positive_target_behaviors) && prof.positive_target_behaviors[0]) ||
          ''
        setProfileHint({
          replacement: typeof rep === 'string' ? rep : '',
          behaviorFunction: typeof prof.hypothesized_functions?.[0] === 'string' ? prof.hypothesized_functions[0] : undefined,
          antecedents: Array.isArray(prof.antecedent_patterns) ? prof.antecedent_patterns.slice(0, 8) : [],
        })
        if (typeof rep === 'string' && rep.trim()) setFctReplacement((prev) => prev || rep.trim())
      }
    } catch {
      // 컨텍스트 실패는 각 패널에서 별도 처리
    }
  }, [studentId])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const goalOptions = useMemo(
    () =>
      goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.behavior_name}
        </option>
      )),
    [goals]
  )

  const runPtrFidelity = async () => {
    setPtrLoading(true)
    setPtrError('')
    setPtrData(null)
    try {
      const res = await fetch('/api/ai/ptr-fidelity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, weekStart, includeRecommendation: ptrIncludeGpt }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPtrError(data.error || 'PTR 충실도 조회에 실패했습니다.')
        return
      }
      setPtrData(data as PtrFidelityResponse)
    } catch {
      setPtrError('네트워크 오류가 발생했습니다.')
    } finally {
      setPtrLoading(false)
    }
  }

  const runTeachProgress = async () => {
    if (!goalId) {
      setTeachError('목표를 선택해 주세요.')
      return
    }
    setTeachLoading(true)
    setTeachError('')
    setTeachData(null)
    try {
      const res = await fetch('/api/ai/teach-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          goalId,
          days: teachDays,
          includeRecommendation: teachIncludeGpt,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTeachError(data.error || '촉구 진행도 조회에 실패했습니다.')
        return
      }
      setTeachData(data as TeachProgressResponse)
    } catch {
      setTeachError('네트워크 오류가 발생했습니다.')
    } finally {
      setTeachLoading(false)
    }
  }

  const runFct = async () => {
    if (!fctReplacement.trim()) {
      setFctError('대체 의사소통 행동을 입력해 주세요.')
      return
    }
    setFctLoading(true)
    setFctError('')
    setFctData(null)
    try {
      const res = await fetch('/api/ai/fct-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          replacementBehavior: fctReplacement.trim(),
          behaviorFunction: fctFunction,
          currentPromptLevel: fctPrompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFctError(data.error || 'FCT 시나리오 생성에 실패했습니다.')
        return
      }
      setFctData(data as FctResponse)
    } catch {
      setFctError('네트워크 오류가 발생했습니다.')
    } finally {
      setFctLoading(false)
    }
  }

  const runEfficacy = async () => {
    setEffLoading(true)
    setEffError('')
    setEffEfficacy([])
    setEffRec('')
    setEffMeta(null)
    try {
      const res = await fetch('/api/ai/reinforcement-efficacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          days: effDays,
          includeRecommendation: effIncludeGpt,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEffError(data.error || '강화 효과성 분석에 실패했습니다.')
        return
      }
      setEffEfficacy((data.efficacy as EfficacyRow[]) || [])
      setEffRec(data.recommendation || '')
      setEffMeta({ from: data.dateFrom, to: data.dateTo })
    } catch {
      setEffError('네트워크 오류가 발생했습니다.')
    } finally {
      setEffLoading(false)
    }
  }

  return (
    <div className="tablet-page mx-auto max-w-4xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/${classCode}/students/${studentId}`} className="text-sm text-gray-500 hover:text-gray-800">
          ← 학생 상세
        </Link>
        <p className="text-xs text-gray-400">PTR · Teach · Reinforce 보조 도구</p>
      </div>

      <header className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">PTR·강화 인사이트</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          주간 충실도, 목표별 촉구 진행도, FCT 교수 시나리오, 강화 효과성을 한 화면에서 조회합니다. GPT 한 줄 권고는 선택이며
          <code className="mx-1 rounded bg-gray-100 px-1 text-xs">OPENAI_API_KEY</code>가 있을 때만 동작합니다.
        </p>
      </header>

      {/* PTR 충실도 */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">PTR 실행 충실도</h2>
            <p className="text-xs text-gray-500 mt-1">주 시작일 기준 7일 창(KST 경계는 서버에서 salary_pbs에 반영됨)</p>
          </div>
          <button
            type="button"
            onClick={() => setWeekStart(mondayOfWeekContaining(todayLocalIso()))}
            className="text-xs font-medium text-violet-600 hover:text-violet-800"
          >
            이번 주 월요일로 맞추기
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">weekStart</span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ptrIncludeGpt} onChange={(e) => setPtrIncludeGpt(e.target.checked)} />
            GPT 권고 한 줄
          </label>
          <button
            type="button"
            disabled={ptrLoading}
            onClick={() => void runPtrFidelity()}
            className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-gray-400"
          >
            {ptrLoading ? '계산 중…' : '조회'}
          </button>
        </div>
        {ptrError && <p className="text-sm text-red-600">{ptrError}</p>}
        {ptrData && (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              기간 {ptrData.weekStart} ~ {ptrData.weekEnd} · 기록 {ptrData.recordCount}건 · 종합{' '}
              <strong className="text-gray-900">{ptrData.fidelity.overall}</strong>점
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['prevent', 'teach', 'reinforce'] as const).map((k) => {
                const b = ptrData.fidelity[k]
                return (
                  <div key={k} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{k}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{b.score}</p>
                    <p className="text-[11px] text-gray-600 mt-2 leading-snug">{b.details}</p>
                  </div>
                )
              })}
            </div>
            {ptrData.warnings.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
                {ptrData.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <p className="text-sm text-gray-800 border-l-4 border-violet-300 pl-3">{ptrData.recommendation}</p>
          </div>
        )}
      </section>

      {/* 촉구 진행도 */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">촉구 진행도</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm min-w-[200px]">
            <span className="text-gray-600">목표</span>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            >
              {goalOptions}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">일수</span>
            <input
              type="number"
              min={7}
              max={90}
              value={teachDays}
              onChange={(e) => setTeachDays(Number(e.target.value) || 14)}
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={teachIncludeGpt} onChange={(e) => setTeachIncludeGpt(e.target.checked)} />
            GPT 권고
          </label>
          <button
            type="button"
            disabled={teachLoading || !goalId}
            onClick={() => void runTeachProgress()}
            className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-gray-400"
          >
            {teachLoading ? '분석 중…' : '분석'}
          </button>
        </div>
        {teachError && <p className="text-sm text-red-600">{teachError}</p>}
        {teachData && (
          <div className="space-y-3 border-t border-gray-100 pt-4 text-sm">
            <p className="text-gray-700">
              <strong>{teachData.behaviorName}</strong> · {teachData.dateFrom} ~ {teachData.dateTo} · 기록{' '}
              {teachData.progress.totalRecords}건
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(teachData.progress.levelDistribution).map(([lv, n]) => (
                <span key={lv} className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                  {lv}: {n}
                </span>
              ))}
            </div>
            <p className="text-gray-800">
              추세 <strong>{teachData.progress.trend}</strong> · 독립 비율{' '}
              <strong>{teachData.progress.independenceRate}%</strong>
              {teachData.progress.readyToFade ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 text-xs font-semibold">
                  페이딩 검토 권장
                </span>
              ) : null}
            </p>
            <p className="text-gray-700 border-l-4 border-amber-300 pl-3">{teachData.recommendation}</p>
          </div>
        )}
      </section>

      {/* FCT */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">FCT 교수 시나리오</h2>
        {profileHint.replacement && (
          <p className="text-xs text-gray-500">
            프로필 제안: <button type="button" className="text-violet-600 underline" onClick={() => setFctReplacement(profileHint.replacement!)}>{profileHint.replacement}</button>
          </p>
        )}
        {profileHint.behaviorFunction && (
          <p className="text-[11px] text-gray-500">
            프로필 기능 힌트: <strong>{profileHint.behaviorFunction}</strong> (기능 선택은 교사가 조정)
          </p>
        )}
        {profileHint.antecedents.length > 0 && (
          <p className="text-[11px] text-gray-500">선행 패턴: {profileHint.antecedents.join(' · ')}</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-gray-600">대체 의사소통 행동</span>
            <input
              value={fctReplacement}
              onChange={(e) => setFctReplacement(e.target.value)}
              placeholder="예: 도와주세요 카드 올리기"
              className="rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">추정 기능</span>
            <select
              value={fctFunction}
              onChange={(e) => setFctFunction(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            >
              {['attention', 'escape', 'tangible', 'sensory'].map((fn) => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">현재 촉구 단계</span>
            <select
              value={fctPrompt}
              onChange={(e) => setFctPrompt(e.target.value as PromptLevel)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            >
              {(Object.keys(PROMPT_LEVEL_LABELS) as PromptLevel[]).map((k) => (
                <option key={k} value={k}>
                  {PROMPT_LEVEL_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={fctLoading}
          onClick={() => void runFct()}
          className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-gray-400"
        >
          {fctLoading ? '생성 중…' : '시나리오 생성'}
        </button>
        {fctError && <p className="text-sm text-red-600">{fctError}</p>}
        {fctData && (
          <div className="space-y-4 border-t border-gray-100 pt-4 text-sm text-gray-800">
            <div className="grid gap-3 md:grid-cols-2">
              {(['setup', 'prompt', 'expectedResponse', 'reinforcement', 'errorCorrection'] as const).map((key) => (
                <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-500">{key}</p>
                  <p className="mt-1 leading-relaxed">{fctData.script[key]}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4 space-y-1 text-xs">
              <p>
                <strong>페이딩</strong> {fctData.fadingPlan.currentLevel} → {fctData.fadingPlan.nextLevel}
              </p>
              <p>기준: {fctData.fadingPlan.criterionToAdvance}</p>
              <p className="text-gray-600 italic">{fctData.fadingPlan.rationale}</p>
            </div>
          </div>
        )}
      </section>

      {/* 강화 효과성 */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">강화 효과성</h2>
        <p className="text-xs text-gray-500">PBS 체크 빈도를 기간 전·후로 비교하고, 가게 구매(선물 발송 포함) 건수를 함께 봅니다.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">일수</span>
            <input
              type="number"
              min={14}
              max={120}
              value={effDays}
              onChange={(e) => setEffDays(Number(e.target.value) || 30)}
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={effIncludeGpt} onChange={(e) => setEffIncludeGpt(e.target.checked)} />
            GPT 권고
          </label>
          <button
            type="button"
            disabled={effLoading}
            onClick={() => void runEfficacy()}
            className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-gray-400"
          >
            {effLoading ? '분석 중…' : '분석'}
          </button>
        </div>
        {effError && <p className="text-sm text-red-600">{effError}</p>}
        {effMeta && (
          <p className="text-xs text-gray-500">
            {effMeta.from} ~ {effMeta.to}
          </p>
        )}
        {effEfficacy.length > 0 && (
          <div className="overflow-x-auto border-t border-gray-100 pt-4">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="py-2 pr-3">목표</th>
                  <th className="py-2 pr-3">전반 평균/추세</th>
                  <th className="py-2 pr-3">후반 평균/추세</th>
                  <th className="py-2">효과</th>
                </tr>
              </thead>
              <tbody>
                {effEfficacy.map((row) => (
                  <tr key={row.goalName} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-900">{row.goalName}</td>
                    <td className="py-2 pr-3 text-gray-700">
                      {row.preReinforcement.avgOccurrence} · {row.preReinforcement.trend}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {row.postReinforcement.avgOccurrence} · {row.postReinforcement.trend}
                    </td>
                    <td className="py-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                        {row.effectSize}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {effRec && <p className="text-sm text-gray-800 border-l-4 border-indigo-300 pl-3">{effRec}</p>}
      </section>
    </div>
  )
}
