'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import StockPriceChart from './StockPriceChart'

interface Stock {
  id: string
  name: string
  emoji: string
  description: string | null
  current_price: number
  named_by: string | null
  priceHistory: { price: number; previous_price: number | null; price_date: string; adjustment_type: string }[]
}

const ADJUST_OPTIONS = [
  { value: 'surge', label: '🚀 폭등', color: 'bg-red-500' },
  { value: 'rise', label: '📈 상승', color: 'bg-orange-500' },
  { value: 'flat', label: '➡️ 보합', color: 'bg-gray-500' },
  { value: 'fall', label: '📉 하락', color: 'bg-blue-500' },
  { value: 'crash', label: '💥 폭락', color: 'bg-purple-600' },
]

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', emoji: '🎲', description: '', currentPrice: '100', namedBy: '' })
  const [submitting, setSubmitting] = useState(false)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fetchStocks = async () => {
    const res = await fetch('/api/stocks')
    const data = await res.json()
    setStocks(data.stocks || [])
    setLoading(false)
  }

  useEffect(() => { fetchStocks() }, [])

  const handleAddStock = async () => {
    if (!addForm.name || !addForm.currentPrice) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      if (res.ok) {
        setShowAddModal(false)
        setAddForm({ name: '', emoji: '🎲', description: '', currentPrice: '100', namedBy: '' })
        fetchStocks()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleAdjust = async (stockId: string, adjustmentType: string) => {
    setAdjusting(stockId)
    setMessage('')
    try {
      const body: Record<string, unknown> = { adjustmentType }
      if (adjustmentType === 'manual_input') {
        const input = prompt('새 가격을 입력하세요:')
        if (!input) { setAdjusting(null); return }
        body.newPrice = Number(input)
      }
      const res = await fetch(`/api/stocks/${stockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`${data.stock.name}: ${formatCurrency(data.previousPrice)} → ${formatCurrency(data.newPrice)}`)
        fetchStocks()
      }
    } finally {
      setAdjusting(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📈 주식 관리</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          + 종목 추가
        </button>
      </div>

      {message && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{message}</div>
      )}

      {stocks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500">등록된 커스텀 종목이 없습니다.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            첫 종목 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {stocks.map((stock) => {
            const prev = stock.priceHistory[0]?.previous_price
            const change = prev ? stock.current_price - prev : 0
            const changePercent = prev ? ((change / prev) * 100).toFixed(1) : '0'
            return (
              <div key={stock.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{stock.emoji}</span>
                    <div>
                      <p className="font-bold text-gray-900">{stock.name}</p>
                      {stock.description && <p className="text-xs text-gray-500">{stock.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stock.current_price)}</p>
                    {change !== 0 && (
                      <p className={`text-sm font-medium ${change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {change > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(change))} ({changePercent}%)
                      </p>
                    )}
                  </div>
                </div>

                {/* 주가 조정 버튼 */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleAdjust(stock.id, 'manual_input')}
                    disabled={adjusting === stock.id}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    ✏️ 직접입력
                  </button>
                  {ADJUST_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAdjust(stock.id, opt.value)}
                      disabled={adjusting === stock.id}
                      className={`px-3 py-1.5 ${opt.color} hover:opacity-80 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* 주가 시세 차트 */}
                <StockPriceChart 
                  stockId={stock.id} 
                  stockName={stock.name} 
                  currentPrice={stock.current_price}
                />

                {/* 주가 이력 */}
                {stock.priceHistory.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {stock.priceHistory.map((p, i) => (
                      <div key={i} className="flex-shrink-0 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600">
                        {p.price_date.slice(5)} · {formatCurrency(p.price)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 종목 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">커스텀 종목 추가</h2>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">종목명 *</span>
              <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="예: 우주 에너지" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">이모지</span>
                <input type="text" value={addForm.emoji} onChange={(e) => setAddForm({ ...addForm, emoji: e.target.value })} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">초기 가격 *</span>
                <input type="number" value={addForm.currentPrice} onChange={(e) => setAddForm({ ...addForm, currentPrice: e.target.value })} min={1} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">설명</span>
              <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="종목 설명 (선택)" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">이름 지은 학생</span>
              <input type="text" value={addForm.namedBy} onChange={(e) => setAddForm({ ...addForm, namedBy: e.target.value })} placeholder="학생 이름 (선택)" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">취소</button>
              <button onClick={handleAddStock} disabled={submitting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors">{submitting ? '등록 중...' : '등록'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
