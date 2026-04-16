/** 촉구(prompt_level) 기록 기반 Teach 진행도 — 서버 집계 */

export type PromptLevelKey = 'full' | 'partial' | 'gesture' | 'independent'

export type TeachProgressRecord = {
  record_date: string
  prompt_level: string | null
}

const LEVELS: PromptLevelKey[] = ['full', 'partial', 'gesture', 'independent']

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyDist(): Record<PromptLevelKey, number> {
  return { full: 0, partial: 0, gesture: 0, independent: 0 }
}

function indepRateOfChunk(chunk: TeachProgressRecord[]): number {
  const withLevel = chunk.filter((r) => (r.prompt_level ?? '').trim().length > 0)
  if (withLevel.length === 0) return 0
  const indep = withLevel.filter((r) => (r.prompt_level ?? '').trim() === 'independent').length
  return indep / withLevel.length
}

export function computeTeachProgress(records: TeachProgressRecord[]): {
  totalRecords: number
  levelDistribution: Record<PromptLevelKey, number>
  trend: 'improving' | 'stable' | 'regressing'
  independenceRate: number
  readyToFade: boolean
} {
  const dist = emptyDist()
  for (const r of records) {
    const pl = (r.prompt_level ?? '').trim().toLowerCase()
    if (LEVELS.includes(pl as PromptLevelKey)) {
      dist[pl as PromptLevelKey]++
    }
  }
  const totalWithLevel = LEVELS.reduce((s, k) => s + dist[k], 0)
  const independenceRate =
    totalWithLevel > 0 ? round2((dist.independent / totalWithLevel) * 100) : 0

  const sorted = [...records].sort((a, b) => {
    const c = a.record_date.localeCompare(b.record_date)
    return c !== 0 ? c : 0
  })
  const n = sorted.length
  const mid = Math.max(1, Math.floor(n / 2))
  const first = sorted.slice(0, mid)
  const second = sorted.slice(mid)

  const r1 = indepRateOfChunk(first)
  const r2 = indepRateOfChunk(second)

  let trend: 'improving' | 'stable' | 'regressing'
  if (n < 4) {
    trend = 'stable'
  } else if (r2 - r1 > 0.08) {
    trend = 'improving'
  } else if (r1 - r2 > 0.08) {
    trend = 'regressing'
  } else {
    trend = 'stable'
  }

  const readyToFade =
    totalWithLevel >= 5 &&
    independenceRate >= 58 &&
    trend !== 'regressing' &&
    r2 >= 0.32

  return {
    totalRecords: records.length,
    levelDistribution: dist,
    trend,
    independenceRate,
    readyToFade,
  }
}

export function heuristicTeachRecommendation(p: {
  trend: 'improving' | 'stable' | 'regressing'
  independenceRate: number
  readyToFade: boolean
}): string {
  if (p.trend === 'regressing') {
    return '최근 구간에서 독립 비율이 낮아졌습니다. 촉구를 한 단계 되돌리거나 선행 조건을 줄여 재교습하는 것을 검토하세요.'
  }
  if (p.readyToFade) {
    return '독립 비율과 추세가 양호합니다. 다음 촉구 단계(덜 직접적)로 페이딩을 검토할 시점입니다.'
  }
  if (p.independenceRate < 35) {
    return '아직 직접 촉구 비중이 큽니다. 부분·제스처 촉구로 안정화한 뒤 독립 비율을 높이세요.'
  }
  return '추세를 유지하며 기록을 이어가세요. 독립 비율이 더 오르면 페이딩 기준을 점검하면 됩니다.'
}
