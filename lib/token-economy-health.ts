import { createServerSupabase } from '@/lib/supabase/server'
import type {
  TokenEconomyBand,
  TokenEconomyBandKey,
  TokenEconomyHealthResponse,
  TokenEconomyHealthStatus,
  TokenEconomyPriceLabel,
  TokenEconomyRecommendedBands,
  TokenEconomyShopLabel,
  TokenEconomyStockLabel,
  TokenEconomyWarning,
} from '@/types'

const ANALYSIS_DAYS = 14

const INCOME_TYPES = new Set([
  'salary_basic',
  'salary_pbs',
  'salary_bonus',
  'interest',
  'speech_diary_reward',
  'qr_token',
])

const SPENDING_TYPES = new Set([
  'purchase',
  'gift_sent',
  'stock_buy',
])

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>

type StudentRow = {
  id: string
}

type AccountRow = {
  student_id: string
  balance: number | null
}

type SalaryRuleRow = {
  rule_type: string
  amount: number
}

type GoalRow = {
  student_id: string
  token_per_occurrence: number
  daily_target: number | null
}

type TransactionRow = {
  student_id: string
  type: string
  amount: number
  created_at: string
}

type RecordRow = {
  student_id: string
  record_date: string
  token_granted: number
  is_settled: boolean
}

type ShopRow = {
  id: string
  price: number
}

type StockRow = {
  id: string
  current_price: number
}

type ContractRow = {
  reward_amount: number
}

type WarningDraft = TokenEconomyWarning & {
  family?: 'inflation' | 'deflation'
  weight: number
}

function toStartDate(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (days - 1))
  return date
}

function roundMetric(value: number, digits: number = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
  }
  return sorted[middle]
}

function buildBand(baseline: number, minMultiple: number, maxMultiple: number): TokenEconomyBand {
  return {
    min: Math.round(baseline * minMultiple),
    max: Math.round(baseline * maxMultiple),
  }
}

function buildRecommendedBands(baseline: number): TokenEconomyRecommendedBands {
  return {
    small: buildBand(baseline, 2.0, 3.0),
    medium: buildBand(baseline, 5.0, 8.0),
    large: buildBand(baseline, 10.0, 15.0),
    stockStart: buildBand(baseline, 3.0, 6.0),
  }
}

function classifyPrice(price: number, band: TokenEconomyBand): TokenEconomyPriceLabel {
  if (price < band.min) return 'too_low'
  if (price > band.max) return 'too_high'
  return 'good'
}

function closestShopBand(price: number, bands: TokenEconomyRecommendedBands): Extract<TokenEconomyBandKey, 'small' | 'medium' | 'large'> {
  const entries: Array<{ key: Extract<TokenEconomyBandKey, 'small' | 'medium' | 'large'>; band: TokenEconomyBand }> = [
    { key: 'small', band: bands.small },
    { key: 'medium', band: bands.medium },
    { key: 'large', band: bands.large },
  ]

  return entries.reduce((closest, current) => {
    const closestMid = (closest.band.min + closest.band.max) / 2
    const currentMid = (current.band.min + current.band.max) / 2
    return Math.abs(price - currentMid) < Math.abs(price - closestMid) ? current : closest
  }).key
}

function createEmptyResponse(): TokenEconomyHealthResponse {
  const zeroBands = buildRecommendedBands(0)
  return {
    healthStatus: 'insufficient_data',
    baselineDailyEarn: 0,
    baselineSource: 'projected',
    score: 40,
    metrics: {
      analysisDays: ANALYSIS_DAYS,
      totalIncome: 0,
      totalSpending: 0,
      incomeToSpendingRatio: null,
      classroomTotalBalance: 0,
      averageBalance: 0,
      averageBalanceDays: null,
      activeStudentCount: 0,
      studentsWithSpending: 0,
      purchaseStudentRatio: 0,
      pendingPbsAmount: 0,
      incomeBreakdown: {
        attendance: 0,
        pbs: 0,
        bonusAndInterest: 0,
        other: 0,
      },
      shopPriceMin: null,
      shopPriceMedian: null,
      shopPriceMax: null,
      stockMedianPrice: null,
      contractRewardMedian: null,
      attendanceSalary: 0,
      weeklyBonus: 0,
    },
    recommendedBands: zeroBands,
    warnings: [
      {
        code: 'insufficient_data',
        severity: 'info',
        title: '경제 건강도를 계산할 데이터가 아직 부족합니다.',
        detail: '학생 운영 데이터와 가격 데이터가 더 쌓이면 더 정확하게 진단할 수 있습니다.',
        action: '학생 운영을 시작하고 1~2주 뒤 다시 확인하세요.',
      },
    ],
    shopLabels: [],
    stockLabels: [],
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function statusFromPenalties(
  inflationPenalty: number,
  deflationPenalty: number,
  hasInflationHigh: boolean,
  hasDeflationHigh: boolean,
  ratio: number | null
): TokenEconomyHealthStatus {
  if (inflationPenalty === 0 && deflationPenalty === 0) {
    return 'balanced'
  }

  if (inflationPenalty === deflationPenalty) {
    if (hasInflationHigh && !hasDeflationHigh) return 'inflation_high'
    if (hasDeflationHigh && !hasInflationHigh) return 'deflation_high'
    return ratio != null && ratio >= 1 ? 'inflation_medium' : 'deflation_medium'
  }

  if (inflationPenalty > deflationPenalty) {
    return hasInflationHigh ? 'inflation_high' : 'inflation_medium'
  }

  return hasDeflationHigh ? 'deflation_high' : 'deflation_medium'
}

export async function getTokenEconomyHealth(
  supabase: ServerSupabase,
  classroomId: string
): Promise<TokenEconomyHealthResponse> {
  const emptyResponse = createEmptyResponse()

  const { data: students, error: studentsError } = await supabase
    .from('pbs_students')
    .select('id')
    .eq('class_code_id', classroomId)
    .eq('is_active', true)

  if (studentsError || !students || students.length === 0) {
    return emptyResponse
  }

  const studentIds = students.map((student: StudentRow) => student.id)
  const startDate = toStartDate(ANALYSIS_DAYS)
  const startDateIso = startDate.toISOString()
  const startDateText = startDate.toISOString().slice(0, 10)

  const [
    accountsRes,
    salaryRulesRes,
    goalsRes,
    transactionsRes,
    recordsRes,
    shopItemsRes,
    stocksRes,
    contractsRes,
  ] = await Promise.all([
    supabase
      .from('pbs_accounts')
      .select('student_id, balance')
      .in('student_id', studentIds),

    supabase
      .from('pbs_salary_rules')
      .select('rule_type, amount')
      .eq('class_code_id', classroomId)
      .eq('is_active', true),

    supabase
      .from('pbs_goals')
      .select('student_id, token_per_occurrence, daily_target')
      .eq('class_code_id', classroomId)
      .eq('is_active', true),

    supabase
      .from('pbs_transactions')
      .select('student_id, type, amount, created_at')
      .in('student_id', studentIds)
      .gte('created_at', startDateIso),

    supabase
      .from('pbs_records')
      .select('student_id, record_date, token_granted, is_settled')
      .in('student_id', studentIds)
      .gte('record_date', startDateText),

    supabase
      .from('pbs_shop_items')
      .select('id, price')
      .eq('class_code_id', classroomId)
      .eq('is_active', true),

    supabase
      .from('pbs_custom_stocks')
      .select('id, current_price')
      .eq('class_code_id', classroomId)
      .eq('is_active', true),

    supabase
      .from('pbs_behavior_contracts')
      .select('reward_amount')
      .eq('class_code_id', classroomId)
      .eq('is_active', true),
  ])

  const accounts = (accountsRes.data || []) as AccountRow[]
  const salaryRules = (salaryRulesRes.data || []) as SalaryRuleRow[]
  const goals = (goalsRes.data || []) as GoalRow[]
  const transactions = (transactionsRes.data || []) as TransactionRow[]
  const records = (recordsRes.data || []) as RecordRow[]
  const shopItems = (shopItemsRes.data || []) as ShopRow[]
  const stocks = (stocksRes.data || []) as StockRow[]
  const contracts = (contractsRes.data || []) as ContractRow[]

  const attendanceSalary = salaryRules.find((rule) => rule.rule_type === 'attendance')?.amount || 0
  const weeklyBonus = salaryRules.find((rule) => rule.rule_type === 'weekly_perfect')?.amount || 0

  const balances = studentIds.map((studentId) => accounts.find((account) => account.student_id === studentId)?.balance || 0)
  const classroomTotalBalance = balances.reduce((sum, balance) => sum + balance, 0)
  const averageBalance = balances.length > 0 ? Math.round(classroomTotalBalance / balances.length) : 0

  const studentProjectedGoals = new Map<string, number>()
  goals.forEach((goal) => {
    if (goal.daily_target == null || goal.daily_target <= 0) return
    const previous = studentProjectedGoals.get(goal.student_id) || 0
    studentProjectedGoals.set(goal.student_id, previous + goal.token_per_occurrence * goal.daily_target)
  })

  const projectedGoalAverage = studentIds.length > 0
    ? Math.round(
        studentIds.reduce((sum, studentId) => sum + (studentProjectedGoals.get(studentId) || 0), 0) / studentIds.length
      )
    : 0

  const studentDayIncome = new Map<string, number>()
  const studentSpending = new Set<string>()
  let totalIncome = 0
  let totalSpending = 0
  let pendingPbsAmount = 0

  const incomeBreakdown = {
    attendance: 0,
    pbs: 0,
    bonusAndInterest: 0,
    other: 0,
  }

  transactions.forEach((transaction) => {
    const dayKey = `${transaction.student_id}:${transaction.created_at.slice(0, 10)}`

    if (INCOME_TYPES.has(transaction.type) && transaction.amount > 0) {
      const nextAmount = (studentDayIncome.get(dayKey) || 0) + transaction.amount
      studentDayIncome.set(dayKey, nextAmount)
      totalIncome += transaction.amount

      if (transaction.type === 'salary_basic') {
        incomeBreakdown.attendance += transaction.amount
      } else if (transaction.type === 'salary_pbs') {
        incomeBreakdown.pbs += transaction.amount
      } else if (transaction.type === 'salary_bonus' || transaction.type === 'interest') {
        incomeBreakdown.bonusAndInterest += transaction.amount
      } else {
        incomeBreakdown.other += transaction.amount
      }
    }

    if (SPENDING_TYPES.has(transaction.type)) {
      totalSpending += Math.abs(transaction.amount)
      studentSpending.add(transaction.student_id)
    }
  })

  records.forEach((record) => {
    if (record.is_settled || record.token_granted <= 0) return
    const dayKey = `${record.student_id}:${record.record_date}`
    studentDayIncome.set(dayKey, (studentDayIncome.get(dayKey) || 0) + record.token_granted)
    totalIncome += record.token_granted
    pendingPbsAmount += record.token_granted
    incomeBreakdown.pbs += record.token_granted
  })

  const observedStudentDays = Array.from(studentDayIncome.values()).filter((amount) => amount > 0)
  const observedBaseline = median(observedStudentDays) || 0
  const projectedBaseline = attendanceSalary + Math.round(weeklyBonus / 5) + projectedGoalAverage
  const baselineSource = observedStudentDays.length >= 5 ? 'observed' : 'projected'
  const baselineDailyEarn = baselineSource === 'observed' ? observedBaseline : projectedBaseline

  if (baselineDailyEarn <= 0) {
    return {
      ...emptyResponse,
      metrics: {
        ...emptyResponse.metrics,
        activeStudentCount: studentIds.length,
        classroomTotalBalance,
        averageBalance,
        totalIncome,
        totalSpending,
        pendingPbsAmount,
        attendanceSalary,
        weeklyBonus,
      },
    }
  }

  const recommendedBands = buildRecommendedBands(baselineDailyEarn)

  const shopPrices = shopItems.map((item) => item.price).filter((price) => price > 0)
  const stockPrices = stocks.map((stock) => stock.current_price).filter((price) => price > 0)
  const contractRewards = contracts.map((contract) => contract.reward_amount).filter((amount) => amount > 0)

  const shopPriceMin = shopPrices.length > 0 ? Math.min(...shopPrices) : null
  const shopPriceMedian = median(shopPrices)
  const shopPriceMax = shopPrices.length > 0 ? Math.max(...shopPrices) : null
  const stockMedianPrice = median(stockPrices)
  const contractRewardMedian = median(contractRewards)

  const incomeToSpendingRatio = totalSpending > 0 ? roundMetric(totalIncome / totalSpending, 2) : null
  const purchaseStudentRatio = studentIds.length > 0 ? roundMetric(studentSpending.size / studentIds.length, 2) : 0
  const averageBalanceDays = roundMetric(averageBalance / baselineDailyEarn, 1)

  const warnings: WarningDraft[] = []

  const pushWarning = (
    family: 'inflation' | 'deflation' | undefined,
    severity: WarningDraft['severity'],
    weight: number,
    code: string,
    title: string,
    detail: string,
    action: string
  ) => {
    warnings.push({ family, severity, weight, code, title, detail, action })
  }

  const smallBand = recommendedBands.small
  const stockBand = recommendedBands.stockStart

  if (shopPriceMin != null) {
    if (shopPriceMin < baselineDailyEarn * 1.5) {
      pushWarning(
        'inflation',
        'high',
        25,
        'shop_min_too_low',
        '가장 저렴한 보상이 지나치게 저렴합니다.',
        `현재 최저 가격은 ${shopPriceMin.toLocaleString('ko-KR')}원입니다.`,
        `작은 보상 가격을 ${smallBand.min.toLocaleString('ko-KR')}~${smallBand.max.toLocaleString('ko-KR')}원 범위로 올리세요.`
      )
    } else if (shopPriceMin > baselineDailyEarn * 4.0) {
      pushWarning(
        'deflation',
        'high',
        25,
        'shop_min_too_high',
        '가장 저렴한 보상이 너무 비쌉니다.',
        `현재 최저 가격은 ${shopPriceMin.toLocaleString('ko-KR')}원입니다.`,
        `작은 보상 가격을 ${smallBand.min.toLocaleString('ko-KR')}~${smallBand.max.toLocaleString('ko-KR')}원 범위로 낮추세요.`
      )
    } else if (shopPriceMin < baselineDailyEarn * 2.0) {
      pushWarning(
        'inflation',
        'medium',
        12,
        'shop_min_slightly_low',
        '작은 보상 가격이 다소 낮습니다.',
        `현재 최저 가격은 ${shopPriceMin.toLocaleString('ko-KR')}원입니다.`,
        `작은 보상 가격을 ${smallBand.min.toLocaleString('ko-KR')}원 이상으로 맞추는 것을 권장합니다.`
      )
    } else if (shopPriceMin > baselineDailyEarn * 3.2) {
      pushWarning(
        'deflation',
        'medium',
        12,
        'shop_min_slightly_high',
        '작은 보상 가격이 다소 높습니다.',
        `현재 최저 가격은 ${shopPriceMin.toLocaleString('ko-KR')}원입니다.`,
        `작은 보상 가격을 ${smallBand.max.toLocaleString('ko-KR')}원 안쪽으로 조정해 보세요.`
      )
    }
  }

  if (shopPriceMedian != null) {
    if (shopPriceMedian < baselineDailyEarn * 2.5) {
      pushWarning(
        'inflation',
        'high',
        20,
        'shop_median_too_low',
        '전체 상점 가격대가 낮아 토큰 가치가 빠르게 떨어질 수 있습니다.',
        `현재 상점 중앙값은 ${shopPriceMedian.toLocaleString('ko-KR')}원입니다.`,
        `중간 보상 가격을 ${recommendedBands.medium.min.toLocaleString('ko-KR')}~${recommendedBands.medium.max.toLocaleString('ko-KR')}원 범위로 재조정하세요.`
      )
    } else if (shopPriceMedian > baselineDailyEarn * 8.0) {
      pushWarning(
        'deflation',
        'high',
        20,
        'shop_median_too_high',
        '전체 상점 가격대가 높아 학생이 토큰을 쓰기 어렵습니다.',
        `현재 상점 중앙값은 ${shopPriceMedian.toLocaleString('ko-KR')}원입니다.`,
        `중간 보상 가격을 ${recommendedBands.medium.min.toLocaleString('ko-KR')}~${recommendedBands.medium.max.toLocaleString('ko-KR')}원 범위로 낮추세요.`
      )
    } else if (shopPriceMedian < baselineDailyEarn * 3.5) {
      pushWarning(
        'inflation',
        'medium',
        10,
        'shop_median_slightly_low',
        '상점 평균 가격이 다소 낮습니다.',
        `현재 상점 중앙값은 ${shopPriceMedian.toLocaleString('ko-KR')}원입니다.`,
        `중간 보상 가격대를 조금 높여 저축 동기를 확보하세요.`
      )
    } else if (shopPriceMedian > baselineDailyEarn * 6.5) {
      pushWarning(
        'deflation',
        'medium',
        10,
        'shop_median_slightly_high',
        '상점 평균 가격이 다소 높습니다.',
        `현재 상점 중앙값은 ${shopPriceMedian.toLocaleString('ko-KR')}원입니다.`,
        `중간 보상 가격대를 조금 낮춰 구매 경험을 늘리세요.`
      )
    }
  }

  if (incomeToSpendingRatio != null) {
    if (incomeToSpendingRatio > 2.0) {
      pushWarning(
        'inflation',
        'high',
        25,
        'income_spending_gap_high',
        '토큰 유입 속도가 소비보다 훨씬 빠릅니다.',
        `최근 ${ANALYSIS_DAYS}일 수입/소비 비율은 ${incomeToSpendingRatio}배입니다.`,
        '상점 가격을 올리거나 PBS 지급량을 조정해 유입과 소비를 다시 맞추세요.'
      )
    } else if (incomeToSpendingRatio > 1.4) {
      pushWarning(
        'inflation',
        'medium',
        12,
        'income_spending_gap_medium',
        '토큰이 소비보다 빠르게 쌓이고 있습니다.',
        `최근 ${ANALYSIS_DAYS}일 수입/소비 비율은 ${incomeToSpendingRatio}배입니다.`,
        '작은 보상 가격과 출석급여를 함께 점검하세요.'
      )
    }
  }

  if (averageBalanceDays > 15) {
    pushWarning(
      'inflation',
      'high',
      20,
      'balance_days_too_high',
      '학생 평균 잔액이 너무 크게 누적되고 있습니다.',
      `학생당 평균 잔액은 약 ${averageBalanceDays}일치 소득에 해당합니다.`,
      '상점 가격을 올리거나 보상 구간을 다시 설계해 잔액 누적 속도를 낮추세요.'
    )
  } else if (averageBalanceDays > 10) {
    pushWarning(
      'inflation',
      'medium',
      10,
      'balance_days_slightly_high',
      '학생 평균 잔액이 다소 높게 쌓이고 있습니다.',
      `학생당 평균 잔액은 약 ${averageBalanceDays}일치 소득에 해당합니다.`,
      '작은 보상과 중간 보상 가격을 다시 점검하세요.'
    )
  }

  if (stockMedianPrice != null) {
    if (stockMedianPrice > baselineDailyEarn * 10.0) {
      pushWarning(
        'deflation',
        'high',
        18,
        'stock_median_too_high',
        '주식 가격이 학급 경제 규모 대비 너무 높습니다.',
        `현재 주식 중앙 가격은 ${stockMedianPrice.toLocaleString('ko-KR')}원입니다.`,
        `커스텀 주식 초기 가격을 ${stockBand.min.toLocaleString('ko-KR')}~${stockBand.max.toLocaleString('ko-KR')}원 범위로 낮추세요.`
      )
    } else if (stockMedianPrice > baselineDailyEarn * 8.0) {
      pushWarning(
        'deflation',
        'medium',
        10,
        'stock_median_slightly_high',
        '주식 가격이 다소 높습니다.',
        `현재 주식 중앙 가격은 ${stockMedianPrice.toLocaleString('ko-KR')}원입니다.`,
        `신규 종목은 ${stockBand.min.toLocaleString('ko-KR')}~${stockBand.max.toLocaleString('ko-KR')}원 범위로 맞추는 것을 권장합니다.`
      )
    }
  }

  const veryLowSpending = totalSpending < baselineDailyEarn * studentIds.length
  const lowSpending = totalSpending < baselineDailyEarn * studentIds.length * 2

  if (purchaseStudentRatio < 0.2 && veryLowSpending) {
    pushWarning(
      'deflation',
      'high',
      25,
      'purchase_participation_low',
      '토큰을 실제로 쓰는 학생 비율이 매우 낮습니다.',
      `최근 ${ANALYSIS_DAYS}일 동안 소비 경험이 있는 학생 비율은 ${Math.round(purchaseStudentRatio * 100)}%입니다.`,
      '작은 보상 가격을 낮추고 학생이 바로 살 수 있는 보상을 먼저 늘리세요.'
    )
  } else if (purchaseStudentRatio < 0.35 && lowSpending) {
    pushWarning(
      'deflation',
      'medium',
      12,
      'purchase_participation_slightly_low',
      '토큰 사용 경험이 충분하지 않습니다.',
      `최근 ${ANALYSIS_DAYS}일 동안 소비 경험이 있는 학생 비율은 ${Math.round(purchaseStudentRatio * 100)}%입니다.`,
      '작은 보상 가격을 조정하거나 자주 살 수 있는 보상을 한두 개 추가하세요.'
    )
  }

  if (attendanceSalary > baselineDailyEarn * 0.6) {
    pushWarning(
      undefined,
      'medium',
      8,
      'attendance_salary_heavy',
      '출석 기본급 비중이 큽니다.',
      `현재 출석 기본급은 일일 기준 소득의 약 ${Math.round((attendanceSalary / baselineDailyEarn) * 100)}%입니다.`,
      '출석 기본급 또는 상점 가격을 재조정해 경제가 기본급에만 의존하지 않게 하세요.'
    )
  }

  if (weeklyBonus / 5 > baselineDailyEarn * 0.4) {
    pushWarning(
      undefined,
      'medium',
      8,
      'weekly_bonus_heavy',
      '주간 보너스 규모가 큽니다.',
      `현재 주간 보너스를 일평균으로 나누면 약 ${Math.round(weeklyBonus / 5)}원입니다.`,
      '주간 보너스를 낮추거나 중간/큰 보상 가격을 함께 조정하세요.'
    )
  }

  if (observedStudentDays.length < 5) {
    pushWarning(
      undefined,
      'info',
      0,
      'projected_baseline',
      '실측 데이터가 부족해 예측 기준으로 계산했습니다.',
      `최근 ${ANALYSIS_DAYS}일 유효 학생-일 데이터는 ${observedStudentDays.length}건입니다.`,
      '운영 데이터를 조금 더 쌓으면 더 정확한 건강도 진단이 가능합니다.'
    )
  }

  const inflationPenalty = warnings
    .filter((warning) => warning.family === 'inflation')
    .reduce((sum, warning) => sum + warning.weight, 0)

  const deflationPenalty = warnings
    .filter((warning) => warning.family === 'deflation')
    .reduce((sum, warning) => sum + warning.weight, 0)

  const healthStatus = statusFromPenalties(
    inflationPenalty,
    deflationPenalty,
    warnings.some((warning) => warning.family === 'inflation' && warning.severity === 'high'),
    warnings.some((warning) => warning.family === 'deflation' && warning.severity === 'high'),
    incomeToSpendingRatio
  )

  const score = clampScore(100 - warnings.reduce((sum, warning) => sum + warning.weight, 0))

  const shopLabels: TokenEconomyShopLabel[] = shopItems.map((item) => {
    const suggestedBand = closestShopBand(item.price, recommendedBands)
    const band = recommendedBands[suggestedBand]
    return {
      itemId: item.id,
      label: item.price < recommendedBands.small.min
        ? 'too_low'
        : item.price > recommendedBands.large.max
          ? 'too_high'
          : 'good',
      suggestedBand,
      recommendedMin: band.min,
      recommendedMax: band.max,
    }
  })

  const stockLabels: TokenEconomyStockLabel[] = stocks.map((stock) => ({
    stockId: stock.id,
    label: classifyPrice(stock.current_price, recommendedBands.stockStart),
    recommendedMin: recommendedBands.stockStart.min,
    recommendedMax: recommendedBands.stockStart.max,
  }))

  const sortedWarnings = warnings
    .sort((left, right) => {
      const severityRank = { high: 3, medium: 2, info: 1 }
      if (severityRank[left.severity] !== severityRank[right.severity]) {
        return severityRank[right.severity] - severityRank[left.severity]
      }
      return right.weight - left.weight
    })
    .map(({ family: _family, weight: _weight, ...warning }) => warning)

  return {
    healthStatus,
    baselineDailyEarn,
    baselineSource,
    score,
    metrics: {
      analysisDays: ANALYSIS_DAYS,
      totalIncome,
      totalSpending,
      incomeToSpendingRatio,
      classroomTotalBalance,
      averageBalance,
      averageBalanceDays,
      activeStudentCount: studentIds.length,
      studentsWithSpending: studentSpending.size,
      purchaseStudentRatio,
      pendingPbsAmount,
      incomeBreakdown,
      shopPriceMin,
      shopPriceMedian,
      shopPriceMax,
      stockMedianPrice,
      contractRewardMedian,
      attendanceSalary,
      weeklyBonus,
    },
    recommendedBands,
    warnings: sortedWarnings,
    shopLabels,
    stockLabels,
  }
}
