'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Stock {
  id: string
  name: string
  emoji: string
  current_price: number
  description: string | null
}

interface Holding {
  stock_name: string
  stock_type: string
  quantity: number
  avg_buy_price: number
}

export default function StudentStocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [trading, setTrading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const studentId = typeof window !== 'undefined' ? window.location.pathname.split('/')[3] : ''

  const fetchData = async () => {
    const [stocksRes, accRes] = await Promise.all([
      fetch('/api/stocks'),
      fetch(`/api/accounts/${studentId}`),
    ])
    const stocksData = await stocksRes.json()
    setStocks(stocksData.stocks || [])

    if (accRes.ok) {
      const accData = await accRes.json()
      setBalance(accData.balance || 0)
    }

    // 보유 현황은 별도 조회
    const holdRes = await fetch(`/api/accounts/${studentId}/transactions?type=holdings`)
    if (holdRes.ok) {
      const holdData = await holdRes.json()
      setHoldings(holdData.holdings || [])
    }

    setLoading(false)
  }

  useEffect(() => { if (studentId) fetchData() }, [studentId])

  const handleTrade = async (stock: Stock, action: 'buy' | 'sell') => {
    const qtyStr = prompt(`${stock.name} ${action === 'buy' ? '매수' : '매도'} 수량:`, '1')
    if (!qtyStr) return
    const quantity = Number(qtyStr)
    if (!quantity || quantity <= 0) return

    setTrading(stock.id)
    setMessage('')

    try {
      const res = await fetch('/api/stocks/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockId: stock.id,
          stockName: stock.name,
          stockType: 'custom',
          action,
          quantity,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const emoji = action === 'buy' ? '📈' : '📉'
        setMessage(`${emoji} ${stock.name} ${quantity}주 ${action === 'buy' ? '매수' : '매도'} 완료! (${formatCurrency(data.totalAmount)})`)
        setBalance(data.balanceAfter)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setTrading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">📈 주식</h1>
        <p className="text-sm font-bold text-blue-600">잔액: {formatCurrency(balance)}</p>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* 보유 종목 */}
      {holdings.filter(h => h.quantity > 0).length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-600">내 보유 종목</h2>
          {holdings.filter(h => h.quantity > 0).map((h, i) => {
            const stock = stocks.find(s => s.name === h.stock_name)
            const currentPrice = stock?.current_price || 0
            const profit = (currentPrice - h.avg_buy_price) * h.quantity
            return (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{h.stock_name} <span className="text-xs text-gray-400">{h.quantity}주</span></p>
                  <p className="text-xs text-gray-500">평단 {formatCurrency(h.avg_buy_price)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(currentPrice * h.quantity)}</p>
                  <p className={`text-xs font-medium ${profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 종목 목록 */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-gray-600">종목 시세</h2>
        {stocks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">등록된 종목이 없습니다.</p>
          </div>
        ) : (
          stocks.map((stock) => {
            const held = holdings.find(h => h.stock_name === stock.name)
            return (
              <div key={stock.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stock.emoji}</span>
                    <div>
                      <p className="font-bold text-gray-900">{stock.name}</p>
                      {stock.description && <p className="text-xs text-gray-500">{stock.description}</p>}
                    </div>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stock.current_price)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTrade(stock, 'buy')}
                    disabled={trading === stock.id}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-medium rounded-xl transition-colors"
                  >
                    매수
                  </button>
                  <button
                    onClick={() => handleTrade(stock, 'sell')}
                    disabled={trading === stock.id || !held || held.quantity === 0}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
                  >
                    매도 {held && held.quantity > 0 ? `(${held.quantity}주)` : ''}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
