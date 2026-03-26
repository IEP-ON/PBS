'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  studentId: string
  studentName: string
  grade: number | null
  classCode: string
}

interface FbaPlan {
  estimatedFunction: string
  confidence: string
  rationale: string
  behaviorPattern: string
}

interface PbsGoalDraft {
  behaviorName: string
  behaviorDefinition: string
  strategyType: string
  tokenPerOccurrence: number
  rationale: string
}

interface ContractDraft {
  contractTitle: string
  targetBehavior: string
  behaviorDefinition: string
  measurementMethod: string
  achievementCriteria: string
  rewardAmount: number
  teacherNote: string
}

interface InterventionDraft {
  strategyName: string
  description: string
  evidenceLevel: string
  applicableFunctions: string[]
}

interface DroDraft {
  intervalMinutes: number
  tokenReward: number
  rationale: string
}

interface ExtinctionDraft {
  baselineCount: number
  alertThreshold: number
  rationale: string
}

interface BehaviorPlan {
  fba: FbaPlan
  pbsGoals: PbsGoalDraft[]
  contract: ContractDraft
  interventions: InterventionDraft[]
  dro: DroDraft
  extinctionAlert: ExtinctionDraft
}

const FUNCTION_LABELS: Record<string, string> = {
  attention: '주의 추구',
  escape: '회피/도피',
  sensory: '감각 자극',
  tangible: '물건 획득',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '높음', medium: '중간', low: '낮음',
}

const EVIDENCE_LABELS: Record<string, string> = {
  strong: '강력 근거', moderate: '중간 근거', emerging: '신규 근거',
  'evidence-based': '근거기반', promising: '유망',
}

const FUNCTION_COLORS: Record<string, string> = {
  attention: 'bg-purple-100 text-purple-700',
  escape: 'bg-orange-100 text-orange-700',
  sensory: 'bg-green-100 text-green-700',
  tangible: 'bg-blue-100 text-blue-700',
}

type SaveStatus = 'idle' | 'saving' | 'done' | 'error'

export default function AiBehaviorPlan({ studentId, studentName, grade, classCode }: Props) {
  const [open, setOpen] = useState(true)

  // 입력 모드: 'structured' | 'free'
  const [inputMode, setInputMode] = useState<'structured' | 'free'>('free')
  const [freeText, setFreeText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  // 입력 폼
  const [currentLevel, setCurrentLevel] = useState('')
  const [targetBehavior, setTargetBehavior] = useState('')
  const [antecedents, setAntecedents] = useState('')
  const [consequences, setConsequences] = useState('')
  const [environment, setEnvironment] = useState('')

  // AI 결과
  const [plan, setPlan] = useState<BehaviorPlan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  // 편집 가능한 초안 상태
  const [editedPlan, setEditedPlan] = useState<BehaviorPlan | null>(null)

  // 피드백 루프용: 생성 로그 ID + 원본 계획 참조
  const [logId, setLogId] = useState<string | null>(null)
  const [originalPlan, setOriginalPlan] = useState<BehaviorPlan | null>(null)

  // 저장 상태 (섹션별)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({})

  const handleParse = async () => {
    if (!freeText || freeText.trim().length < 10) {
      setParseError('학생에 대한 설명을 10자 이상 입력해주세요.')
      return
    }
    setParsing(true)
    setParseError('')
    try {
      const res = await fetch('/api/ai/parse-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeText, studentName, grade }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '분석 오류')
      const p = data.parsed
      if (p.currentLevel) setCurrentLevel(p.currentLevel)
      if (p.targetBehavior) setTargetBehavior(p.targetBehavior)
      if (p.antecedents) setAntecedents(p.antecedents)
      if (p.consequences) setConsequences(p.consequences)
      if (p.environment) setEnvironment(p.environment)
      setInputMode('structured')
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setParsing(false)
    }
  }

  const handleGenerate = async () => {
    if (!currentLevel || !targetBehavior) {
      setGenError('현행수준과 표적 행동을 입력하세요.')
      return
    }
    setGenerating(true)
    setGenError('')
    setPlan(null)
    setEditedPlan(null)
    setSaveStatus({})
    setSaveMsg({})
    setLogId(null)
    setOriginalPlan(null)

    try {
      const res = await fetch('/api/ai/behavior-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          grade,
          currentLevel,
          targetBehavior,
          antecedents,
          consequences,
          environment,
          studentId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 오류')
      setPlan(data.plan)
      setEditedPlan(JSON.parse(JSON.stringify(data.plan)))
      setOriginalPlan(JSON.parse(JSON.stringify(data.plan)))
      if (data.logId) setLogId(data.logId)
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const setStatus = (key: string, status: SaveStatus, msg = '') => {
    setSaveStatus(p => ({ ...p, [key]: status }))
    setSaveMsg(p => ({ ...p, [key]: msg }))
  }

  const saveFba = async () => {
    if (!editedPlan) return
    setStatus('fba', 'saving')
    const fba = editedPlan.fba
    const res = await fetch('/api/fba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        behaviorDescription: targetBehavior,
        antecedentPatterns: antecedents ? antecedents.split(',').map(s => s.trim()) : [],
        consequencePatterns: consequences ? consequences.split(',').map(s => s.trim()) : [],
        requestAiAnalysis: false,
        estimatedFunction: fba.estimatedFunction,
        confidence: fba.confidence,
        rationale: fba.rationale,
      }),
    })
    if (res.ok) setStatus('fba', 'done', 'FBA 기록 저장 완료 (기능: ' + fba.estimatedFunction + ')')
    else setStatus('fba', 'error', 'FBA 저장 실패')
  }

  const savePbsGoals = async () => {
    if (!editedPlan) return
    setStatus('pbs', 'saving')
    let success = 0
    const dro = editedPlan.dro
    for (let i = 0; i < editedPlan.pbsGoals.length; i++) {
      const goal = editedPlan.pbsGoals[i]
      // 첫 번째 목표에 DRO 설정 자동 포함
      const isDroGoal = i === 0 && dro.intervalMinutes > 0
      const res = await fetch('/api/pbs/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          behaviorName: goal.behaviorName,
          behaviorDefinition: goal.behaviorDefinition,
          tokenPerOccurrence: goal.tokenPerOccurrence,
          strategyType: goal.strategyType,
          isDro: isDroGoal,
          droIntervalMinutes: isDroGoal ? dro.intervalMinutes : undefined,
        }),
      })
      if (res.ok) success++
    }
    setStatus('pbs', success === editedPlan.pbsGoals.length ? 'done' : 'error',
      `PBS 목표 ${success}/${editedPlan.pbsGoals.length}개 저장${dro.intervalMinutes > 0 ? ' (DRO 포함)' : ''}`)
  }

  const saveContract = async () => {
    if (!editedPlan) return
    setStatus('contract', 'saving')
    const c = editedPlan.contract
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        contractTitle: c.contractTitle,
        targetBehavior: c.targetBehavior,
        behaviorDefinition: c.behaviorDefinition,
        measurementMethod: c.measurementMethod,
        achievementCriteria: c.achievementCriteria,
        rewardAmount: c.rewardAmount,
        teacherNote: c.teacherNote,
        contractStart: new Date().toISOString().split('T')[0],
      }),
    })
    if (res.ok) setStatus('contract', 'done', '행동계약서 저장 완료')
    else setStatus('contract', 'error', '계약서 저장 실패')
  }

  const saveInterventions = async () => {
    if (!editedPlan) return
    setStatus('interventions', 'saving')
    let success = 0
    for (const iv of editedPlan.interventions) {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: iv.strategyName,
          description: iv.description,
          evidenceLevel: iv.evidenceLevel,
          applicableFunctions: iv.applicableFunctions,
        }),
      })
      if (res.ok) success++
    }
    setStatus('interventions', success === editedPlan.interventions.length ? 'done' : 'error',
      `중재전략 ${success}/${editedPlan.interventions.length}개 저장`)
  }

  const saveAll = async () => {
    await Promise.all([saveFba(), savePbsGoals(), saveContract(), saveInterventions()])
    // 피드백 루프: 저장 완료 후 교사 수정 여부 기록
    if (logId && editedPlan) {
      const teacherModified = JSON.stringify(editedPlan) !== JSON.stringify(originalPlan)
      fetch('/api/ai/behavior-plan-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId,
          accepted: true,
          teacherModified,
          finalSaved: editedPlan,
        }),
      }).catch(() => {})
    }
  }

  const updateGoal = (i: number, field: keyof PbsGoalDraft, value: string | number) => {
    if (!editedPlan) return
    const goals = [...editedPlan.pbsGoals]
    goals[i] = { ...goals[i], [field]: value }
    setEditedPlan({ ...editedPlan, pbsGoals: goals })
  }

  const updateContract = (field: keyof ContractDraft, value: string | number) => {
    if (!editedPlan) return
    setEditedPlan({ ...editedPlan, contract: { ...editedPlan.contract, [field]: value } })
  }

  const SaveBtn = ({ skey, onClick }: { skey: string; onClick: () => void }) => {
    const s = saveStatus[skey]
    return (
      <button
        onClick={onClick}
        disabled={s === 'saving' || s === 'done'}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          s === 'done' ? 'bg-green-100 text-green-700 cursor-default' :
          s === 'error' ? 'bg-red-100 text-red-600' :
          s === 'saving' ? 'bg-gray-100 text-gray-400 cursor-wait' :
          'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {s === 'done' ? '✓ 저장됨' : s === 'saving' ? '저장 중...' : s === 'error' ? '재시도' : '저장'}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-purple-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div className="text-left">
            <p className="font-bold text-gray-900">AI 행동 지원 계획</p>
            <p className="text-xs text-gray-500">현행수준 입력 → GPT-4o가 ABA 기반 초안 생성 → 교사 검토·저장</p>
          </div>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 border-t border-purple-100">

          {/* 입력 모드 토글 */}
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={() => setInputMode('free')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                inputMode === 'free'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ✍️ 자유 입력
            </button>
            <button
              onClick={() => setInputMode('structured')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                inputMode === 'structured'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📋 항목별 입력
            </button>
            <span className="text-xs text-gray-400 ml-2">
              {inputMode === 'free' ? 'AI가 ABA ABC 모델 기반으로 자동 분배합니다' : '각 항목에 직접 입력합니다'}
            </span>
          </div>

          {/* 자유 입력 모드 */}
          {inputMode === 'free' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-purple-800 mb-1">💡 자유롭게 작성하세요</p>
                <p className="text-xs text-purple-600">학생의 장애 유형, 현재 수준, 문제 행동, 발생 상황 등을 순서 상관없이 편하게 적어주세요. AI가 ABA 기능행동평가(FBA) 프레임워크에 맞게 자동으로 분류합니다.</p>
              </div>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="예: 지적장애 2급인 3학년 남학생이에요. 수업 중에 자리를 이탈하는 행동이 하루에 5~8번 정도 있어요. 특히 수학 시간이나 어려운 과제가 주어지면 더 심해지고, 자리를 이탈하면 제가 가서 개별 지도를 해주게 돼요. 통합학급 25명이고 보조교사가 오전에만 있어요. 단어~짧은 문장 수준으로 표현하고 숫자는 10까지 인식해요."
                rows={6}
                className="block w-full px-4 py-3 bg-white border border-purple-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              />
              {parseError && <p className="text-sm text-red-500">{parseError}</p>}
              <button
                onClick={handleParse}
                disabled={parsing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {parsing ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    AI 분석 중... (ABC 모델 기반 분류)
                  </>
                ) : '🧠 AI 자동 분배 (ABA 기반)'}
              </button>
            </div>
          )}

          {/* 구조화 입력 폼 */}
          <div className={`space-y-3 ${inputMode === 'free' ? 'pt-2' : 'pt-4'}`}>
            {inputMode === 'structured' && currentLevel && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700">✅ AI 자동 분배 완료 — 아래 항목을 확인하고 필요시 수정하세요</p>
              </div>
            )}
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">현행수준 <span className="text-red-400">*</span></span>
              <textarea
                value={currentLevel}
                onChange={e => setCurrentLevel(e.target.value)}
                placeholder="예: 지적장애 경도. 단어~짧은 문장 표현. 숫자 10까지 인식. 주의집중 5분 이내."
                rows={3}
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">표적 행동 (문제 행동) <span className="text-red-400">*</span></span>
              <input
                value={targetBehavior}
                onChange={e => setTargetBehavior(e.target.value)}
                placeholder="예: 수업 중 자리 이탈, 하루 평균 5~8회"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">선행 사건</span>
                <input
                  value={antecedents}
                  onChange={e => setAntecedents(e.target.value)}
                  placeholder="예: 어려운 과제, 교사 관심 감소"
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">결과 사건</span>
                <input
                  value={consequences}
                  onChange={e => setConsequences(e.target.value)}
                  placeholder="예: 교사 개별 지도, 과제 회피 성공"
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">환경 / 상황</span>
              <input
                value={environment}
                onChange={e => setEnvironment(e.target.value)}
                placeholder="예: 통합학급 25명, 보조교사 있음, 오전 1~2교시에 주로 발생"
                className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </label>

            {genError && <p className="text-sm text-red-500">{genError}</p>}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  GPT-4o 분석 중...
                </>
              ) : '🤖 AI 행동 지원 계획 생성'}
            </button>
          </div>

          {/* 결과 섹션 */}
          {editedPlan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900">📋 생성된 초안 — 수정 후 저장하세요</p>
                <button
                  onClick={saveAll}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  ✅ 모두 저장
                </button>
              </div>

              {/* FBA */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-purple-900">🔍 FBA 기능행동분석</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.fba && <span className="text-xs text-gray-500">{saveMsg.fba}</span>}
                    <SaveBtn skey="fba" onClick={saveFba} />
                    <Link href={`/${classCode}/fba`} className="text-xs text-purple-500 hover:text-purple-700">FBA 탭 →</Link>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${FUNCTION_COLORS[editedPlan.fba.estimatedFunction] || 'bg-gray-100 text-gray-600'}`}>
                    추정 기능: {FUNCTION_LABELS[editedPlan.fba.estimatedFunction] || editedPlan.fba.estimatedFunction}
                  </span>
                  <span className="text-xs bg-white border border-purple-200 px-2 py-1 rounded-full">
                    신뢰도: {CONFIDENCE_LABELS[editedPlan.fba.confidence] || editedPlan.fba.confidence}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{editedPlan.fba.rationale}</p>
                <p className="text-xs text-gray-500 italic">{editedPlan.fba.behaviorPattern}</p>
              </div>

              {/* PBS 목표 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-blue-900">✅ PBS 행동 목표 ({editedPlan.pbsGoals.length}개)</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.pbs && <span className="text-xs text-gray-500">{saveMsg.pbs}</span>}
                    <SaveBtn skey="pbs" onClick={savePbsGoals} />
                    <Link href={`/${classCode}/pbs`} className="text-xs text-blue-500 hover:text-blue-700">PBS 탭 →</Link>
                  </div>
                </div>
                {editedPlan.pbsGoals.map((goal, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 space-y-2 border border-blue-100">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={goal.behaviorName}
                        onChange={e => updateGoal(i, 'behaviorName', e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="행동명"
                      />
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={goal.tokenPerOccurrence}
                          onChange={e => updateGoal(i, 'tokenPerOccurrence', Number(e.target.value))}
                          className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="text-xs text-gray-400 self-center">원/회</span>
                        <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full self-center">{goal.strategyType}</span>
                      </div>
                    </div>
                    <textarea
                      value={goal.behaviorDefinition}
                      onChange={e => updateGoal(i, 'behaviorDefinition', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      placeholder="행동 정의"
                    />
                    <p className="text-xs text-gray-400 italic">{goal.rationale}</p>
                  </div>
                ))}
              </div>

              {/* 행동계약서 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-amber-900">📝 행동계약서 초안</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.contract && <span className="text-xs text-gray-500">{saveMsg.contract}</span>}
                    <SaveBtn skey="contract" onClick={saveContract} />
                    <Link href={`/${classCode}/contracts`} className="text-xs text-amber-600 hover:text-amber-800">계약서 탭 →</Link>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 space-y-2 border border-amber-100">
                  <input
                    value={editedPlan.contract.contractTitle}
                    onChange={e => updateContract('contractTitle', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="계약서 제목"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editedPlan.contract.measurementMethod}
                      onChange={e => updateContract('measurementMethod', e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="측정 방법"
                    />
                    <input
                      value={editedPlan.contract.achievementCriteria}
                      onChange={e => updateContract('achievementCriteria', e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="달성 기준"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">보상:</label>
                    <input
                      type="number"
                      value={editedPlan.contract.rewardAmount}
                      onChange={e => updateContract('rewardAmount', Number(e.target.value))}
                      className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-xs text-gray-400">원</span>
                  </div>
                </div>
              </div>

              {/* 중재전략 */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-green-900">📚 추천 중재전략 ({editedPlan.interventions.length}개)</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.interventions && <span className="text-xs text-gray-500">{saveMsg.interventions}</span>}
                    <SaveBtn skey="interventions" onClick={saveInterventions} />
                    <Link href={`/${classCode}/interventions`} className="text-xs text-green-600 hover:text-green-800">전략 탭 →</Link>
                  </div>
                </div>
                {editedPlan.interventions.map((iv, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 space-y-1 border border-green-100">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{iv.strategyName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        iv.evidenceLevel === 'strong' ? 'bg-green-100 text-green-700' :
                        iv.evidenceLevel === 'evidence-based' ? 'bg-green-100 text-green-700' :
                        iv.evidenceLevel === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        iv.evidenceLevel === 'promising' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{EVIDENCE_LABELS[iv.evidenceLevel]}</span>
                    </div>
                    <p className="text-xs text-gray-600">{iv.description}</p>
                    <div className="flex gap-1 flex-wrap">
                      {iv.applicableFunctions.map(f => (
                        <span key={f} className={`text-xs px-1.5 py-0.5 rounded ${FUNCTION_COLORS[f] || 'bg-gray-100 text-gray-600'}`}>
                          {FUNCTION_LABELS[f] || f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* DRO + 소거알림 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-orange-900">⏱️ DRO 권장 설정</p>
                    <Link href={`/${classCode}/dro`} className="text-xs text-orange-500 hover:text-orange-700">DRO 탭 →</Link>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">{editedPlan.dro.intervalMinutes}분</p>
                  <p className="text-xs text-gray-500">간격 · 보상 {editedPlan.dro.tokenReward}원</p>
                  <p className="text-xs text-gray-400 italic">{editedPlan.dro.rationale}</p>
                  <p className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-lg mt-1">↑ PBS 목표 저장 시 DRO 설정이 자동 포함됩니다</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-red-900">🚨 소거 알림 기준</p>
                    <Link href={`/${classCode}/extinction-alerts`} className="text-xs text-red-500 hover:text-red-700">알림 탭 →</Link>
                  </div>
                  <p className="text-xs text-gray-600">
                    기저선 <strong>{editedPlan.extinctionAlert.baselineCount}회</strong>/일
                    → 임계값 <strong className="text-red-600">{editedPlan.extinctionAlert.alertThreshold}회</strong> 초과 시 알림
                  </p>
                  <p className="text-xs text-gray-400 italic">{editedPlan.extinctionAlert.rationale}</p>
                  <p className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-lg mt-1">시스템이 PBS 기록 패턴에서 자동 감지합니다</p>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  )
}
