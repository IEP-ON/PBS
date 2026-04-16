/** 단일자극 선호도: 3회 시도에서 접근·무반응·거부 집계 → 서열 */

export type TrialOutcome = 'approach' | 'neutral' | 'reject'

export type PreferenceTrialInput = {
  itemId: string
  name: string
  trials: TrialOutcome[]
}

export type PreferenceItemResult = {
  itemId: string
  name: string
  approachCount: number
  totalTrials: number
}

export const TRIALS_PER_ITEM = 3

export function normalizeTrials(raw: TrialOutcome[] | undefined): TrialOutcome[] {
  const t = Array.isArray(raw) ? raw.slice(0, TRIALS_PER_ITEM) : []
  const out: TrialOutcome[] = []
  for (let i = 0; i < TRIALS_PER_ITEM; i++) {
    const v = t[i]
    out.push(v === 'approach' || v === 'neutral' || v === 'reject' ? v : 'neutral')
  }
  return out
}

export function summarizeItems(inputs: PreferenceTrialInput[]): PreferenceItemResult[] {
  return inputs.map((row) => {
    const trials = normalizeTrials(row.trials)
    const approachCount = trials.filter((x) => x === 'approach').length
    return {
      itemId: String(row.itemId || '').trim(),
      name: String(row.name || '').trim().slice(0, 200),
      approachCount,
      totalTrials: trials.length,
    }
  })
}

export function rankPreferences(items: PreferenceItemResult[]): string[] {
  const sorted = [...items].sort((a, b) => {
    if (b.approachCount !== a.approachCount) return b.approachCount - a.approachCount
    return a.name.localeCompare(b.name, 'ko')
  })
  return sorted
    .map((r) => (r.name ? r.name : r.itemId))
    .filter((label): label is string => Boolean(label && String(label).trim()))
}
