'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import type {
  TokenEconomyBand,
  TokenEconomyHealthResponse,
  TokenEconomyHealthStatus,
  TokenEconomyPriceLabel,
  TokenEconomyWarning,
} from '@/types'

const STATUS_META: Record<TokenEconomyHealthStatus, { label: string; badge: string; panel: string }> = {
  balanced: {
    label: '안정',
    badge: 'bg-emerald-100 text-emerald-700',
    panel: 'border-emerald-200 bg-emerald-50',
  },
  inflation_medium: {
    label: '인플레이션 주의',
    badge: 'bg-amber-100 text-amber-700',
    panel: 'border-amber-200 bg-amber-50',
  },
  inflation_high: {
    label: '인플레이션 높음',
    badge: 'bg-rose-100 text-rose-700',
    panel: 'border-rose-200 bg-rose-50',
  },
  deflation_medium: {
    label: '디플레이션 주의',
    badge: 'bg-sky-100 text-sky-700',
    panel: 'border-sky-200 bg-sky-50',
  },
  deflation_high: {
    label: '디플레이션 높음',
    badge: 'bg-indigo-100 text-indigo-700',
    panel: 'border-indigo-200 bg-indigo-50',
  },
  insufficient_data: {
    label: '데이터 부족',
    badge: 'bg-gray-100 text-gray-700',
    panel: 'border-gray-200 bg-gray-50',
  },
}

const PRICE_LABEL_META: Record<TokenEconomyPriceLabel, { label: string; className: string }> = {
  too_low: {
    label: '너무 쌈',
    className: 'bg-rose-100 text-rose-700',
  },
  good: {
    label: '적정',
    className: 'bg-emerald-100 text-emerald-700',
  },
  too_high: {
    label: '너무 비쌈',
    className: 'bg-indigo-100 text-indigo-700',
  },
}

function RangeChip({ title, band }: { title: string; band: TokenEconomyBand }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">
        {formatCurrency(band.min)} ~ {formatCurrency(band.max)}
      </p>
    </div>
  )
}

function WarningLine({ warning }: { warning: TokenEconomyWarning }) {
  const tone = warning.severity === 'high'
    ? 'border-rose-200 bg-white text-rose-700'
    : warning.severity === 'medium'
      ? 'border-amber-200 bg-white text-amber-700'
      : 'border-slate-200 bg-white text-slate-600'

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-sm font-semibold">{warning.title}</p>
      <p className="mt-1 text-xs leading-5">{warning.action}</p>
    </div>
  )
}

export function useTokenEconomyHealth() {
  const [data, setData] = useState<TokenEconomyHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await fetch('/api/token-economy/health')
        const json = await res.json()

        if (!active) return

        if (!res.ok) {
          setError(json.error || '경제 건강도 진단을 불러오지 못했습니다.')
          setLoading(false)
          return
        }

        setData(json)
      } catch {
        if (!active) return
        setError('경제 건강도 진단을 불러오지 못했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return { data, loading, error }
}

export function EconomyHealthSummaryCard({
  data,
  loading,
  error,
}: {
  data: TokenEconomyHealthResponse | null
  loading: boolean
  error: string
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-36 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        경제 건강도 진단을 아직 불러오지 못했습니다.
      </div>
    )
  }

  const status = STATUS_META[data.healthStatus]
  const ratioText = data.metrics.incomeToSpendingRatio == null
    ? '소비 데이터 부족'
    : `${data.metrics.incomeToSpendingRatio}배`
  const visibleWarnings = data.warnings.slice(0, 3)

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${status.panel}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">경제 건강도 진단</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.badge}`}>{status.label}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            최근 {data.metrics.analysisDays}일 운영 데이터를 기준으로, 작은 보상이 평균 2~3일에 1회 가능하도록 분석했습니다.
          </p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-right">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Score</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{data.score}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">일일 기준 소득</p>
          <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(data.baselineDailyEarn)}</p>
          <p className="mt-1 text-xs text-slate-500">{data.baselineSource === 'observed' ? '실측 기준' : '예측 기준'}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">수입 / 소비</p>
          <p className="mt-2 text-xl font-black text-slate-900">{ratioText}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatCurrency(data.metrics.totalIncome)} / {formatCurrency(data.metrics.totalSpending)}
          </p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">학생당 평균 잔액</p>
          <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(data.metrics.averageBalance)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {data.metrics.averageBalanceDays == null ? '기준 없음' : `약 ${data.metrics.averageBalanceDays}일치`}
          </p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">상점 중앙 가격</p>
          <p className="mt-2 text-xl font-black text-slate-900">
            {data.metrics.shopPriceMedian == null ? '미설정' : formatCurrency(data.metrics.shopPriceMedian)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            구매 학생 비율 {Math.round(data.metrics.purchaseStudentRatio * 100)}%
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <RangeChip title="Small Reward" band={data.recommendedBands.small} />
        <RangeChip title="Medium Reward" band={data.recommendedBands.medium} />
        <RangeChip title="Large Reward" band={data.recommendedBands.large} />
        <RangeChip title="Stock Start" band={data.recommendedBands.stockStart} />
      </div>

      <div className="mt-4 grid gap-3">
        {visibleWarnings.length > 0 ? (
          visibleWarnings.map((warning) => (
            <WarningLine key={warning.code} warning={warning} />
          ))
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700">
            현재 기준에서는 토큰 유입과 소비가 크게 무너지지 않았습니다.
          </div>
        )}
      </div>
    </section>
  )
}

export function EconomyRangeBanner({
  data,
  loading,
  error,
  mode,
}: {
  data: TokenEconomyHealthResponse | null
  loading: boolean
  error: string
  mode: 'shop' | 'stock'
}) {
  if (loading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        경제 건강도 진단을 불러오지 못해 권장 가격 범위를 표시하지 못했습니다.
      </div>
    )
  }

  const status = STATUS_META[data.healthStatus]

  if (data.healthStatus === 'insufficient_data') {
    return (
      <div className={`rounded-2xl border p-4 ${status.panel}`}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900">
            {mode === 'shop' ? '가게 가격 가이드' : '주식 가격 가이드'}
          </p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.badge}`}>{status.label}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          학생 운영 데이터가 조금 더 쌓이면 권장 가격 범위를 더 정확하게 보여드릴 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-4 ${status.panel}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">
              {mode === 'shop' ? '가게 가격 가이드' : '주식 가격 가이드'}
            </p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.badge}`}>{status.label}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            기준 일일 소득 {formatCurrency(data.baselineDailyEarn)} · {data.baselineSource === 'observed' ? '실측 기준' : '예측 기준'}
          </p>
        </div>
      </div>

      {mode === 'shop' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <RangeChip title="작은 보상" band={data.recommendedBands.small} />
          <RangeChip title="중간 보상" band={data.recommendedBands.medium} />
          <RangeChip title="큰 보상" band={data.recommendedBands.large} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <RangeChip title="권장 초기 주가" band={data.recommendedBands.stockStart} />
          <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">현재 중앙 가격</p>
            <p className="mt-2 text-sm font-bold text-slate-900">
              {data.metrics.stockMedianPrice == null ? '종목 없음' : formatCurrency(data.metrics.stockMedianPrice)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function EconomyPriceBadge({ label }: { label: TokenEconomyPriceLabel }) {
  const meta = PRICE_LABEL_META[label]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.className}`}>{meta.label}</span>
}

export function EconomyConfigNotice({
  data,
  loading,
  error,
}: {
  data: TokenEconomyHealthResponse | null
  loading: boolean
  error: string
}) {
  if (loading) {
    return <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
  }

  if (error || !data) {
    return null
  }

  if (data.healthStatus === 'insufficient_data') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        급여 설정 경고는 운영 데이터가 조금 더 쌓인 뒤 정확하게 안내됩니다.
      </div>
    )
  }

  const configWarnings = data.warnings.filter(
    (warning) => warning.code === 'attendance_salary_heavy' || warning.code === 'weekly_bonus_heavy'
  )

  if (configWarnings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        현재 급여 설정은 경제 건강도 기준에서 크게 벗어나지 않습니다.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">급여 설정 점검</p>
      <div className="mt-3 space-y-2">
        {configWarnings.map((warning) => (
          <WarningLine key={warning.code} warning={warning} />
        ))}
      </div>
    </div>
  )
}
