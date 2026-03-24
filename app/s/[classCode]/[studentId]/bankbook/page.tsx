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

const TYPE_LABELS: Record<string, string> = {
  salary_basic: '출석 기본급',
  salary_pbs: 'PBS 성과급',
  salary_bonus: '개근 보너스',
  salary_interest: '이자',
  purchase: '가게 구매',
  gift_sent: '선물 발송',
  gift_received: '선물 수신',
  stock_buy: '주식 매수',
  stock_sell: '주식 매도',
  level_up_bonus: '보너스',
  response_cost: '반응대가',
}

export default function StudentBankbookPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [loading, setLoading] = useState(true)

  const studentId = typeof window !== 'undefined' ? window.location.pathname.split('/')[3] : ''

  useEffect(() => {
    if (!studentId) return
    const init = async () => {
      const [accRes, txRes] = await Promise.all([
        fetch(`/api/accounts/${studentId}`),
        fetch(`/api/accounts/${studentId}/transactions?limit=100`),
      ])
      if (accRes.ok) {
        const acc = await accRes.json()
        setBalance(acc.balance || 0)
        setTotalEarned(acc.totalEarned || 0)
        setTotalSpent(acc.totalSpent || 0)
      }
      if (txRes.ok) {
        const tx = await txRes.json()
        setTransactions(tx.transactions || [])
      }
      setLoading(false)
    }
    init()
  }, [studentId])

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">📒 통장</h1>

      {/* 잔액 카드 */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80">현재 잔액</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(balance)}</p>
        <div className="flex gap-4 mt-3 text-sm opacity-80">
          <span>수입 {formatCurrency(totalEarned)}</span>
          <span>지출 {formatCurrency(totalSpent)}</span>
        </div>
      </div>

      {/* 거래 내역 */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-gray-600">거래 내역</h2>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">거래 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {TYPE_LABELS[tx.type] || tx.type}
                  </p>
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
