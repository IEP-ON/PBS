'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GoalDeleteButton({
  goalId,
  goalName,
}: {
  goalId: string
  goalName: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`'${goalName}' 목표를 삭제할까요? 관련 PBS 기록과 DRO/알림도 함께 삭제됩니다.`)) {
      return
    }

    setDeleting(true)

    try {
      const res = await fetch(`/api/pbs/goals/${goalId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || '목표 삭제에 실패했습니다.')
      }
    } catch {
      alert('서버 연결에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={() => void handleDelete()}
      disabled={deleting}
      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:bg-red-100"
    >
      {deleting ? '삭제 중...' : '삭제'}
    </button>
  )
}
