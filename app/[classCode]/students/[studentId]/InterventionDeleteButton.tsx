'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InterventionDeleteButton({
  strategyId,
  strategyName,
  studentId,
}: {
  strategyId: string
  strategyName: string
  studentId: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`'${strategyName}' 중재를 이 학생 목표에서 제거할까요? 다른 곳에서 더 이상 쓰지 않으면 라이브러리에서도 함께 정리됩니다.`)) {
      return
    }

    setDeleting(true)

    try {
      const res = await fetch(`/api/interventions/${strategyId}?studentId=${studentId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || '중재 삭제에 실패했습니다.')
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
