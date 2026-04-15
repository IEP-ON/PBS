'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type TabKey = 'overview' | 'assessment' | 'plan' | 'execute' | 'review'

interface Props {
  overview: ReactNode
  assessment: ReactNode
  plan: ReactNode
  execute: ReactNode
  review: ReactNode
}

const TAB_META: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: 'overview', label: '개요', hint: '학생 상태 요약' },
  { key: 'assessment', label: '사정', hint: 'AI 계획 · 행동 원인 분석' },
  { key: 'plan', label: '계획', hint: '목표 · 예방 전략' },
  { key: 'execute', label: '실행', hint: '약속 · 강화 타이머 · 거래' },
  { key: 'review', label: '점검', hint: '경보 · 추세 · 연결' },
]

export default function StudentSupportTabs({
  overview,
  assessment,
  plan,
  execute,
  review,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = TAB_META.some((tab) => tab.key === rawTab) ? (rawTab as TabKey) : 'overview'

  const panels: Record<TabKey, ReactNode> = {
    overview,
    assessment,
    plan,
    execute,
    review,
  }

  const handleTabChange = (nextTab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', nextTab)
    }
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.9rem] border border-gray-100 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {TAB_META.map((tab) => {
            const isActive = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`touch-target rounded-2xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-transparent bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white'
                }`}
                aria-pressed={isActive}
              >
                <p className="text-sm font-bold">{tab.label}</p>
                <p className="mt-1 text-xs text-current/80">{tab.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      {panels[activeTab]}
    </div>
  )
}
