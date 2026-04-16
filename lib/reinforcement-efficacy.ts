/**
 * PBS 기록(목표행동)과 가게 구매(강화 소비)를 기간 전·후로 나눠 거칠게 비교한다.
 * 엄밀한 단일대상 설계가 아니라 현장 모니터링용 휴리스틱이다.
 */

export type EffectSize = 'large' | 'medium' | 'small' | 'none'

export type TrendLabel = 'increasing' | 'decreasing' | 'stable'

export type DailyOcc = { date: string; goalId: string; goalName: string; occurrences: number }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function trendFromSeries(daily: number[]): TrendLabel {
  if (daily.length < 2) return 'stable'
  const mid = Math.floor(daily.length / 2)
  const a = mean(daily.slice(0, mid || 1))
  const b = mean(daily.slice(mid))
  if (b > a * 1.12) return 'increasing'
  if (b < a * 0.88) return 'decreasing'
  return 'stable'
}

function effectSizeFromDelta(earlyAvg: number, lateAvg: number): EffectSize {
  const base = Math.max(0.5, earlyAvg)
  const delta = (lateAvg - earlyAvg) / base
  if (delta >= 0.28) return 'large'
  if (delta >= 0.14) return 'medium'
  if (delta >= 0.06) return 'small'
  return 'none'
}

export function computeReinforcementEfficacy(params: {
  dailyByGoal: Map<string, { goalName: string; days: Map<string, number> }>
  purchaseCountEarly: number
  purchaseCountLate: number
  sortedDates: string[]
}): {
  efficacy: Array<{
    goalName: string
    preReinforcement: { avgOccurrence: number; trend: TrendLabel }
    postReinforcement: { avgOccurrence: number; trend: TrendLabel }
    effectSize: EffectSize
  }>
  heuristicRecommendation: string
} {
  const { dailyByGoal, purchaseCountEarly, purchaseCountLate, sortedDates } = params
  if (sortedDates.length === 0) {
    return {
      efficacy: [],
      heuristicRecommendation: '분석 기간에 PBS 체크 기록이 없습니다.',
    }
  }

  const midDate = sortedDates[Math.floor(sortedDates.length / 2)] ?? sortedDates[0]
  const earlyDates = new Set(sortedDates.filter((d) => d < midDate))
  const lateDates = new Set(sortedDates.filter((d) => d >= midDate))
  if (lateDates.size === 0) {
    lateDates.add(sortedDates[sortedDates.length - 1])
  }
  if (earlyDates.size === 0) {
    earlyDates.add(sortedDates[0])
  }

  const efficacy: Array<{
    goalName: string
    preReinforcement: { avgOccurrence: number; trend: TrendLabel }
    postReinforcement: { avgOccurrence: number; trend: TrendLabel }
    effectSize: EffectSize
  }> = []

  for (const [, g] of dailyByGoal) {
    const earlySeries: number[] = []
    const lateSeries: number[] = []
    const earlyDaily: number[] = []
    const lateDaily: number[] = []

    for (const d of sortedDates) {
      const v = g.days.get(d) ?? 0
      if (earlyDates.has(d)) {
        earlySeries.push(v)
        earlyDaily.push(v)
      }
      if (lateDates.has(d)) {
        lateSeries.push(v)
        lateDaily.push(v)
      }
    }

    const earlyAvg = round2(mean(earlySeries))
    const lateAvg = round2(mean(lateSeries))
    const preTrend = trendFromSeries(earlyDaily)
    const postTrend = trendFromSeries(lateDaily)
    const effectSize = effectSizeFromDelta(earlyAvg, lateAvg)

    if (earlySeries.length + lateSeries.length === 0) continue

    efficacy.push({
      goalName: g.goalName,
      preReinforcement: { avgOccurrence: earlyAvg, trend: preTrend },
      postReinforcement: { avgOccurrence: lateAvg, trend: postTrend },
      effectSize,
    })
  }

  efficacy.sort((a, b) => {
    const order: Record<EffectSize, number> = { large: 4, medium: 3, small: 2, none: 1 }
    return order[b.effectSize] - order[a.effectSize]
  })

  const morePurchasesLate = purchaseCountLate > purchaseCountEarly
  const improvingGoals = efficacy.filter((e) => e.effectSize === 'large' || e.effectSize === 'medium').length
  let heuristicRecommendation = ''
  if (efficacy.length === 0) {
    heuristicRecommendation = '목표별 일별 체크 데이터가 부족합니다.'
  } else if (improvingGoals >= 1 && morePurchasesLate) {
    heuristicRecommendation =
      '목표 행동 빈도가 후반으로 올라가고 가게 구매도 늘었습니다. 강화 스케줄과 목표 난이도가 맞는지 유지하며 관찰하세요.'
  } else if (improvingGoals >= 1) {
    heuristicRecommendation = '일부 목표에서 후반 평균이 올랐습니다. 강화 일정·촉구를 안정적으로 유지하는 것이 좋습니다.'
  } else if (efficacy.some((e) => e.effectSize === 'none' && e.postReinforcement.avgOccurrence < e.preReinforcement.avgOccurrence)) {
    heuristicRecommendation =
      '후반에 체크 빈도가 낮아진 목표가 있습니다. 선호 강화물·촉구·일일 목표를 점검해 보세요.'
  } else {
    heuristicRecommendation = '효과 크기가 크지 않습니다. 선호도 평가를 갱신하고 목표 정의를 조정해 보는 것을 권합니다.'
  }

  return { efficacy, heuristicRecommendation }
}
