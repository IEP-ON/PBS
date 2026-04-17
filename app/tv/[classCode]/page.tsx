'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import type { PublicCue, TvSettings } from '@/types'

interface StudentRanking {
  id: string
  name: string
  pbs_stage: number
  balance: number
  todayEarned: number
  rank: number
  publicCue: Pick<PublicCue, 'todayGoal' | 'encouragementTone'> | null
}

interface ShopItem {
  id: string
  name: string
  category: string
  price: number
  stock: number | null
  emoji: string
}

interface StockSnapshot {
  id: string
  name: string
  emoji: string
  current_price: number
  description: string | null
  previous_price: number | null
  price_date: string | null
  adjustment_type: string | null
}

type SortMode = 'balance' | 'today'
const DEFAULT_TV_SETTINGS: TvSettings = {
  anonymizeName: false,
  showTicker: true,
}

const MEDAL = ['🥇', '🥈', '🥉']

function getShopBadge(stock: number | null) {
  if (stock == null) return { label: '무제한', className: 'bg-emerald-400/15 text-emerald-300' }
  if (stock <= 0) return { label: '품절', className: 'bg-rose-400/15 text-rose-300' }
  return { label: `${stock}개`, className: 'bg-sky-400/15 text-sky-300' }
}

function getStockChange(stock: StockSnapshot) {
  if (stock.previous_price == null) return null
  const change = stock.current_price - stock.previous_price
  const percent = stock.previous_price > 0 ? (change / stock.previous_price) * 100 : 0
  return { change, percent }
}

function maskStudentName(name: string) {
  if (!name) return ''
  if (name.length <= 1) return '○'
  return `${name[0]}${'○'.repeat(name.length - 1)}`
}

function getTickerToneClass(tone?: PublicCue['encouragementTone']) {
  if (tone === 'focus') return 'text-amber-200'
  if (tone === 'calm') return 'text-sky-200'
  return 'text-emerald-200'
}

export default function TvModePage() {
  const params = useParams()
  const classCode = params.classCode as string

  const [rankings, setRankings] = useState<StudentRanking[]>([])
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [stocks, setStocks] = useState<StockSnapshot[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('today')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [className, setClassName] = useState('')
  const [tvSettings, setTvSettings] = useState<TvSettings>(DEFAULT_TV_SETTINGS)
  const [tickerIndex, setTickerIndex] = useState(0)

  const loadRankings = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/rankings')
      if (!res.ok) return
      const data = await res.json()
      setRankings(data.rankings || [])
      setShopItems(data.shopItems || [])
      setStocks(data.stocks || [])
      setClassName(data.className || '')
      setTvSettings(data.tvSettings || DEFAULT_TV_SETTINGS)
      setLastUpdated(new Date())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRankings()
    const interval = setInterval(loadRankings, 30000)
    return () => clearInterval(interval)
  }, [loadRankings])

  const sorted = [...rankings].sort((a, b) =>
    sortMode === 'today' ? b.todayEarned - a.todayEarned : b.balance - a.balance
  )

  const top = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const visibleShopItems = shopItems.slice(0, 6)
  const visibleStocks = stocks.slice(0, 6)
  const tickerItems = sorted.filter((student) => student.publicCue?.todayGoal)
  const currentTicker = tickerItems.length > 0 ? tickerItems[tickerIndex % tickerItems.length] : null

  useEffect(() => {
    if (!tvSettings.showTicker || tickerItems.length <= 1) return

    const interval = window.setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length)
    }, 10000)

    return () => window.clearInterval(interval)
  }, [tickerItems.length, tvSettings.showTicker])

  useEffect(() => {
    setTickerIndex(0)
  }, [tvSettings.showTicker, rankings.length])

  const displayName = useCallback((name: string) => {
    return tvSettings.anonymizeName ? maskStudentName(name) : name
  }, [tvSettings.anonymizeName])

  if (loading) {
    return (
      <div
        className="h-[100dvh] flex items-center justify-center bg-[#070c18] text-white"
        style={{
          paddingLeft: 'max(0px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0px, env(safe-area-inset-right, 0px))',
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex items-center gap-4 md:gap-5">
          <span className="relative flex h-3 w-3 md:h-4 md:w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 md:h-4 md:w-4 bg-blue-400" />
          </span>
          <p className="text-white/50 text-base md:text-xl font-bold tracking-[0.35em] uppercase">Loading</p>
        </div>
      </div>
    )
  }

  // Podium display order: 2nd · 1st · 3rd
  const podiumOrder = [top[1], top[0], top[2]]
  const podiumOrigIdx = [1, 0, 2]
  const podiumHeights = ['75%', '100%', '62%']
  const podiumStyles = [
    'border-slate-500/25 bg-gradient-to-b from-slate-500/20 to-slate-600/10',
    'border-amber-400/35 bg-gradient-to-b from-amber-400/15 to-amber-600/5',
    'border-orange-500/25 bg-gradient-to-b from-orange-500/15 to-orange-700/5',
  ]

  return (
    <div
      className="h-[100dvh] overflow-hidden flex flex-col bg-[#070c18] text-white select-none"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 30% 0%, rgba(29,78,216,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(6,182,212,0.06) 0%, transparent 60%), #070c18',
        paddingLeft: 'max(0px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0px, env(safe-area-inset-right, 0px))',
        paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
      }}
    >

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between gap-2 border-b border-white/[0.06] px-2 py-1.5 min-[480px]:px-3 md:px-4 md:py-2 min-h-[3rem] md:min-h-[3.75rem]">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className="relative flex h-2 w-2 shrink-0 md:h-2.5 md:w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-emerald-400" />
          </span>
          <span className="shrink-0 text-[10px] md:text-xs font-bold tracking-[0.35em] uppercase text-white/30">LIVE</span>
          <div className="hidden h-4 w-px shrink-0 bg-white/10 min-[400px]:block" />
          <h1 className="min-w-0 truncate text-base font-black text-white/95 min-[480px]:text-lg md:text-2xl">
            {className || classCode}
          </h1>
          <span className="hidden text-[11px] text-white/30 min-[900px]:inline md:text-sm">
            학생 {rankings.length}명 · 가게 {shopItems.length}개 · 주식 {stocks.length}종목
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 min-[480px]:gap-2 md:gap-3">
          <div className="flex overflow-hidden rounded-lg border border-white/[0.08] md:rounded-xl">
            <button
              type="button"
              onClick={() => setSortMode('today')}
              className={`min-h-11 min-w-[5.5rem] px-3 py-2 text-xs font-black transition-colors min-[480px]:px-4 min-[480px]:text-sm md:min-h-12 md:px-6 md:text-base ${
                sortMode === 'today'
                  ? 'bg-amber-400 text-black'
                  : 'text-white/45 hover:text-white/90 hover:bg-white/[0.06]'
              }`}
            >
              오늘 획득
            </button>
            <button
              type="button"
              onClick={() => setSortMode('balance')}
              className={`min-h-11 min-w-[5.5rem] border-l border-white/[0.08] px-3 py-2 text-xs font-black transition-colors min-[480px]:px-4 min-[480px]:text-sm md:min-h-12 md:px-6 md:text-base ${
                sortMode === 'balance'
                  ? 'bg-amber-400 text-black'
                  : 'text-white/45 hover:text-white/90 hover:bg-white/[0.06]'
              }`}
            >
              전체 잔액
            </button>
          </div>
          <button
            type="button"
            onClick={loadRankings}
            className="flex size-11 items-center justify-center text-white/35 transition-colors hover:text-white/80 md:size-12 md:text-2xl"
            title="새로고침"
          >
            ↻
          </button>
          <span className="hidden text-[11px] text-white/25 tabular-nums font-mono min-[640px]:inline md:text-sm">
            {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">

        {/* Rankings */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col gap-0 px-1 pt-1 pb-0 min-[480px]:px-2 md:px-3 md:pt-2">
          {rankings.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-2">
              <div className="text-center">
                <p className="mb-3 text-6xl md:mb-5 md:text-8xl">🏫</p>
                <p className="text-xl font-bold text-white/75 md:text-3xl">등록된 학생이 없습니다</p>
                <p className="mt-2 text-base text-white/35 md:mt-3 md:text-xl">학생을 등록하면 순위가 여기에 표시됩니다</p>
              </div>
            </div>
          ) : (
            <>
              {/* TOP 3 Podium */}
              {top.length > 0 && (
                <div className="flex min-h-0 flex-[1.08] basis-0 items-end justify-stretch gap-1 pb-1 min-[480px]:gap-2 min-[480px]:pb-1.5 md:gap-3 md:pb-2">
                  {podiumOrder.map((student, i) => {
                    if (!student) return <div key={i} className="min-w-0 flex-1" />
                    const origIdx = podiumOrigIdx[i]
                    const isFirst = origIdx === 0
                    const value = sortMode === 'today' ? student.todayEarned : student.balance

                    return (
                      <div
                        key={student.id}
                        className={`flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-xl border px-2 py-2 backdrop-blur-sm min-[480px]:gap-1.5 min-[480px]:rounded-2xl min-[480px]:px-3 min-[480px]:py-3 md:gap-2 md:px-5 md:py-4 md:rounded-3xl ${podiumStyles[i]}`}
                        style={{ height: podiumHeights[i] }}
                      >
                        <span
                          className={`leading-none ${isFirst ? 'text-5xl min-[480px]:text-6xl md:text-7xl' : 'text-4xl min-[480px]:text-5xl md:text-6xl'}`}
                        >
                          {MEDAL[origIdx]}
                        </span>
                        <p
                          className={`text-center font-black leading-snug tracking-tight ${isFirst ? 'text-lg text-amber-100 min-[480px]:text-2xl md:text-3xl' : 'text-base text-white/85 min-[480px]:text-xl md:text-2xl'}`}
                        >
                          {displayName(student.name)}
                        </p>
                        <p className="text-[11px] font-semibold text-white/35 min-[480px]:text-xs md:text-sm">
                          LV.{student.pbs_stage}
                        </p>
                        <p
                          className={`font-black tabular-nums ${isFirst ? 'text-xl text-amber-300 min-[480px]:text-3xl md:text-4xl' : 'text-lg text-white/75 min-[480px]:text-2xl md:text-3xl'}`}
                        >
                          {sortMode === 'today' && value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)}
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.22em] text-white/25 min-[480px]:text-[10px] md:text-xs">
                          {sortMode === 'today' ? 'Today' : 'Balance'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Divider */}
              {top.length > 0 && rest.length > 0 && (
                <div className="mb-1 flex shrink-0 items-center gap-2 py-0.5 md:mb-1.5">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/25 md:text-xs">
                    이하 순위
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
              )}

              {/* Rest grid */}
              {rest.length > 0 && (
                <div className="grid min-h-0 flex-1 basis-0 auto-rows-fr grid-cols-2 gap-1 overflow-hidden min-[900px]:grid-cols-3 min-[900px]:gap-1.5 md:gap-2">
                  {rest.map((student, idx) => {
                    const value = sortMode === 'today' ? student.todayEarned : student.balance
                    return (
                      <div
                        key={student.id}
                        className="flex min-h-[3.25rem] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2 min-[480px]:gap-3 min-[480px]:rounded-xl min-[480px]:px-3 min-[480px]:py-2.5 md:min-h-[4.25rem] md:gap-4 md:px-4 md:py-3"
                      >
                        <span className="w-7 shrink-0 text-right text-sm font-black tabular-nums text-white/25 min-[480px]:w-9 min-[480px]:text-base md:w-11 md:text-xl">
                          {idx + 4}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold leading-tight text-white/90 min-[480px]:text-base md:text-lg">
                            {displayName(student.name)}
                          </p>
                          <p className="text-[10px] font-semibold text-white/35 min-[480px]:text-xs md:text-sm">
                            LV.{student.pbs_stage}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black tabular-nums text-white/80 min-[480px]:text-base md:text-lg">
                          {sortMode === 'today' && value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </main>

        {/* Shop + Stock */}
        <aside className="flex w-[clamp(15.5rem,28vw,27rem)] shrink-0 flex-col divide-y divide-white/[0.06] border-l border-white/[0.06] min-[480px]:w-[clamp(16.5rem,30vw,28rem)] md:w-[clamp(17.5rem,32vw,30rem)]">
          {/* Shop Board */}
          <section className="flex min-h-0 flex-1 flex-col px-2 py-2 min-[480px]:px-3 min-[480px]:py-2.5 md:px-4 md:py-3">
            <div className="mb-1.5 flex shrink-0 items-center justify-between min-[480px]:mb-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25 md:text-[10px]">
                  Shop Board
                </p>
                <h2 className="mt-0.5 text-base font-black text-white/85 md:text-xl">🏪 가게</h2>
              </div>
              <span className="text-[10px] font-semibold text-white/30 md:text-xs">{shopItems.length}개 운영</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden min-[480px]:gap-1.5 md:gap-2">
              {visibleShopItems.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-white/30 md:text-base">아이템 없음</p>
                </div>
              ) : (
                visibleShopItems.map((item) => {
                  const badge = getShopBadge(item.stock)
                  return (
                    <div
                      key={item.id}
                      className="flex min-h-[3rem] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.035] px-2 py-1.5 min-[480px]:min-h-[3.35rem] min-[480px]:gap-2.5 min-[480px]:rounded-xl min-[480px]:px-3 min-[480px]:py-2 md:min-h-[3.75rem] md:gap-3 md:px-3.5 md:py-2.5"
                    >
                      <span className="shrink-0 text-xl leading-none min-[480px]:text-2xl md:text-3xl">
                        {item.emoji || '🎁'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold leading-tight text-white/90 md:text-base">
                          {item.name}
                        </p>
                        <p className="text-[11px] tabular-nums text-white/40 min-[480px]:text-xs md:text-sm">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold min-[480px]:px-2.5 min-[480px]:py-1 min-[480px]:text-[10px] md:text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  )
                })
              )}
              {shopItems.length > visibleShopItems.length && (
                <p className="pt-0.5 text-right text-[10px] text-white/25 md:text-xs">
                  +{shopItems.length - visibleShopItems.length}개 더
                </p>
              )}
            </div>
          </section>

          {/* Stock Board */}
          <section className="flex min-h-0 flex-1 flex-col px-2 py-2 min-[480px]:px-3 min-[480px]:py-2.5 md:px-4 md:py-3">
            <div className="mb-1.5 flex shrink-0 items-center justify-between min-[480px]:mb-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25 md:text-[10px]">
                  Stock Board
                </p>
                <h2 className="mt-0.5 text-base font-black text-white/85 md:text-xl">📈 주식</h2>
              </div>
              <span className="text-[10px] font-semibold text-white/30 md:text-xs">{stocks.length}종목 운영</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden min-[480px]:gap-1.5 md:gap-2">
              {visibleStocks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-white/30 md:text-base">종목 없음</p>
                </div>
              ) : (
                visibleStocks.map((stock) => {
                  const delta = getStockChange(stock)
                  const isRise = (delta?.change || 0) > 0
                  const isFall = (delta?.change || 0) < 0
                  return (
                    <div
                      key={stock.id}
                      className="flex min-h-[3rem] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.035] px-2 py-1.5 min-[480px]:min-h-[3.35rem] min-[480px]:gap-2.5 min-[480px]:rounded-xl min-[480px]:px-3 min-[480px]:py-2 md:min-h-[3.75rem] md:gap-3 md:px-3.5 md:py-2.5"
                    >
                      <span className="shrink-0 text-xl leading-none min-[480px]:text-2xl md:text-3xl">
                        {stock.emoji || '🎲'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold leading-tight text-white/90 md:text-base">
                          {stock.name}
                        </p>
                        {delta ? (
                          <p
                            className={`text-[11px] font-bold min-[480px]:text-xs md:text-sm ${isRise ? 'text-rose-400' : isFall ? 'text-sky-400' : 'text-white/30'}`}
                          >
                            {isRise ? '▲' : isFall ? '▼' : '■'} {Math.abs(delta.percent).toFixed(1)}%
                          </p>
                        ) : (
                          <p className="text-[11px] text-white/30 min-[480px]:text-xs">첫 시세</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-black tabular-nums text-white/85 md:text-base">
                        {formatCurrency(stock.current_price)}
                      </p>
                    </div>
                  )
                })
              )}
              {stocks.length > visibleStocks.length && (
                <p className="pt-0.5 text-right text-[10px] text-white/25 md:text-xs">
                  +{stocks.length - visibleStocks.length}종목 더
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {tvSettings.showTicker && currentTicker?.publicCue?.todayGoal && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-2 py-2 min-[480px]:gap-3 min-[480px]:px-3 min-[480px]:py-2.5 md:gap-4 md:px-4 md:py-3.5">
          <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/60 min-[480px]:px-3 min-[480px]:py-1.5 min-[480px]:text-[10px] md:text-xs">
            Today Goal
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90 min-[480px]:text-base md:text-lg">
            <span className="text-white">{displayName(currentTicker.name)}</span>
            <span className="mx-1.5 text-white/30 min-[480px]:mx-2">·</span>
            <span className={getTickerToneClass(currentTicker.publicCue.encouragementTone)}>
              {currentTicker.publicCue.todayGoal}
            </span>
          </p>
          <span className="shrink-0 text-[10px] text-white/30 tabular-nums md:text-xs">
            {tickerItems.length > 1 ? `${tickerIndex + 1}/${tickerItems.length}` : '1/1'}
          </span>
        </footer>
      )}
    </div>
  )
}
