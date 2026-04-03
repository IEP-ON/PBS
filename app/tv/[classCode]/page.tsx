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
  if (stock == null) {
    return {
      label: '무제한',
      className: 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20',
    }
  }

  if (stock <= 0) {
    return {
      label: '품절',
      className: 'bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/20',
    }
  }

  return {
    label: `${stock}개 남음`,
    className: 'bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/20',
  }
}

function getStockChange(stock: StockSnapshot) {
  if (stock.previous_price == null) {
    return null
  }

  const change = stock.current_price - stock.previous_price
  const percent = stock.previous_price > 0 ? (change / stock.previous_price) * 100 : 0

  return {
    change,
    percent,
  }
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
    const interval = setInterval(loadRankings, 30000) // 30초마다 갱신
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-900 to-blue-900 flex items-center justify-center">
        <p className="text-white text-2xl">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.24),_transparent_28%),linear-gradient(140deg,_#111827_0%,_#172554_42%,_#1d4ed8_100%)] p-4 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1680px] flex-col gap-5 lg:min-h-[calc(100dvh-3rem)]">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/8 px-5 py-5 shadow-2xl shadow-slate-950/20 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">
                Classroom Live
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                학생 {rankings.length}명
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                가게 {shopItems.length}개
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                주식 {stocks.length}종목
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-4xl">
              {className || classCode} 🏆 순위판
            </h1>
            <p className="mt-1 text-sm text-cyan-100/80">
              {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준 · 30초마다 자동 갱신
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSortMode('today')}
              className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
                sortMode === 'today'
                  ? 'bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-300/25'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              오늘 획득
            </button>
            <button
              onClick={() => setSortMode('balance')}
              className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
                sortMode === 'balance'
                  ? 'bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-300/25'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              전체 잔액
            </button>
            <button
              onClick={loadRankings}
              className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20"
              title="새로고침"
            >
              🔄 새로고침
            </button>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 gap-5 2xl:grid-cols-[minmax(0,1.7fr)_420px]">
          <section className="flex min-h-0 flex-col gap-5">
            {rankings.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-white/10 bg-white/8 p-10 text-center backdrop-blur">
                <div>
                  <p className="mb-4 text-6xl">🏫</p>
                  <p className="text-xl font-bold text-white">등록된 학생이 없습니다.</p>
                  <p className="mt-2 text-sm text-white/65">학생을 등록하면 이 화면에 순위와 학급 보드가 함께 표시됩니다.</p>
                </div>
              </div>
            ) : (
              <>
                {top.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[top[1], top[0], top[2]].map((student, idx) => {
                      if (!student) return <div key={idx} />
                      const originalIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2
                      const isFirst = originalIdx === 0
                      const value = sortMode === 'today' ? student.todayEarned : student.balance

                      return (
                        <div
                          key={student.id}
                          className={`flex flex-col items-center rounded-[2rem] px-6 py-6 transition-all ${
                            isFirst
                              ? 'scale-[1.03] bg-gradient-to-b from-yellow-300 to-amber-400 text-slate-950 shadow-2xl shadow-yellow-400/25'
                              : originalIdx === 1
                              ? 'bg-gradient-to-b from-slate-200 to-slate-300 text-slate-900 shadow-xl'
                              : 'bg-gradient-to-b from-amber-500 to-orange-600 text-white shadow-xl'
                          } ${isFirst ? 'py-8' : ''}`}
                        >
                          <span className="mb-2 text-4xl">{MEDAL[originalIdx]}</span>
                          <p className="text-center text-2xl font-black">{student.name}</p>
                          <p className={`mt-1 text-sm font-semibold ${isFirst ? 'text-slate-700' : 'text-white/80'}`}>
                            LV.{student.pbs_stage}
                          </p>
                          <p className="mt-3 text-3xl font-black">
                            {sortMode === 'today'
                              ? value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)
                              : formatCurrency(value)
                            }
                          </p>
                          <p className={`mt-1 text-xs font-semibold uppercase tracking-[0.2em] ${isFirst ? 'text-slate-600' : 'text-white/60'}`}>
                            {sortMode === 'today' ? 'Today Earned' : 'Balance'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {rest.length > 0 && (
                  <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
                    {rest.map((student, idx) => {
                      const value = sortMode === 'today' ? student.todayEarned : student.balance
                      return (
                        <div
                          key={student.id}
                          className="flex items-center gap-4 rounded-[1.6rem] border border-white/10 bg-white/8 px-5 py-4 backdrop-blur"
                        >
                          <span className="w-8 text-center text-2xl font-black text-white/55">
                            {idx + 4}
                          </span>
                          <div className="flex-1">
                            <p className="text-lg font-bold text-white">{student.name}</p>
                            <p className="text-xs font-semibold text-cyan-100/70">LV.{student.pbs_stage}</p>
                          </div>
                          <p className="text-xl font-black text-white">
                            {sortMode === 'today'
                              ? value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)
                              : formatCurrency(value)
                            }
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="grid min-h-0 gap-5 lg:grid-cols-2 2xl:grid-cols-1">
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/30 p-5 shadow-xl shadow-slate-950/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/70">Shop Board</p>
                  <h2 className="mt-1 text-2xl font-black text-white">🏪 가게</h2>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                  {shopItems.length}개 운영 중
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {visibleShopItems.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-white/70">등록된 가게 아이템이 없습니다.</p>
                  </div>
                ) : (
                  visibleShopItems.map((item) => {
                    const badge = getShopBadge(item.stock)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                          {item.emoji || '🎁'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-white">{item.name}</p>
                          <p className="text-sm font-semibold text-cyan-100/75">{formatCurrency(item.price)}</p>
                        </div>
                        <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
                          {badge.label}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {shopItems.length > visibleShopItems.length && (
                <p className="mt-4 text-right text-xs font-semibold text-white/50">
                  외 {shopItems.length - visibleShopItems.length}개 더 있음
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/30 p-5 shadow-xl shadow-slate-950/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/70">Stock Board</p>
                  <h2 className="mt-1 text-2xl font-black text-white">📈 주식</h2>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                  {stocks.length}종목 운영 중
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {visibleStocks.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-white/70">등록된 주식 종목이 없습니다.</p>
                  </div>
                ) : (
                  visibleStocks.map((stock) => {
                    const delta = getStockChange(stock)
                    const isRise = (delta?.change || 0) > 0
                    const isFall = (delta?.change || 0) < 0

                    return (
                      <div
                        key={stock.id}
                        className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                            {stock.emoji || '🎲'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-bold text-white">{stock.name}</p>
                                <p className="truncate text-xs text-white/45">
                                  {stock.description || '학급에서 운영 중인 커스텀 종목'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-black text-white">{formatCurrency(stock.current_price)}</p>
                                {delta ? (
                                  <p className={`text-xs font-bold ${isRise ? 'text-rose-300' : isFall ? 'text-sky-300' : 'text-white/55'}`}>
                                    {isRise ? '▲' : isFall ? '▼' : '■'} {formatCurrency(Math.abs(delta.change))}
                                    {delta.percent !== 0 ? ` (${Math.abs(delta.percent).toFixed(1)}%)` : ''}
                                  </p>
                                ) : (
                                  <p className="text-xs font-bold text-white/55">첫 시세</p>
                                )}
                              </div>
                            </div>
                            {stock.price_date && (
                              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
                                최근 반영일 {stock.price_date}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {stocks.length > visibleStocks.length && (
                <p className="mt-4 text-right text-xs font-semibold text-white/50">
                  외 {stocks.length - visibleStocks.length}종목 더 있음
                </p>
              )}
            </section>
          </aside>
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold text-cyan-100/55">
            PBS 토큰 이코노미 · 순위, 가게, 주식 현황을 한 화면에서 보여줍니다.
          </p>
        </div>
      </div>
    </div>
  )
}
