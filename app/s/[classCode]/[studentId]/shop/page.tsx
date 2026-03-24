'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface ShopItem {
  id: string
  name: string
  category: string
  price: number
  stock: number | null
  is_giftable: boolean
  emoji: string
}

export default function StudentShopPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      const [itemsRes, accountRes] = await Promise.all([
        fetch('/api/shop/items'),
        fetch(`${window.location.pathname.replace(/\/shop$/, '')}/home`).catch(() => null),
      ])
      const itemsData = await itemsRes.json()
      setItems(itemsData.items || [])

      // 잔액은 별도 API로 조회
      const pathParts = window.location.pathname.split('/')
      const studentId = pathParts[3]
      if (studentId) {
        const accRes = await fetch(`/api/accounts/${studentId}`)
        if (accRes.ok) {
          const accData = await accRes.json()
          setBalance(accData.balance || 0)
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const handlePurchase = async (item: ShopItem) => {
    if (!confirm(`${item.name}을(를) ${formatCurrency(item.price)}에 구매하시겠습니까?`)) return
    setPurchasing(item.id)
    setMessage('')

    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setBalance(data.balanceAfter)
        setMessage(`✅ ${item.name} 구매 완료!`)
        // 재고 반영
        setItems(prev => prev.map(i =>
          i.id === item.id && i.stock != null ? { ...i, stock: i.stock! - 1 } : i
        ))
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch {
      setMessage('❌ 서버 연결 실패')
    } finally {
      setPurchasing(null)
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
        <h1 className="text-xl font-bold text-gray-900">🏪 가게</h1>
        <p className="text-sm font-bold text-blue-600">잔액: {formatCurrency(balance)}</p>
      </div>

      {message && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700">{message}</div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-4xl mb-2">🛍️</p>
          <p className="text-gray-400">아직 등록된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const soldOut = item.stock != null && item.stock <= 0
            const cantAfford = balance < item.price
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl">
                  {item.emoji || '🎁'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(item.price)}
                    {item.stock != null && ` · 재고 ${item.stock}개`}
                  </p>
                </div>
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={soldOut || cantAfford || purchasing === item.id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                >
                  {purchasing === item.id ? '...' : soldOut ? '품절' : cantAfford ? '잔액부족' : '구매'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
