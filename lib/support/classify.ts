import type {
  SupportBucketKey,
  SupportOverviewStudentBrief,
  SupportPtrStage,
  SupportRiskBadge,
} from '@/types'

export interface ClassifyStudentInput {
  id: string
  name: string
  hasAiProfile: boolean
  fbaCount: number
  activeGoalCount: number
  activeContractCount: number
  runningDroCount: number
  unresolvedAlertCount: number
  fourteenDayTokenTotal: number
  sevenDayAverageTokens: number
  activeDailyTargetTokenTotal: number
  lastActivityAt: string | null
}

function deriveRiskBadges(input: ClassifyStudentInput): SupportRiskBadge[] {
  const badges: SupportRiskBadge[] = []
  const stagnant = input.fourteenDayTokenTotal === 0 && (input.activeContractCount > 0 || input.runningDroCount > 0)
  const overReinforced =
    input.activeDailyTargetTokenTotal > 0 &&
    input.sevenDayAverageTokens > input.activeDailyTargetTokenTotal * 1.5

  if (input.unresolvedAlertCount > 0) badges.push('extinction')
  if (stagnant) badges.push('stagnant')
  if (overReinforced) badges.push('over_reinforced')

  return badges
}

function deriveBucket(input: ClassifyStudentInput, riskBadges: SupportRiskBadge[]): SupportBucketKey {
  if (riskBadges.includes('extinction') || riskBadges.includes('stagnant')) {
    return 'reviewNeeded'
  }

  if (input.activeContractCount > 0 || input.runningDroCount > 0) {
    return 'executing'
  }

  if (!input.hasAiProfile && input.fbaCount === 0) {
    return 'uncategorized'
  }

  if (input.hasAiProfile && (input.activeGoalCount === 0 || input.activeContractCount === 0)) {
    return 'planNeeded'
  }

  if (input.fbaCount > 0 && input.activeGoalCount === 0 && input.activeContractCount === 0) {
    return 'planNeeded'
  }

  return 'uncategorized'
}

function derivePtrStage(bucket: SupportBucketKey, input: ClassifyStudentInput): SupportPtrStage {
  if (bucket === 'reviewNeeded') return 'review'
  if (bucket === 'executing') return 'execute'
  if (bucket === 'planNeeded') return 'plan'
  if (input.hasAiProfile || input.fbaCount > 0) return 'plan'
  return 'assess'
}

export function classifyStudent(input: ClassifyStudentInput): SupportOverviewStudentBrief {
  const riskBadges = deriveRiskBadges(input)
  const currentBucket = deriveBucket(input, riskBadges)
  const ptrStage = derivePtrStage(currentBucket, input)

  return {
    id: input.id,
    name: input.name,
    currentBucket,
    riskBadges,
    ptrStage,
    lastActivityAt: input.lastActivityAt,
  }
}
