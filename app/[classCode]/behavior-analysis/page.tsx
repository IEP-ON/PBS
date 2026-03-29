'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

type TabType = 'fba' | 'interventions' | 'contracts' | 'dro'

export default function BehaviorAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const classCode = params.classCode as string
  const activeTab = (searchParams.get('tab') || 'fba') as TabType

  const tabs = [
    { id: 'fba' as TabType, label: 'FBA 분석', icon: '🔍', description: '기능행동분석 기록 및 AI 자동 분석', href: `/${classCode}/fba`, badge: 'GPT-4o' },
    { id: 'interventions' as TabType, label: '중재 전략', icon: '📚', description: 'PBS 중재 계획 수립 및 전략 관리', href: `/${classCode}/interventions` },
    { id: 'contracts' as TabType, label: '행동계약서', icon: '📝', description: '학생과 행동 목표 계약서 작성', href: `/${classCode}/contracts` },
    { id: 'dro' as TabType, label: 'DRO 히스토리', icon: '⏱️', description: 'DRO 타이머 이력 및 통계', href: `/${classCode}/dro` },
  ]

  // 첫 진입 시 FBA 페이지로 리다이렉트
  useEffect(() => {
    if (!searchParams.get('tab')) {
      router.replace(`/${classCode}/fba`)
    }
  }, [classCode, router, searchParams])

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔬 행동 분석 통합</h1>
        <p className="text-sm text-gray-500 mt-1">FBA·중재전략·행동계약서·DRO를 한 곳에서 관리</p>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-sm text-purple-900 font-medium mb-2">🎯 ABA 워크플로우 통합 페이지</p>
        <p className="text-sm text-purple-700 mb-3">
          AI 행동 지원 계획이 생성하는 FBA 분석, 중재 전략, 행동계약서, DRO 설정을 한 곳에서 확인하고 관리할 수 있습니다.
        </p>
        <div className="flex items-center gap-2 text-xs text-purple-600">
          <span className="bg-purple-100 px-2 py-1 rounded-full font-medium">사정(Assessment)</span>
          <span>→</span>
          <span className="bg-purple-100 px-2 py-1 rounded-full font-medium">계획(Planning)</span>
          <span>→</span>
          <span className="bg-purple-100 px-2 py-1 rounded-full font-medium">실행(Implementation)</span>
          <span>→</span>
          <span className="bg-purple-100 px-2 py-1 rounded-full font-medium">모니터링(Monitoring)</span>
        </div>
      </div>

      {/* 탭 네비게이션 (큰 버튼) */}
      <div className="grid grid-cols-2 gap-4">
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={tab.href}
            className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 rounded-2xl transition-all group relative"
          >
            {tab.badge && (
              <span className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                AI
              </span>
            )}
            <span className="text-5xl group-hover:scale-110 transition-transform">{tab.icon}</span>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{tab.label}</div>
              <div className="text-sm text-gray-500 mt-1">{tab.description}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 설명 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
        <p><strong className="text-gray-900">🔍 FBA 분석:</strong> 기능행동분석(Functional Behavior Assessment) 기록 및 GPT-4o AI 자동 분석</p>
        <p><strong className="text-gray-900">📚 중재 전략:</strong> What Works Clearinghouse 근거기반 중재 전략 라이브러리</p>
        <p><strong className="text-gray-900">📝 행동계약서:</strong> 학생·교사·학부모 간 행동 목표 계약서 작성 및 인쇄</p>
        <p><strong className="text-gray-900">⏱️ DRO 히스토리:</strong> Differential Reinforcement of Other Behavior 타이머 이력 및 통계 (실시간 타이머는 수업 모드에서 조작)</p>
      </div>

      {/* AI 행동 지원 계획 링크 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900 font-medium mb-2">💡 AI 행동 지원 계획</p>
        <p className="text-sm text-blue-700 mb-3">
          학생 상세 페이지에서 "AI 행동 지원 계획"을 요청하면, 위 4가지 요소를 한 번에 생성합니다.
        </p>
        <Link
          href={`/${classCode}/students`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          학생 관리로 이동 →
        </Link>
      </div>
    </div>
  )
}
