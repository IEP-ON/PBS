'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface StudentRanking {
  id: string
  name: string
  pbs_stage: number
  balance: number
  todayEarned: number
  rank: number
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

  const loadRankings = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/rankings')
      if (!res.ok) return
      const data = await res.json()
      setRankings(data.rankings || [])
      setShopItems(data.shopItems || [])
      setStocks(data.stocks || [])
      setClassName(data.className || '')
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

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-[#070c18]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
          </span>
          <p className="text-white/50 text-sm font-semibold tracking-widest uppercase">Loading</p>
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
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[#070c18] text-white select-none"
      style={{ background: 'radial-gradient(ellipse 80% 50% at 30% 0%, rgba(29,78,216,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(6,182,212,0.06) 0%, transparent 60%), #070c18' }}>

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between px-5 border-b border-white/[0.05]" style={{ height: '52px' }}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[9px] font-bold tracking-[0.35em] uppercase text-white/25">LIVE</span>
          <div className="h-3 w-px bg-white/10" />
          <h1 className="text-sm font-black text-white/90">{className || classCode}</h1>
          <span className="text-[11px] text-white/25">
            학생 {rankings.length}명 · 가게 {shopItems.length}개 · 주식 {stocks.length}종목
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-white/[0.07]">
            <button
              onClick={() => setSortMode('today')}
              className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                sortMode === 'today'
                  ? 'bg-amber-400 text-black'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
              }`}
            >
              오늘 획득
            </button>
            <button
              onClick={() => setSortMode('balance')}
              className={`px-4 py-1.5 text-xs font-bold border-l border-white/[0.07] transition-colors ${
                sortMode === 'balance'
                  ? 'bg-amber-400 text-black'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
              }`}
            >
              전체 잔액
            </button>
          </div>
          <button
            onClick={loadRankings}
            className="text-white/25 hover:text-white/60 transition-colors text-base leading-none"
            title="새로고침"
          >
            ↻
          </button>
          <span className="text-[11px] text-white/20 tabular-nums font-mono">
            {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex">

        {/* Rankings */}
        <main className="flex-1 min-w-0 flex flex-col gap-0 p-4">
          {rankings.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl mb-4">🏫</p>
                <p className="text-lg font-bold text-white/70">등록된 학생이 없습니다</p>
                <p className="text-sm text-white/30 mt-1">학생을 등록하면 순위가 여기에 표시됩니다</p>
              </div>
            </div>
          ) : (
            <>
              {/* TOP 3 Podium */}
              {top.length > 0 && (
                <div className="shrink-0 flex items-end justify-center gap-3 pb-3" style={{ height: '42%' }}>
                  {podiumOrder.map((student, i) => {
                    if (!student) return <div key={i} className="flex-1 max-w-[240px]" />
                    const origIdx = podiumOrigIdx[i]
                    const isFirst = origIdx === 0
                    const value = sortMode === 'today' ? student.todayEarned : student.balance

                    return (
                      <div
                        key={student.id}
                        className={`flex-1 max-w-[240px] flex flex-col items-center justify-center gap-1.5 rounded-2xl border backdrop-blur-sm px-4 transition-all ${podiumStyles[i]}`}
                        style={{ height: podiumHeights[i] }}
                      >
                        <span className={`leading-none ${isFirst ? 'text-5xl' : 'text-4xl'}`}>
                          {MEDAL[origIdx]}
                        </span>
                        <p className={`font-black text-center leading-snug tracking-tight ${isFirst ? 'text-[1.4rem] text-amber-100' : 'text-xl text-white/85'}`}>
                          {student.name}
                        </p>
                        <p className="text-[11px] text-white/30 font-semibold">LV.{student.pbs_stage}</p>
                        <p className={`font-black tabular-nums ${isFirst ? 'text-2xl text-amber-300' : 'text-xl text-white/75'}`}>
                          {sortMode === 'today' && value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)}
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.22em] text-white/25">
                          {sortMode === 'today' ? 'Today' : 'Balance'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Divider */}
              {top.length > 0 && rest.length > 0 && (
                <div className="shrink-0 flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[9px] text-white/20 uppercase tracking-[0.25em]">이하 순위</span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>
              )}

              {/* Rest grid */}
              {rest.length > 0 && (
                <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-2 gap-1.5 content-start">
                  {rest.map((student, idx) => {
                    const value = sortMode === 'today' ? student.todayEarned : student.balance
                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] px-4 py-2.5"
                      >
                        <span className="w-6 text-sm font-black text-white/20 tabular-nums shrink-0 text-right">
                          {idx + 4}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white/85 text-sm truncate leading-tight">{student.name}</p>
                          <p className="text-[10px] text-white/30 font-semibold">LV.{student.pbs_stage}</p>
                        </div>
                        <p className="text-sm font-black text-white/75 tabular-nums shrink-0">
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

        {/* Sidebar divider */}
        <div className="shrink-0 w-px bg-white/[0.04]" />

        {/* Shop + Stock */}
        <aside className="shrink-0 w-72 flex flex-col divide-y divide-white/[0.04]">

          {/* Shop Board */}
          <section className="flex-1 min-h-0 flex flex-col px-4 py-3">
            <div className="shrink-0 flex items-center justify-between mb-2.5">
              <div>
                <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/20">Shop Board</p>
                <h2 className="text-sm font-black text-white/80 mt-0.5">🏪 가게</h2>
              </div>
              <span className="text-[10px] font-semibold text-white/25">{shopItems.length}개 운영</span>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-1.5">
              {visibleShopItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-white/25">아이템 없음</p>
                </div>
              ) : (
                visibleShopItems.map((item) => {
                  const badge = getShopBadge(item.stock)
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2"
                    >
                      <span className="text-lg shrink-0 leading-none">{item.emoji || '🎁'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white/85 truncate leading-tight">{item.name}</p>
                        <p className="text-[10px] text-white/35 tabular-nums">{formatCurrency(item.price)}</p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })
              )}
              {shopItems.length > visibleShopItems.length && (
                <p className="text-right text-[10px] text-white/20 pt-0.5">
                  +{shopItems.length - visibleShopItems.length}개 더
                </p>
              )}
            </div>
          </section>

          {/* Stock Board */}
          <section className="flex-1 min-h-0 flex flex-col px-4 py-3">
            <div className="shrink-0 flex items-center justify-between mb-2.5">
              <div>
                <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/20">Stock Board</p>
                <h2 className="text-sm font-black text-white/80 mt-0.5">📈 주식</h2>
              </div>
              <span className="text-[10px] font-semibold text-white/25">{stocks.length}종목 운영</span>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-1.5">
              {visibleStocks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-white/25">종목 없음</p>
                </div>
              ) : (
                visibleStocks.map((stock) => {
                  const delta = getStockChange(stock)
                  const isRise = (delta?.change || 0) > 0
                  const isFall = (delta?.change || 0) < 0
                  return (
                    <div
                      key={stock.id}
                      className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2"
                    >
                      <span className="text-lg shrink-0 leading-none">{stock.emoji || '🎲'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white/85 truncate leading-tight">{stock.name}</p>
                        {delta ? (
                          <p className={`text-[10px] font-bold ${isRise ? 'text-rose-400' : isFall ? 'text-sky-400' : 'text-white/30'}`}>
                            {isRise ? '▲' : isFall ? '▼' : '■'} {Math.abs(delta.percent).toFixed(1)}%
                          </p>
                        ) : (
                          <p className="text-[10px] text-white/25">첫 시세</p>
                        )}
                      </div>
                      <p className="text-xs font-black text-white/80 tabular-nums shrink-0">
                        {formatCurrency(stock.current_price)}
                      </p>
                    </div>
                  )
                })
              )}
              {stocks.length > visibleStocks.length && (
                <p className="text-right text-[10px] text-white/20 pt-0.5">
                  +{stocks.length - visibleStocks.length}종목 더
                </p>
              )}
            </div>
          </section>

        </aside>
      </div>
    </div>
  )
}
