/**
 * 전략명 끝의 (FCT), (NCR) 등 또는 단독 약어 "FCT"에서 근거DB abbreviation과 맞출 키 추출.
 */
export function extractCanonicalAbbrevFromStrategyName(name: string): string | null {
  const t = name.trim()
  const paren = t.match(/\(([A-Za-z0-9]{2,12})\)\s*$/)
  if (paren) return paren[1].toUpperCase()
  if (/^[A-Za-z]{2,12}$/.test(t)) return t.toUpperCase()
  return null
}

/** AI 생성 abbreviation 예: 타행동차별강화_xk3a → 앞부분만 제거해 시드 약어와 묶기 */
function abbreviationBase(abbreviation: string): string | null {
  const base = abbreviation.replace(/_[a-z0-9]{2,8}$/i, '')
  if (/^[A-Za-z]{2,12}$/.test(base)) return base.toUpperCase()
  return null
}

function interventionDedupeKey(row: { name_ko: string; abbreviation: string }): string {
  const fromName = extractCanonicalAbbrevFromStrategyName(row.name_ko)
  if (fromName) return fromName
  const fromAbbr = abbreviationBase(row.abbreviation)
  if (fromAbbr) return fromAbbr
  return row.abbreviation
}

const EVIDENCE_RANK: Record<string, number> = { strong: 0, moderate: 1, emerging: 2 }

/** 학생 상세 등: 동일 약어·동일 계열 전략은 한 줄만 보이도록 */
export function dedupeInterventionsForDisplay<
  T extends { id: string; name_ko: string; abbreviation: string; evidence_level: string },
>(rows: T[]): T[] {
  const best = new Map<string, T>()
  for (const row of rows) {
    const k = interventionDedupeKey(row)
    const prev = best.get(k)
    const rNew = EVIDENCE_RANK[row.evidence_level] ?? 3
    const rOld = prev ? (EVIDENCE_RANK[prev.evidence_level] ?? 3) : 999
    if (!prev || rNew < rOld) best.set(k, row)
  }
  return [...best.values()].sort((a, b) => a.name_ko.localeCompare(b.name_ko, 'ko'))
}
