import type {
  StudentAiFollowUpQuestion,
  StudentAiProfile,
  StudentFeatureOutputs,
} from '@/types'

type NullableString = string | null | undefined

const AI_PROFILE_ARRAY_FIELDS = [
  'strengths',
  'preferences',
  'student_voice_keywords',
  'support_needs',
  'risk_flags',
  'observable_behaviors',
  'antecedent_patterns',
  'consequence_patterns',
  'hypothesized_functions',
  'replacement_behaviors',
  'positive_target_behaviors',
  'prevention_supports',
  'reinforcement_preferences',
  'incident_tags',
  'class_mode_targets',
  'p_prompt_options',
] as const

type AiProfileArrayField = (typeof AI_PROFILE_ARRAY_FIELDS)[number]

const EMPTY_PROFILE_ARRAYS = Object.fromEntries(
  AI_PROFILE_ARRAY_FIELDS.map((field) => [field, []])
) as unknown as Record<AiProfileArrayField, string[]>

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )
  )
}

export function normalizeFollowUpQuestions(value: unknown): StudentAiFollowUpQuestion[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      const question = typeof raw.question === 'string' ? raw.question.trim() : ''
      if (!question) return null

      return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `q${index + 1}`,
        question,
        reason: typeof raw.reason === 'string' ? raw.reason.trim() : '',
        target_field: typeof raw.target_field === 'string' ? raw.target_field.trim() : '',
      }
    })
    .filter((item): item is StudentAiFollowUpQuestion => Boolean(item))
    .slice(0, 4)
}

export function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function sanitizeConfidenceMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, typeof raw === 'string' ? raw.trim() : ''])
      .filter(([key, raw]) => key && raw)
  )
}

export function sanitizeAiProfilePayload(
  payload: Record<string, unknown>,
  {
    sourceFreeText,
    teacherVerified = false,
  }: {
    sourceFreeText?: NullableString
    teacherVerified?: boolean
  } = {}
) {
  const arrays = Object.fromEntries(
    AI_PROFILE_ARRAY_FIELDS.map((field) => [field, normalizeStringArray(payload[field])])
  ) as unknown as Record<AiProfileArrayField, string[]>

  const followUpQuestions = normalizeFollowUpQuestions(
    payload.follow_up_questions ?? payload.generated_follow_up_questions
  )

  return {
    source_free_text: sanitizeText(sourceFreeText) ?? sanitizeText(payload.source_free_text),
    current_level_summary:
      sanitizeText(payload.current_level_summary) ??
      sanitizeText(payload.currentLevelSummary),
    ...EMPTY_PROFILE_ARRAYS,
    ...arrays,
    dro_candidate: sanitizeText(payload.dro_candidate),
    student_registration_summary:
      sanitizeText(payload.student_registration_summary) ??
      buildRegistrationSummary({
        strengths: arrays.strengths,
        supportNeeds: arrays.support_needs,
        preferences: arrays.preferences,
      }),
    ai_plan_one_liner:
      sanitizeText(payload.ai_plan_one_liner) ??
      buildAiPlanOneLiner({
        currentLevelSummary: sanitizeText(payload.current_level_summary),
        observableBehaviors: arrays.observable_behaviors,
        supportNeeds: arrays.support_needs,
      }),
    public_safe_summary:
      sanitizeText(payload.public_safe_summary) ??
      buildPublicSafeSummary({
        strengths: arrays.strengths,
        preferences: arrays.preferences,
        classModeTargets: arrays.class_mode_targets,
      }),
    private_teacher_notes: sanitizeText(payload.private_teacher_notes),
    teacher_verified: teacherVerified,
    generated_follow_up_questions: followUpQuestions,
    confidence_by_field: sanitizeConfidenceMap(payload.confidence_by_field),
  }
}

export function mapStudentAiProfile(row: Record<string, unknown>): StudentAiProfile {
  const payload = sanitizeAiProfilePayload(row, {
    sourceFreeText: sanitizeText(row.source_free_text),
    teacherVerified: Boolean(row.teacher_verified),
  })

  return {
    id: String(row.id || ''),
    student_id: String(row.student_id || ''),
    class_code_id: String(row.class_code_id || ''),
    source_free_text: payload.source_free_text,
    current_level_summary: payload.current_level_summary,
    strengths: payload.strengths,
    preferences: payload.preferences,
    student_voice_keywords: payload.student_voice_keywords,
    support_needs: payload.support_needs,
    risk_flags: payload.risk_flags,
    observable_behaviors: payload.observable_behaviors,
    antecedent_patterns: payload.antecedent_patterns,
    consequence_patterns: payload.consequence_patterns,
    hypothesized_functions: payload.hypothesized_functions,
    replacement_behaviors: payload.replacement_behaviors,
    positive_target_behaviors: payload.positive_target_behaviors,
    prevention_supports: payload.prevention_supports,
    reinforcement_preferences: payload.reinforcement_preferences,
    incident_tags: payload.incident_tags,
    class_mode_targets: payload.class_mode_targets,
    p_prompt_options: payload.p_prompt_options,
    dro_candidate: payload.dro_candidate,
    student_registration_summary: payload.student_registration_summary,
    ai_plan_one_liner: payload.ai_plan_one_liner,
    public_safe_summary: payload.public_safe_summary,
    private_teacher_notes: payload.private_teacher_notes,
    teacher_verified: Boolean(row.teacher_verified),
    generated_follow_up_questions: payload.generated_follow_up_questions,
    confidence_by_field: payload.confidence_by_field,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  }
}

export function buildRegistrationSummary({
  strengths,
  supportNeeds,
  preferences,
}: {
  strengths: string[]
  supportNeeds: string[]
  preferences: string[]
}) {
  const parts: string[] = []

  if (strengths[0]) parts.push(`${strengths[0]} 등의 강점이 있습니다`)
  if (preferences[0]) parts.push(`${preferences.slice(0, 2).join(', ')} 선호가 뚜렷합니다`)
  if (supportNeeds[0]) parts.push(`${supportNeeds.slice(0, 2).join(', ')} 지원이 우선 필요합니다`)

  return parts.join('. ') || '학생 이해 정보가 아직 충분히 입력되지 않았습니다.'
}

export function buildAiPlanOneLiner({
  currentLevelSummary,
  observableBehaviors,
  supportNeeds,
}: {
  currentLevelSummary: string | null
  observableBehaviors: string[]
  supportNeeds: string[]
}) {
  const parts: string[] = []
  if (currentLevelSummary) parts.push(currentLevelSummary)
  if (observableBehaviors[0]) parts.push(`주요 관찰 행동은 ${observableBehaviors.slice(0, 2).join(', ')}입니다`)
  if (supportNeeds[0]) parts.push(`${supportNeeds.slice(0, 2).join(', ')} 지원이 필요합니다`)

  return parts.join('. ') || '학생 AI 프로필 기반 행동 지원 요약이 아직 준비되지 않았습니다.'
}

export function buildPublicSafeSummary({
  strengths,
  preferences,
  classModeTargets,
}: {
  strengths: string[]
  preferences: string[]
  classModeTargets: string[]
}) {
  const parts: string[] = []
  if (strengths[0]) parts.push(`강점: ${strengths.slice(0, 2).join(', ')}`)
  if (preferences[0]) parts.push(`좋아하는 것: ${preferences.slice(0, 2).join(', ')}`)
  if (classModeTargets[0]) parts.push(`오늘의 목표: ${classModeTargets.slice(0, 2).join(', ')}`)
  return parts.join(' · ') || '오늘의 목표를 선생님과 함께 확인해 보세요.'
}

export function buildFeatureOutputs(profile: StudentAiProfile | null): StudentFeatureOutputs {
  return {
    registrationSummary:
      profile?.student_registration_summary ||
      buildRegistrationSummary({
        strengths: profile?.strengths || [],
        supportNeeds: profile?.support_needs || [],
        preferences: profile?.preferences || [],
      }),
    aiPlanOneLiner:
      profile?.ai_plan_one_liner ||
      buildAiPlanOneLiner({
        currentLevelSummary: profile?.current_level_summary || null,
        observableBehaviors: profile?.observable_behaviors || [],
        supportNeeds: profile?.support_needs || [],
      }),
    classModeTargets: profile?.class_mode_targets || [],
    pPromptOptions: profile?.p_prompt_options || [],
    incidentTags: profile?.incident_tags || [],
    droCandidate: profile?.dro_candidate || 'DRO 후보 정보가 아직 없습니다.',
    publicSafeSummary:
      profile?.public_safe_summary ||
      buildPublicSafeSummary({
        strengths: profile?.strengths || [],
        preferences: profile?.preferences || [],
        classModeTargets: profile?.class_mode_targets || [],
      }),
  }
}
