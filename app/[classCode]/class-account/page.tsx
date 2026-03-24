'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Transaction {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export default function ClassAccountPage() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const fetchData = async () => {
    const res = await fetch('/api/class-account')
    if (res.ok) {
      const data = await res.json()
      setBalance(data.account?.balance || 0)
      setTransactions(data.transactions || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return
    setSubmitting(true)
    setMessage('')
    try {
      const res = await fetch('/api/class-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: Number(amount), description: description || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ ${type === 'deposit' ? '입금' : '출금'} ${formatCurrency(Math.abs(data.amount))} 완료`)
        setAmount('')
        setDescription('')
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setSubmitting(false)
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
      <h1 className="text-2xl font-bold text-gray-900">🏫 학급 계좌</h1>

      {/* 잔액 카드 */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 text-white">
        <p className="text-emerald-100 text-sm">학급 공금 잔액</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(balance)}</p>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {/* 입출금 폼 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900">입출금</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setType('deposit')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${type === 'deposit' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >💰 입금</button>
          <button
            onClick={() => setType('withdraw')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${type === 'withdraw' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >💸 출금</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block col-span-1">
            <span className="text-sm font-medium text-gray-700">금액</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min={1} className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block col-span-2">
            <span className="text-sm font-medium text-gray-700">설명</span>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="학급 행사비 등" className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
        </div>
        <button onClick={handleSubmit} disabled={submitting || !amount} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors">
          {submitting ? '처리 중...' : `${type === 'deposit' ? '입금' : '출금'} 실행`}
        </button>
      </div>

      {/* 거래 내역 */}
      <div className="space-y-2">
        <h2 className="font-bold text-gray-900">거래 내역</h2>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">거래 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {transactions.map(tx => (
              <div key={tx.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-xs text-gray-400">{formatCurrency(tx.balance_after)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
