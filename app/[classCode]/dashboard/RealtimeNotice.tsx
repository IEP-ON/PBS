'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Notice {
  id: string
  message: string
  type: 'purchase' | 'stock' | 'other'
  createdAt: number
}

const TYPE_EMOJI: Record<string, string> = {
  purchase: '🛒',
  stock_buy: '📈',
  stock_sell: '📉',
  qr_token: '🪙',
  response_cost: '⚠️',
  gift_sent: '🎁',
  gift_received: '🎁',
}

export default function RealtimeNotice({ classroomId }: { classroomId: string }) {
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`dashboard-realtime-${classroomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pbs_transactions',
        },
        async (payload) => {
          const tx = payload.new as {
            id: string
            type: string
            amount: number
            description: string
            student_id: string
          }

          // 학생 이름 조회
          const { data: student } = await supabase
            .from('pbs_students')
            .select('name')
            .eq('id', tx.student_id)
            .single()

          const studentName = student?.name || '학생'
          const emoji = TYPE_EMOJI[tx.type] || '💰'
          const amountStr = tx.amount < 0
            ? `${tx.amount.toLocaleString()}원`
            : `+${tx.amount.toLocaleString()}원`

          const notice: Notice = {
            id: tx.id,
            message: `${emoji} [${studentName}] ${tx.description} (${amountStr})`,
            type: tx.type.startsWith('stock') ? 'stock' : tx.type === 'purchase' ? 'purchase' : 'other',
            createdAt: Date.now(),
          }

          setNotices((prev) => [notice, ...prev].slice(0, 5))

          setTimeout(() => {
            setNotices((prev) => prev.filter((n) => n.id !== notice.id))
          }, 5000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroomId])

  if (notices.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-xs w-full">
      {notices.map((n) => (
        <div
          key={n.id}
          className="bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-right-4 duration-300"
        >
          <div className="flex-1">
            <p className="font-medium leading-snug">{n.message}</p>
            <p className="text-gray-400 text-xs mt-0.5">학생 실시간 거래</p>
          </div>
          <button
            onClick={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))}
            className="text-gray-500 hover:text-white text-xs mt-0.5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
