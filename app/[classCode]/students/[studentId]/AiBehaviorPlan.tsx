'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  buildFeatureOutputs,
  normalizeStringArray,
  sanitizeConfidenceMap,
  sanitizeText,
} from '@/lib/ai-profile'
import type { StudentAiFollowUpQuestion, StudentAiProfile } from '@/types'

interface Props {
  studentId: string
  studentName: string
  grade: number | null
  classCode: string
  initialProfile: StudentAiProfile | null
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

type SaveStatus = 'idle' | 'saving' | 'done' | 'error'

type EditableStudentAiProfile = Omit<
  StudentAiProfile,
  'id' | 'student_id' | 'class_code_id' | 'created_at' | 'updated_at'
>

const FUNCTION_LABELS: Record<string, string> = {
  attention: '주의 추구',
  escape: '회피/도피',
  sensory: '감각 자극',
  tangible: '물건 획득',
}

const FUNCTION_COLORS: Record<string, string> = {
  attention: 'bg-purple-100 text-purple-700',
  escape: 'bg-orange-100 text-orange-700',
  sensory: 'bg-green-100 text-green-700',
  tangible: 'bg-blue-100 text-blue-700',
}

const EVIDENCE_LABELS: Record<string, string> = {
  strong: '강력 근거',
  moderate: '중간 근거',
  emerging: '신규 근거',
  'evidence-based': '근거기반',
  promising: '유망',
}

function createEmptyProfile(sourceText = ''): EditableStudentAiProfile {
  return {
    source_free_text: sourceText,
    current_level_summary: null,
    strengths: [],
    preferences: [],
    student_voice_keywords: [],
    support_needs: [],
    risk_flags: [],
    observable_behaviors: [],
    antecedent_patterns: [],
    consequence_patterns: [],
    hypothesized_functions: [],
    replacement_behaviors: [],
    positive_target_behaviors: [],
    prevention_supports: [],
    reinforcement_preferences: [],
    incident_tags: [],
    class_mode_targets: [],
    p_prompt_options: [],
    dro_candidate: null,
    student_registration_summary: null,
    ai_plan_one_liner: null,
    public_safe_summary: null,
    private_teacher_notes: null,
    teacher_verified: false,
    generated_follow_up_questions: [],
    confidence_by_field: {},
  }
}

function profileToEditable(profile: StudentAiProfile | null): EditableStudentAiProfile {
  if (!profile) return createEmptyProfile()

  return {
    source_free_text: profile.source_free_text,
    current_level_summary: profile.current_level_summary,
    strengths: profile.strengths,
    preferences: profile.preferences,
    student_voice_keywords: profile.student_voice_keywords,
    support_needs: profile.support_needs,
    risk_flags: profile.risk_flags,
    observable_behaviors: profile.observable_behaviors,
    antecedent_patterns: profile.antecedent_patterns,
    consequence_patterns: profile.consequence_patterns,
    hypothesized_functions: profile.hypothesized_functions,
    replacement_behaviors: profile.replacement_behaviors,
    positive_target_behaviors: profile.positive_target_behaviors,
    prevention_supports: profile.prevention_supports,
    reinforcement_preferences: profile.reinforcement_preferences,
    incident_tags: profile.incident_tags,
    class_mode_targets: profile.class_mode_targets,
    p_prompt_options: profile.p_prompt_options,
    dro_candidate: profile.dro_candidate,
    student_registration_summary: profile.student_registration_summary,
    ai_plan_one_liner: profile.ai_plan_one_liner,
    public_safe_summary: profile.public_safe_summary,
    private_teacher_notes: profile.private_teacher_notes,
    teacher_verified: profile.teacher_verified,
    generated_follow_up_questions: profile.generated_follow_up_questions,
    confidence_by_field: profile.confidence_by_field,
  }
}

function editableToProfile(editable: EditableStudentAiProfile): StudentAiProfile {
  return {
    id: 'draft',
    student_id: 'draft',
    class_code_id: 'draft',
    created_at: '',
    updated_at: '',
    ...editable,
  }
}

function arrayToText(value: string[]) {
  return value.join('\n')
}

function textToArray(value: string) {
  return normalizeStringArray(value.split('\n'))
}

function normalizeEditableProfile(
  profile: EditableStudentAiProfile,
  fallbackSourceText: string
): EditableStudentAiProfile {
  return {
    ...profile,
    source_free_text: sanitizeText(profile.source_free_text) ?? sanitizeText(fallbackSourceText),
    current_level_summary: sanitizeText(profile.current_level_summary),
    strengths: normalizeStringArray(profile.strengths),
    preferences: normalizeStringArray(profile.preferences),
    student_voice_keywords: normalizeStringArray(profile.student_voice_keywords),
    support_needs: normalizeStringArray(profile.support_needs),
    risk_flags: normalizeStringArray(profile.risk_flags),
    observable_behaviors: normalizeStringArray(profile.observable_behaviors),
    antecedent_patterns: normalizeStringArray(profile.antecedent_patterns),
    consequence_patterns: normalizeStringArray(profile.consequence_patterns),
    hypothesized_functions: normalizeStringArray(profile.hypothesized_functions),
    replacement_behaviors: normalizeStringArray(profile.replacement_behaviors),
    positive_target_behaviors: normalizeStringArray(profile.positive_target_behaviors),
    prevention_supports: normalizeStringArray(profile.prevention_supports),
    reinforcement_preferences: normalizeStringArray(profile.reinforcement_preferences),
    incident_tags: normalizeStringArray(profile.incident_tags),
    class_mode_targets: normalizeStringArray(profile.class_mode_targets),
    p_prompt_options: normalizeStringArray(profile.p_prompt_options),
    dro_candidate: sanitizeText(profile.dro_candidate),
    student_registration_summary: sanitizeText(profile.student_registration_summary),
    ai_plan_one_liner: sanitizeText(profile.ai_plan_one_liner),
    public_safe_summary: sanitizeText(profile.public_safe_summary),
    private_teacher_notes: sanitizeText(profile.private_teacher_notes),
    teacher_verified: Boolean(profile.teacher_verified),
    generated_follow_up_questions: profile.generated_follow_up_questions || [],
    confidence_by_field: sanitizeConfidenceMap(profile.confidence_by_field),
  }
}

export default function AiBehaviorPlan({
  studentId,
  studentName,
  grade,
  classCode,
  initialProfile,
}: Props) {
  const [open, setOpen] = useState(true)
  const [freeText, setFreeText] = useState(initialProfile?.source_free_text || '')
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({})
  const [optionalPrompt, setOptionalPrompt] = useState('')
  const [profileId, setProfileId] = useState<string | null>(initialProfile?.id || null)
  const [profile, setProfile] = useState<EditableStudentAiProfile>(profileToEditable(initialProfile))
  const [parsing, setParsing] = useState(false)
  const [refining, setRefining] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [parseError, setParseError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')

  const [editedPlan, setEditedPlan] = useState<BehaviorPlan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [logId, setLogId] = useState<string | null>(null)
  const [originalPlan, setOriginalPlan] = useState<BehaviorPlan | null>(null)
  const [strategyMapping, setStrategyMapping] = useState<Record<number, number>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({})

  useEffect(() => {
    setProfileId(initialProfile?.id || null)
    setProfile(profileToEditable(initialProfile))
    setFreeText(initialProfile?.source_free_text || '')
  }, [initialProfile])

  const featureOutputs = useMemo(
    () => buildFeatureOutputs(editableToProfile(profile)),
    [profile]
  )

  const setStatus = (key: string, status: SaveStatus, msg = '') => {
    setSaveStatus((prev) => ({ ...prev, [key]: status }))
    setSaveMsg((prev) => ({ ...prev, [key]: msg }))
  }

  const applyDraft = (draft: {
    profile: EditableStudentAiProfile
    follow_up_questions?: StudentAiFollowUpQuestion[]
    confidence_by_field?: Record<string, string>
  }) => {
    const nextProfile = normalizeEditableProfile(
      {
        ...profile,
        ...draft.profile,
        generated_follow_up_questions: draft.follow_up_questions || draft.profile.generated_follow_up_questions || [],
        confidence_by_field: draft.confidence_by_field || draft.profile.confidence_by_field || {},
      },
      freeText
    )
    setProfile(nextProfile)
    setProfileMessage('AI 구조화 결과를 불러왔습니다. 확인 후 저장하세요.')
  }

  const handleParse = async () => {
    if (!freeText || freeText.trim().length < 20) {
      setParseError('학생에 대한 자유입력을 20자 이상 적어주세요.')
      return
    }

    setParsing(true)
    setParseError('')
    setProfileMessage('')

    try {
      const res = await fetch('/api/ai/student-profile/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName, grade, freeText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 구조화에 실패했습니다.')
      applyDraft(data.draft)
    } catch (error: unknown) {
      setParseError(error instanceof Error ? error.message : '오류가 발생했습니다.')
    } finally {
      setParsing(false)
    }
  }

  const handleRefine = async () => {
    const answered = Object.fromEntries(
      Object.entries(followUpAnswers).filter(([, value]) => value.trim())
    )

    if (Object.keys(answered).length === 0) {
      setParseError('보강할 답변을 한 개 이상 입력해주세요.')
      return
    }

    setRefining(true)
    setParseError('')

    try {
      const res = await fetch('/api/ai/student-profile/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          sourceFreeText: freeText,
          currentProfile: profile,
          answers: answered,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 보강에 실패했습니다.')
      applyDraft(data.draft)
      setFollowUpAnswers({})
    } catch (error: unknown) {
      setParseError(error instanceof Error ? error.message : '오류가 발생했습니다.')
    } finally {
      setRefining(false)
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileMessage('')

    try {
      const payload = normalizeEditableProfile(
        { ...profile, teacher_verified: true },
        freeText
      )
      const res = await fetch(`/api/students/${studentId}/ai-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: payload,
          sourceFreeText: freeText,
          teacherVerified: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '학생 AI 프로필 저장에 실패했습니다.')

      setProfile(profileToEditable(data.profile))
      setProfileId(data.profile.id)
      setFreeText(data.profile.source_free_text || freeText)
      setProfileMessage('학생 AI 프로필을 저장했습니다.')
      return data.profile as StudentAiProfile
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '오류가 발생했습니다.'
      setProfileMessage(message)
      throw error
    } finally {
      setSavingProfile(false)
    }
  }

  const handleGeneratePlan = async () => {
    setGenerating(true)
    setGenError('')
    setEditedPlan(null)
    setSaveStatus({})
    setSaveMsg({})
    setLogId(null)
    setOriginalPlan(null)

    try {
      await saveProfile()

      const res = await fetch('/api/ai/behavior-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          optionalPrompt: optionalPrompt.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 행동 지원 계획 생성에 실패했습니다.')

      setEditedPlan(JSON.parse(JSON.stringify(data.plan)))
      setOriginalPlan(JSON.parse(JSON.stringify(data.plan)))
      setLogId(data.logId || null)

      const mapping: Record<number, number> = {}
      const interventions: InterventionDraft[] = data.plan.interventions || []
      ;(data.plan.pbsGoals || []).forEach((goal: PbsGoalDraft, index: number) => {
        const abbr = (goal.strategyType || '').toUpperCase()
        const matchIndex = interventions.findIndex((item) =>
          item.strategyName.toUpperCase().includes(abbr) ||
          item.description.toUpperCase().includes(abbr)
        )
        mapping[index] = matchIndex
      })
      setStrategyMapping(mapping)
    } catch (error: unknown) {
      setGenError(error instanceof Error ? error.message : '오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const saveFba = async (currentPlan = editedPlan) => {
    if (!currentPlan) return
    setStatus('fba', 'saving')
    const fba = currentPlan.fba
    const res = await fetch('/api/fba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        behaviorDescription: currentPlan.contract.targetBehavior || profile.observable_behaviors[0] || '',
        antecedentPatterns: profile.antecedent_patterns,
        consequencePatterns: profile.consequence_patterns,
        requestAiAnalysis: false,
        estimatedFunction: fba.estimatedFunction,
        confidence: fba.confidence,
        rationale: fba.rationale,
      }),
    })
    if (res.ok) setStatus('fba', 'done', `FBA 저장 완료 (${FUNCTION_LABELS[fba.estimatedFunction] || fba.estimatedFunction})`)
    else setStatus('fba', 'error', 'FBA 저장 실패')
  }

  const savePbsGoals = async (currentPlan = editedPlan) => {
    if (!currentPlan) return
    setStatus('pbs', 'saving')

    let success = 0
    const dro = currentPlan.dro
    for (let index = 0; index < currentPlan.pbsGoals.length; index += 1) {
      const goal = currentPlan.pbsGoals[index]
      const isDroGoal = index === 0 && dro.intervalMinutes > 0
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
      if (res.ok) success += 1
    }

    setStatus(
      'pbs',
      success === currentPlan.pbsGoals.length ? 'done' : 'error',
      `PBS 목표 ${success}/${currentPlan.pbsGoals.length}개 저장`
    )
  }

  const saveContract = async (currentPlan = editedPlan) => {
    if (!currentPlan) return
    setStatus('contract', 'saving')

    const c = currentPlan.contract
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

  const saveInterventions = async (currentPlan = editedPlan) => {
    if (!currentPlan) return
    setStatus('interventions', 'saving')

    let success = 0
    for (const intervention of currentPlan.interventions) {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: intervention.strategyName,
          description: intervention.description,
          evidenceLevel: intervention.evidenceLevel,
          applicableFunctions: intervention.applicableFunctions,
        }),
      })
      if (res.ok) success += 1
    }

    setStatus(
      'interventions',
      success === currentPlan.interventions.length ? 'done' : 'error',
      `중재전략 ${success}/${currentPlan.interventions.length}개 저장`
    )
  }

  const saveAll = async () => {
    if (!editedPlan) return

    await saveInterventions(editedPlan)

    const linkedGoals = editedPlan.pbsGoals.map((goal, index) => {
      const interventionIndex = strategyMapping[index] ?? -1
      if (interventionIndex >= 0 && editedPlan.interventions[interventionIndex]) {
        return { ...goal, strategyType: editedPlan.interventions[interventionIndex].strategyName }
      }
      return goal
    })

    const nextPlan = { ...editedPlan, pbsGoals: linkedGoals }
    setEditedPlan(nextPlan)

    await Promise.all([
      saveFba(nextPlan),
      savePbsGoals(nextPlan),
      saveContract(nextPlan),
    ])

    if (logId && originalPlan) {
      fetch('/api/ai/behavior-plan-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId,
          accepted: true,
          teacherModified: JSON.stringify(nextPlan) !== JSON.stringify(originalPlan),
          finalSaved: nextPlan,
        }),
      }).catch(() => {})
    }
  }

  const SaveBtn = ({ skey, onClick }: { skey: string; onClick: () => void }) => {
    const status = saveStatus[skey]
    return (
      <button
        onClick={onClick}
        disabled={status === 'saving' || status === 'done'}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          status === 'done'
            ? 'bg-green-100 text-green-700 cursor-default'
            : status === 'error'
              ? 'bg-red-100 text-red-600'
              : status === 'saving'
                ? 'bg-gray-100 text-gray-400 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {status === 'done' ? '✓ 저장됨' : status === 'saving' ? '저장 중...' : status === 'error' ? '재시도' : '저장'}
      </button>
    )
  }

  const updateProfileText = (field: keyof EditableStudentAiProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
      teacher_verified: false,
    }))
  }

  const updateProfileArray = (field: keyof EditableStudentAiProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: textToArray(value),
      teacher_verified: false,
    }))
  }

  const updateGoal = (index: number, field: keyof PbsGoalDraft, value: string | number) => {
    if (!editedPlan) return
    const nextGoals = [...editedPlan.pbsGoals]
    nextGoals[index] = { ...nextGoals[index], [field]: value }
    setEditedPlan({ ...editedPlan, pbsGoals: nextGoals })
  }

  const updateContract = (field: keyof ContractDraft, value: string | number) => {
    if (!editedPlan) return
    setEditedPlan({ ...editedPlan, contract: { ...editedPlan.contract, [field]: value } })
  }

  return (
    <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-purple-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div className="text-left">
            <p className="font-bold text-gray-900">AI 행동 지원 계획</p>
            <p className="text-xs text-gray-500">학생 이해 입력 → AI 구조화 → 교사 수정 → 전 기능 재사용</p>
          </div>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-4 space-y-5 border-t border-purple-100">
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-bold text-purple-900">학생 이해 입력</p>
            <p className="mt-2 text-xs leading-6 text-purple-700">
              진단명만 적기보다 강점, 좋아하는 것, 어려운 행동, 자주 생기는 상황, 행동 뒤 교사 반응, 꼭 조심할 점을 편하게 적어주세요.
            </p>
            <textarea
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              rows={7}
              className="mt-3 block w-full rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              placeholder="예: 운동을 좋아하고 축구 이야기를 많이 합니다. 자유시간과 체육 시간에 흥분하면 규칙을 놓치고 공을 너무 세게 차는 경우가 있습니다. 수업 전후 준비물을 자주 빠뜨리고, 교사가 짧게 다시 알려주면 바로 따라오는 편입니다. 좋아하는 칭찬과 활동 기회가 뚜렷하고, 친구와 가까울 때 위생 행동이 나올 수 있어 조심이 필요합니다."
            />
            {parseError && <p className="mt-3 text-sm text-red-500">{parseError}</p>}
            {profileMessage && <p className="mt-3 text-sm text-purple-700">{profileMessage}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleParse}
                disabled={parsing}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:bg-purple-300"
              >
                {parsing ? 'AI 구조화 중...' : '🧠 AI 구조화하기'}
              </button>
              <button
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:bg-gray-400"
              >
                {savingProfile ? '저장 중...' : '💾 학생 AI 프로필 저장'}
              </button>
            </div>
          </div>

          {profile.generated_follow_up_questions.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-amber-900">AI 보강 질문</p>
                  <p className="mt-1 text-xs text-amber-700">누락 정보만 짧게 보완하면 다음 생성 품질이 더 안정됩니다.</p>
                </div>
                <button
                  onClick={handleRefine}
                  disabled={refining}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:bg-amber-300"
                >
                  {refining ? '보강 중...' : '보강 반영'}
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {profile.generated_follow_up_questions.map((question) => (
                  <label key={question.id} className="block rounded-xl border border-amber-200 bg-white p-3">
                    <p className="text-sm font-semibold text-gray-900">{question.question}</p>
                    {question.reason && <p className="mt-1 text-xs text-gray-500">{question.reason}</p>}
                    <input
                      value={followUpAnswers[question.id] || ''}
                      onChange={(event) =>
                        setFollowUpAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
                      }
                      className="mt-3 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      placeholder="짧게 답을 적어주세요"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-bold text-gray-900">학생 AI 프로필 카드</p>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">현행수준 요약</span>
                    <textarea
                      rows={3}
                      value={profile.current_level_summary || ''}
                      onChange={(event) => updateProfileText('current_level_summary', event.target.value)}
                      className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">강점</span>
                      <textarea rows={4} value={arrayToText(profile.strengths)} onChange={(event) => updateProfileArray('strengths', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">선호 / 강화물</span>
                      <textarea rows={4} value={arrayToText(profile.preferences)} onChange={(event) => updateProfileArray('preferences', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">지원 필요</span>
                      <textarea rows={4} value={arrayToText(profile.support_needs)} onChange={(event) => updateProfileArray('support_needs', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">위험 요인</span>
                      <textarea rows={4} value={arrayToText(profile.risk_flags)} onChange={(event) => updateProfileArray('risk_flags', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">관찰 행동</span>
                      <textarea rows={4} value={arrayToText(profile.observable_behaviors)} onChange={(event) => updateProfileArray('observable_behaviors', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">대체 행동</span>
                      <textarea rows={4} value={arrayToText(profile.replacement_behaviors)} onChange={(event) => updateProfileArray('replacement_behaviors', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">선행 사건</span>
                      <textarea rows={4} value={arrayToText(profile.antecedent_patterns)} onChange={(event) => updateProfileArray('antecedent_patterns', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">결과 사건</span>
                      <textarea rows={4} value={arrayToText(profile.consequence_patterns)} onChange={(event) => updateProfileArray('consequence_patterns', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">수업모드 목표</span>
                      <textarea rows={4} value={arrayToText(profile.class_mode_targets)} onChange={(event) => updateProfileArray('class_mode_targets', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">촉구 문구 후보</span>
                      <textarea rows={4} value={arrayToText(profile.p_prompt_options)} onChange={(event) => updateProfileArray('p_prompt_options', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">사건 태그</span>
                      <textarea rows={4} value={arrayToText(profile.incident_tags)} onChange={(event) => updateProfileArray('incident_tags', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">DRO 후보</span>
                      <textarea rows={4} value={profile.dro_candidate || ''} onChange={(event) => updateProfileText('dro_candidate', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">학생 등록 요약</span>
                    <textarea rows={3} value={profile.student_registration_summary || ''} onChange={(event) => updateProfileText('student_registration_summary', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">AI 행동 지원 계획 한 줄</span>
                    <textarea rows={3} value={profile.ai_plan_one_liner || ''} onChange={(event) => updateProfileText('ai_plan_one_liner', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">학생 공개용 안전 요약</span>
                    <textarea rows={3} value={profile.public_safe_summary || ''} onChange={(event) => updateProfileText('public_safe_summary', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">교사 전용 메모</span>
                    <textarea rows={3} value={profile.private_teacher_notes || ''} onChange={(event) => updateProfileText('private_teacher_notes', event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-blue-900">플랫폼 연동 미리보기</p>
                  {profileId && (
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-blue-700">
                      저장된 프로필
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">학생 등록 요약</p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{featureOutputs.registrationSummary}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">AI 계획 한 줄</p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{featureOutputs.aiPlanOneLiner}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">수업 모드</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {featureOutputs.classModeTargets.length > 0 ? featureOutputs.classModeTargets.map((target) => (
                        <span key={target} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">{target}</span>
                      )) : <span className="text-sm text-gray-500">아직 제안된 목표가 없습니다.</span>}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">촉구 문구</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {featureOutputs.pPromptOptions.length > 0 ? featureOutputs.pPromptOptions.map((prompt) => (
                          <span key={prompt} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{prompt}</span>
                        )) : <span className="text-sm text-gray-500">촉구 문구가 없습니다.</span>}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">사건 태그</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {featureOutputs.incidentTags.length > 0 ? featureOutputs.incidentTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">{tag}</span>
                        )) : <span className="text-sm text-gray-500">사건 태그가 없습니다.</span>}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">학생 홈 / 말 일기장 공개 요약</p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{featureOutputs.publicSafeSummary}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">DRO 후보</p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{featureOutputs.droCandidate}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm font-bold text-indigo-900">행동 지원 계획 생성</p>
                <p className="mt-1 text-xs text-indigo-700">학생 AI 프로필을 기준으로 FBA, PBS 목표, 계약서, 중재 전략, DRO를 생성합니다.</p>
                <textarea
                  rows={3}
                  value={optionalPrompt}
                  onChange={(event) => setOptionalPrompt(event.target.value)}
                  className="mt-3 block w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  placeholder="예: 이번에는 자리이탈과 도움요청 중심으로 수업모드에 바로 쓸 수 있게 생성해줘"
                />
                <button
                  onClick={handleGeneratePlan}
                  disabled={generating || savingProfile}
                  className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {generating ? 'GPT-4o 분석 중...' : '🤖 AI 행동 지원 계획 생성'}
                </button>
                {genError && <p className="mt-3 text-sm text-red-500">{genError}</p>}
              </div>
            </div>
          </div>

          {editedPlan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900">📋 생성된 행동 지원 초안</p>
                <button
                  onClick={saveAll}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
                >
                  ✅ 모두 저장
                </button>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-purple-900">🔍 FBA 기능행동분석</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.fba && <span className="text-xs text-gray-500">{saveMsg.fba}</span>}
                    <SaveBtn skey="fba" onClick={() => void saveFba()} />
                    <Link href={`/${classCode}/fba`} className="text-xs text-purple-500 hover:text-purple-700">FBA 탭 →</Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${FUNCTION_COLORS[editedPlan.fba.estimatedFunction] || 'bg-gray-100 text-gray-600'}`}>
                    추정 기능: {FUNCTION_LABELS[editedPlan.fba.estimatedFunction] || editedPlan.fba.estimatedFunction}
                  </span>
                  <span className="text-xs rounded-full border border-purple-200 bg-white px-2 py-1">
                    신뢰도: {editedPlan.fba.confidence}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{editedPlan.fba.rationale}</p>
                <p className="text-xs text-gray-500 italic">{editedPlan.fba.behaviorPattern}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-blue-900">✅ PBS 행동 목표 ({editedPlan.pbsGoals.length}개)</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.pbs && <span className="text-xs text-gray-500">{saveMsg.pbs}</span>}
                    <SaveBtn skey="pbs" onClick={() => void savePbsGoals()} />
                    <Link href={`/${classCode}/pbs`} className="text-xs text-blue-500 hover:text-blue-700">PBS 탭 →</Link>
                  </div>
                </div>
                {editedPlan.pbsGoals.map((goal, index) => (
                  <div key={index} className="rounded-lg border border-blue-100 bg-white p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={goal.behaviorName} onChange={(event) => updateGoal(index, 'behaviorName', event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <div className="flex items-center gap-2">
                        <input type="number" value={goal.tokenPerOccurrence} onChange={(event) => updateGoal(index, 'tokenPerOccurrence', Number(event.target.value))} className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        <span className="text-xs text-gray-400">원/회</span>
                      </div>
                    </div>
                    {editedPlan.interventions.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">적용 전략:</span>
                        <select
                          value={strategyMapping[index] ?? -1}
                          onChange={(event) => setStrategyMapping((prev) => ({ ...prev, [index]: Number(event.target.value) }))}
                          className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value={-1}>— 전략 없음 (기존 약어 유지)</option>
                          {editedPlan.interventions.map((intervention, j) => (
                            <option key={j} value={j}>{intervention.strategyName}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <textarea value={goal.behaviorDefinition} onChange={(event) => updateGoal(index, 'behaviorDefinition', event.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                    <p className="text-xs text-gray-400 italic">{goal.rationale}</p>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-amber-900">📝 행동계약서 초안</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.contract && <span className="text-xs text-gray-500">{saveMsg.contract}</span>}
                    <SaveBtn skey="contract" onClick={() => void saveContract()} />
                    <Link href={`/${classCode}/contracts`} className="text-xs text-amber-600 hover:text-amber-800">계약서 탭 →</Link>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-white p-3 space-y-2">
                  <input value={editedPlan.contract.contractTitle} onChange={(event) => updateContract('contractTitle', event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editedPlan.contract.measurementMethod} onChange={(event) => updateContract('measurementMethod', event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <input value={editedPlan.contract.achievementCriteria} onChange={(event) => updateContract('achievementCriteria', event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">보상</label>
                    <input type="number" value={editedPlan.contract.rewardAmount} onChange={(event) => updateContract('rewardAmount', Number(event.target.value))} className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <span className="text-xs text-gray-400">원</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-green-900">📚 추천 중재전략 ({editedPlan.interventions.length}개)</p>
                  <div className="flex items-center gap-2">
                    {saveMsg.interventions && <span className="text-xs text-gray-500">{saveMsg.interventions}</span>}
                    <SaveBtn skey="interventions" onClick={() => void saveInterventions()} />
                    <Link href={`/${classCode}/interventions`} className="text-xs text-green-600 hover:text-green-800">전략 탭 →</Link>
                  </div>
                </div>
                {editedPlan.interventions.map((intervention, index) => (
                  <div key={index} className="rounded-lg border border-green-100 bg-white p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{intervention.strategyName}</p>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        {EVIDENCE_LABELS[intervention.evidenceLevel] || intervention.evidenceLevel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{intervention.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {intervention.applicableFunctions.map((fn) => (
                        <span key={fn} className={`rounded px-1.5 py-0.5 text-xs ${FUNCTION_COLORS[fn] || 'bg-gray-100 text-gray-600'}`}>
                          {FUNCTION_LABELS[fn] || fn}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-orange-900">⏱️ DRO 권장 설정</p>
                    <Link href={`/${classCode}/dro`} className="text-xs text-orange-500 hover:text-orange-700">DRO 탭 →</Link>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">{editedPlan.dro.intervalMinutes}분</p>
                  <p className="text-xs text-gray-500">간격 · 보상 {editedPlan.dro.tokenReward}원</p>
                  <p className="text-xs text-gray-400 italic">{editedPlan.dro.rationale}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-red-900">🚨 소거 알림 기준</p>
                    <Link href={`/${classCode}/extinction-alerts`} className="text-xs text-red-500 hover:text-red-700">알림 탭 →</Link>
                  </div>
                  <p className="text-xs text-gray-600">
                    기저선 <strong>{editedPlan.extinctionAlert.baselineCount}회</strong>/일 · 임계값 <strong className="text-red-600">{editedPlan.extinctionAlert.alertThreshold}회</strong>
                  </p>
                  <p className="text-xs text-gray-400 italic">{editedPlan.extinctionAlert.rationale}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
