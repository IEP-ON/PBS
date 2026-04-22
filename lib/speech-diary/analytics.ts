/**
 * 말 일기 집계·분석 (교사 대시보드용). DB 스키마: pbs_speech_diaries
 */

export interface SpeechDiaryRow {
  id: string
  student_id: string
  raw_transcript: string | null
  corrected_text: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | string | null
  keywords: string[] | null
  created_at: string
  duration_seconds?: number | null
}

export interface StudentRef {
  id: string
  name: string
}

function toDate(iso: string): string {
  return iso.slice(0, 10)
}

/** 어절 단위 TTR (Type-Token Ratio) */
export function calcTTR(text: string | null | undefined): number {
  if (!text) return 0
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const types = new Set(tokens)
  return Math.round((types.size / tokens.length) * 100) / 100
}

function toWeekKey(isoDate: string): string {
  const d = new Date(isoDate)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(a.trim().toLowerCase().split(/\s+/).filter(Boolean))
  const tb = new Set(b.trim().toLowerCase().split(/\s+/).filter(Boolean))
  if (ta.size === 0 && tb.size === 0) return 1
  let inter = 0
  for (const w of ta) {
    if (tb.has(w)) inter++
  }
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : Math.round((inter / union) * 100) / 100
}

function calcStats(entries: SpeechDiaryRow[]) {
  if (entries.length === 0) {
    return { avgLength: 0, avgTTR: 0, avgRawCorrectedJaccard: 0, avgRewriteIntensity: 0 }
  }
  const lengths = entries.map((d) => (d.corrected_text || d.raw_transcript || '').length)
  const ttrs = entries.map((d) => calcTTR(d.corrected_text || d.raw_transcript))
  const jaccs = entries.map((d) =>
    tokenJaccard(d.raw_transcript || '', d.corrected_text || d.raw_transcript || '')
  )
  const rewrite = jaccs.map((j) => Math.round((1 - j) * 100) / 100)
  return {
    avgLength: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    avgTTR: Math.round((ttrs.reduce((a, b) => a + b, 0) / ttrs.length) * 100) / 100,
    avgRawCorrectedJaccard: Math.round((jaccs.reduce((a, b) => a + b, 0) / jaccs.length) * 100) / 100,
    avgRewriteIntensity: Math.round((rewrite.reduce((a, b) => a + b, 0) / rewrite.length) * 100) / 100,
  }
}

function calcSentiment(entries: SpeechDiaryRow[]) {
  const counts = { positive: 0, neutral: 0, negative: 0, null: 0 }
  for (const d of entries) {
    const k = (d.sentiment || 'null') as keyof typeof counts
    if (k in counts) counts[k]++
    else counts.null++
  }
  return counts
}

export function buildSpeechDiaryAnalytics(diaries: SpeechDiaryRow[], students: StudentRef[]) {
  const nameById = Object.fromEntries(students.map((s) => [s.id, s.name]))
  const studentIds = students.map((s) => s.id)

  const byStudent: Record<
    string,
    {
      name: string
      count: number
      avgLength: number
      avgTTR: number
      avgRawCorrectedJaccard: number
      avgRewriteIntensity: number
      sentiment: ReturnType<typeof calcSentiment>
      activeDays: number
    }
  > = {}

  for (const sid of studentIds) {
    const rows = diaries.filter((d) => d.student_id === sid)
    const stats = calcStats(rows)
    const days = new Set(rows.map((d) => toDate(d.created_at)))
    byStudent[sid] = {
      name: nameById[sid] || sid,
      count: rows.length,
      ...stats,
      sentiment: calcSentiment(rows),
      activeDays: days.size,
    }
  }

  const kwFreq: Record<string, number> = {}
  for (const d of diaries) {
    if (!d.keywords) continue
    for (const kw of d.keywords) {
      kwFreq[kw] = (kwFreq[kw] || 0) + 1
    }
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }))

  const weekly: Record<string, number> = {}
  for (const d of diaries) {
    const wk = toWeekKey(d.created_at)
    weekly[wk] = (weekly[wk] || 0) + 1
  }
  const weeklySorted = Object.entries(weekly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }))

  const classStats = calcStats(diaries)

  return {
    totalDiaries: diaries.length,
    studentCount: studentIds.length,
    classAvgLength: classStats.avgLength,
    classAvgTTR: classStats.avgTTR,
    classAvgRawCorrectedJaccard: classStats.avgRawCorrectedJaccard,
    classAvgRewriteIntensity: classStats.avgRewriteIntensity,
    topKeywords,
    weekly: weeklySorted,
    byStudent: Object.entries(byStudent).map(([id, v]) => ({ studentId: id, ...v })),
  }
}
