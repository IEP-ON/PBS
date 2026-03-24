'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface PricePoint {
  price: number
  recorded_at: string
}

interface StockPriceChartProps {
  stockId: string
  stockName: string
  currentPrice: number
}

export default function StockPriceChart({ stockId, stockName, currentPrice }: StockPriceChartProps) {
  const [prices, setPrices] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  useEffect(() => {
    const fetchPrices = async () => {
      const res = await fetch(`/api/stocks/prices?stockId=${stockId}&days=${days}`)
      const data = await res.json()
      setPrices(data.prices || [])
      setLoading(false)
    }
    fetchPrices()
  }, [stockId, days])

  if (loading) {
    return <div className="text-sm text-gray-400 text-center py-4">시세 로딩 중...</div>
  }

  if (prices.length === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-4">
        시세 기록이 없습니다. (크론 작업으로 자동 수집)
      </div>
    )
  }

  const maxPrice = Math.max(...prices.map(p => p.price), currentPrice)
  const minPrice = Math.min(...prices.map(p => p.price), currentPrice)
  const priceRange = maxPrice - minPrice || 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{stockName} 시세 차트</h3>
        <div className="flex gap-1">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 text-xs rounded ${
                days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-end justify-between h-32 gap-1">
          {prices.map((point, i) => {
            const height = ((point.price - minPrice) / priceRange) * 100
            const isUp = i > 0 && point.price > prices[i - 1].price
            const isDown = i > 0 && point.price < prices[i - 1].price
            
            return (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                <div
                  className={`w-full rounded-t transition-all ${
                    isUp ? 'bg-red-400' : isDown ? 'bg-blue-400' : 'bg-gray-300'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {formatCurrency(point.price)}
                  <br />
                  {new Date(point.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* 가격 레이블 */}
        <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
          <span>최저: {formatCurrency(minPrice)}</span>
          <span>현재: {formatCurrency(currentPrice)}</span>
          <span>최고: {formatCurrency(maxPrice)}</span>
        </div>
      </div>

      {/* 최근 변동 */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {prices.slice(-3).map((point, i) => {
          const prev = i > 0 ? prices[prices.length - 3 + i - 1].price : null
          const change = prev ? point.price - prev : 0
          const changePercent = prev ? (change / prev) * 100 : 0
          
          return (
            <div key={i} className="bg-gray-50 rounded p-2 text-center">
              <p className="text-gray-500">{new Date(point.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</p>
              <p className="font-bold text-gray-900">{formatCurrency(point.price)}</p>
              {prev && (
                <p className={change >= 0 ? 'text-red-600' : 'text-blue-600'}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(1)}%
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
