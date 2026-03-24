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
  is_active: boolean
}

type ItemFormData = {
  name: string
  category: string
  price: string
  stock: string
  isGiftable: boolean
  emoji: string
}

const CATEGORY_OPTIONS = [
  { value: 'activity', label: '활동' },
  { value: 'item', label: '물건' },
  { value: 'privilege', label: '특권' },
  { value: 'food', label: '간식' },
]

const EMOJI_OPTIONS = ['🎁', '🎮', '📚', '🍫', '🎨', '⭐', '🏅', '🎯', '🎪', '🍕', '🧸', '✏️']

const emptyForm: ItemFormData = {
  name: '',
  category: 'activity',
  price: '',
  stock: '',
  isGiftable: true,
  emoji: '🎁',
}

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [form, setForm] = useState<ItemFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = async () => {
    const res = await fetch('/api/shop/items')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const openAddModal = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (item: ShopItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      stock: item.stock != null ? item.stock.toString() : '',
      isGiftable: item.is_giftable,
      emoji: item.emoji || '🎁',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      setFormError('아이템명과 가격은 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')

    try {
      if (editingItem) {
        const res = await fetch(`/api/shop/items/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            price: Number(form.price),
            stock: form.stock ? Number(form.stock) : null,
            isGiftable: form.isGiftable,
            emoji: form.emoji,
          }),
        })
        if (!res.ok) { setFormError('수정 실패'); return }
      } else {
        const res = await fetch('/api/shop/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            price: Number(form.price),
            stock: form.stock ? Number(form.stock) : null,
            isGiftable: form.isGiftable,
            emoji: form.emoji,
          }),
        })
        if (!res.ok) { setFormError('등록 실패'); return }
      }
      setShowModal(false)
      fetchItems()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (itemId: string) => {
    if (!confirm('이 아이템을 삭제하시겠습니까?')) return
    await fetch(`/api/shop/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    fetchItems()
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
        <h1 className="text-2xl font-bold text-gray-900">🏪 가게 관리</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          + 아이템 추가
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🛍️</p>
          <p className="text-gray-500">등록된 아이템이 없습니다.</p>
          <button
            onClick={openAddModal}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            첫 아이템 추가하기
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl">
                {item.emoji || '🎁'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900">{item.name}</p>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {CATEGORY_OPTIONS.find(c => c.value === item.category)?.label || item.category}
                  </span>
                  {item.is_giftable && (
                    <span className="text-xs bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full">선물가능</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {formatCurrency(item.price)}
                  {item.stock != null && ` · 재고 ${item.stock}개`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(item)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDeactivate(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 아이템 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">
              {editingItem ? '아이템 수정' : '아이템 추가'}
            </h2>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">이모지</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, emoji: e })}
                      className={`w-10 h-10 text-xl rounded-xl border-2 transition-colors ${
                        form.emoji === e ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">아이템명 *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 자유 시간 10분"
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">카테고리</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">가격 *</span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="500"
                    min={0}
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">재고 (무제한=비움)</span>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    placeholder="무제한"
                    min={0}
                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isGiftable}
                  onChange={(e) => setForm({ ...form, isGiftable: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">선물 가능</span>
              </label>
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '저장 중...' : editingItem ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
