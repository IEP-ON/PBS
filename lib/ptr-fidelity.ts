/**
 * PTR 실행 충실도(implementation fidelity) — 서버 산출용.
 * Cooper et al. 토큰 PBS 맥락에서 Prevent·Teach·Reinforce 기록을 정량화한다.
 */

export type PtrFidelityRecord = {
  occurrence_count: number | null
  antecedent_tag: string | null
  prompt_level: string | null
  token_granted: number | null
  is_settled: boolean | null
}

export type PtrFidelityGoal = {
  daily_target: number | null
}

export type PtrFidelityComputed = {
  fidelity: {
    prevent: {
      score: number
      antecedentTagRate: number
      details: string
    }
    teach: {
      score: number
      promptLevelRate: number
      independenceRate: number
      details: string
    }
    reinforce: {
      score: number
      goalCheckRate: number
      settlementRate: number
      details: string
    }
    overall: number
  }
  warnings: string[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n))
}

/** weekStart~weekEnd(포함) 사이의 월~금 일수 (달력은 KST 기준) */
export function countWeekdaysInclusive(weekStart: string, weekEnd: string): number {
  const start = new Date(`${weekStart}T12:00:00+09:00`)
  const end = new Date(`${weekEnd}T12:00:00+09:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0
  let n = 0
  const cur = new Date(start)
  while (cur <= end) {
    const wd = cur.getDay()
    if (wd >= 1 && wd <= 5) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function computePtrFidelity(params: {
  records: PtrFidelityRecord[]
  preventionSupports: string[]
  goals: PtrFidelityGoal[]
  salaryPbsInWeek: number
  weekStart: string
  weekEnd: string
}): PtrFidelityComputed {
  const { records, preventionSupports, goals, salaryPbsInWeek, weekStart, weekEnd } = params
  const totalRows = records.length
  const instructionalDays = Math.max(1, countWeekdaysInclusive(weekStart, weekEnd))

  const tagged = records.filter((r) => (r.antecedent_tag ?? '').trim().length > 0).length
  const antecedentTagRate = totalRows > 0 ? round2((tagged / totalRows) * 100) : 0

  const hasPreventionPlan = preventionSupports.some((s) => (s ?? '').trim().length > 0)
  const preventionSignalApplied = tagged > 0

  let preventScore: number
  let preventDetails: string
  if (totalRows === 0) {
    preventScore = 0
    preventDetails = `${weekStart}~${weekEnd} 주간 PBS 체크 행이 없어 Prevent 지표를 산출하지 못했습니다.`
  } else if (!hasPreventionPlan) {
    preventScore = clamp100(antecedentTagRate)
    preventDetails = `AI 프로필에 예방(Prevent) 문구가 없습니다. 선행 태그 기록 비율 ${antecedentTagRate}% (${tagged}/${totalRows}건).`
  } else {
    const alignment = preventionSignalApplied ? 100 : 0
    preventScore = clamp100(0.55 * antecedentTagRate + 0.45 * alignment)
    preventDetails = `예방 계획 ${preventionSupports.length}줄 대비 선행 태그 ${preventionSignalApplied ? '기록됨' : '미기록'}. 태그 비율 ${antecedentTagRate}% (${tagged}/${totalRows}건).`
  }

  const withPrompt = records.filter((r) => (r.prompt_level ?? '').trim().length > 0).length
  const promptLevelRate = totalRows > 0 ? round2((withPrompt / totalRows) * 100) : 0
  const indepCount = records.filter((r) => (r.prompt_level ?? '').trim() === 'independent').length
  const independenceRate =
    withPrompt > 0 ? round2((indepCount / withPrompt) * 100) : 0

  const levelCounts: Record<string, number> = {}
  for (const r of records) {
    const pl = (r.prompt_level ?? '').trim()
    if (!pl) continue
    levelCounts[pl] = (levelCounts[pl] ?? 0) + 1
  }
  const distStr =
    Object.keys(levelCounts).length > 0
      ? Object.entries(levelCounts)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')
      : '없음'

  const teachScore = clamp100(promptLevelRate)
  const teachDetails =
    totalRows === 0
      ? '체크 기록이 없어 촉구 분포를 계산하지 못했습니다.'
      : `prompt_level 기록률 ${promptLevelRate}% (${withPrompt}/${totalRows}건). 독립 비율 ${independenceRate}% (기록된 촉구 중). 분포: ${distStr}.`

  const actualOcc = records.reduce((s, r) => s + (Number(r.occurrence_count) > 0 ? Number(r.occurrence_count) : 0), 0)
  const expectedFromTargets = goals
    .map((g) => (g.daily_target != null && g.daily_target > 0 ? g.daily_target * instructionalDays : 0))
    .reduce((a, b) => a + b, 0)

  let goalCheckRate: number
  if (expectedFromTargets > 0) {
    goalCheckRate = clamp100(round2((actualOcc / expectedFromTargets) * 100))
  } else {
    // 일일 목표 미설정 시: 체크 행·발생 합으로만 거칠게 보정(중립~주의)
    goalCheckRate = totalRows === 0 ? 0 : clamp100(Math.min(100, 35 + Math.min(65, actualOcc * 3)))
  }

  const withTokens = records.filter((r) => (r.token_granted ?? 0) > 0)
  const settledAmongTokens =
    withTokens.length > 0 ? withTokens.filter((r) => r.is_settled === true).length / withTokens.length : 1
  const settlementFromRecords = withTokens.length > 0 ? round2(settledAmongTokens * 100) : 100

  const salarySignal = salaryPbsInWeek > 0 ? 100 : 0
  const settlementRate = clamp100(round2(0.65 * settlementFromRecords + 0.35 * salarySignal))

  const reinforceScore = clamp100(0.62 * goalCheckRate + 0.38 * settlementRate)
  const reinforceDetails = `발생 합계 ${actualOcc}회, 일일목표×수업일 기대 ${expectedFromTargets || '(목표 미설정)'}회 → 목표 대비 ${goalCheckRate}%. 토큰 발생 건 중 정산 반영 ${settlementFromRecords}%, 주간 salary_pbs 거래 ${salaryPbsInWeek}건.`

  const overall = clamp100(round2((preventScore + teachScore + reinforceScore) / 3))

  const warnings: string[] = []
  if (totalRows === 0) {
    warnings.push('해당 주에 PBS 체크 기록이 없습니다.')
  }
  if (totalRows > 0 && promptLevelRate < 55) {
    warnings.push('촉구 수준(prompt_level)이 절반 이하로만 기록되었습니다. Teach 기록을 권장합니다.')
  }
  if (totalRows >= 4 && antecedentTagRate < 35) {
    warnings.push('선행 퀵태그(antecedent_tag) 비율이 낮습니다. Prevent 기록을 늘리면 분석 신뢰도가 올라갑니다.')
  }
  if (hasPreventionPlan && totalRows > 0 && !preventionSignalApplied) {
    warnings.push('AI 계획에 예방 문구가 있으나 이번 주 선행 태그가 한 번도 기록되지 않았습니다.')
  }
  if (expectedFromTargets > 0 && goalCheckRate < 50) {
    warnings.push('일일 목표 대비 체크(강화) 빈도가 낮습니다.')
  }
  if (withTokens.length > 0 && settlementFromRecords < 85) {
    warnings.push('미정산 PBS 토큰이 남아 있을 수 있습니다. 정산(성과급 반영)을 확인해 주세요.')
  }
  if (salaryPbsInWeek === 0 && withTokens.some((r) => !r.is_settled)) {
    warnings.push('이번 주 salary_pbs(정산) 거래가 없습니다.')
  }

  return {
    fidelity: {
      prevent: {
        score: round2(preventScore),
        antecedentTagRate,
        details: preventDetails,
      },
      teach: {
        score: round2(teachScore),
        promptLevelRate,
        independenceRate,
        details: teachDetails,
      },
      reinforce: {
        score: round2(reinforceScore),
        goalCheckRate,
        settlementRate,
        details: reinforceDetails,
      },
      overall,
    },
    warnings,
  }
}

export function heuristicPtrRecommendation(computed: PtrFidelityComputed): string {
  const { prevent, teach, reinforce, overall } = computed.fidelity
  const weakest =
    prevent.score <= teach.score && prevent.score <= reinforce.score
      ? 'Prevent'
      : teach.score <= reinforce.score
        ? 'Teach'
        : 'Reinforce'
  return `종합 ${overall}점 — ${weakest} 점수가 상대적으로 낮습니다. 주간 체크 시 선행 태그·촉구 단계·정산 루틴을 함께 맞추면 PTR 충실도가 안정됩니다.`
}
