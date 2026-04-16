/** PBS 기록(수업 모드·PBS 체크) 공통: 촉구 단계와 API POST 본문 */

export type PromptLevel = 'full' | 'partial' | 'gesture' | 'independent'

export const PROMPT_LEVEL_LABELS: Record<PromptLevel, string> = {
  full: '전체 촉구',
  partial: '부분 촉구',
  gesture: '제스처',
  independent: '독립',
}

export type PbsRecordPostBody = {
  studentId: string
  goalId: string
  occurrenceCount: number
  prompted: boolean
  promptLevel: PromptLevel
  antecedentTag?: string
}

export function buildPbsRecordPostBody(params: {
  studentId: string
  goalId: string
  occurrenceCount: number
  promptLevel: PromptLevel
  antecedentTag?: string | null
}): PbsRecordPostBody {
  const prompted = params.promptLevel !== 'independent'
  const tag = params.antecedentTag?.trim()
  return {
    studentId: params.studentId,
    goalId: params.goalId,
    occurrenceCount: params.occurrenceCount,
    prompted,
    promptLevel: params.promptLevel,
    ...(tag ? { antecedentTag: tag.slice(0, 200) } : {}),
  }
}
