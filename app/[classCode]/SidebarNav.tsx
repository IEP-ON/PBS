'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: string
  description: string
  badge?: string
}

export default function SidebarNav({ classCode }: { classCode: string }) {
  const pathname = usePathname()
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)

  const navItems: NavItem[] = [
    {
      href: `/${classCode}/dashboard`,
      label: '대시보드',
      icon: '📊',
      description: '학생 잔액 및 오늘 현황 요약',
    },
    {
      href: `/${classCode}/pbs`,
      label: 'PBS 체크',
      icon: '✅',
      description: '학생별 목표 행동 토큰 지급',
    },
    {
      href: `/${classCode}/students`,
      label: '학생 관리',
      icon: '👨‍🎓',
      description: '학생 등록·수정·QR 통장 발급',
    },
    {
      href: `/${classCode}/stocks`,
      label: '주식',
      icon: '📈',
      description: '모의 주식 시장 가격 및 종목 관리',
    },
    {
      href: `/${classCode}/shop`,
      label: '가게',
      icon: '🏪',
      description: '상점 아이템 등록·수정·재고 관리',
    },
    {
      href: `/${classCode}/contracts`,
      label: '행동계약서',
      icon: '📝',
      description: '학생과 행동 목표 계약서 작성',
    },
    {
      href: `/${classCode}/dro`,
      label: 'DRO 타이머',
      icon: '⏱️',
      description: '타이머 기반 문제행동 감소 전략',
    },
    {
      href: `/${classCode}/response-cost`,
      label: '반응대가',
      icon: '⚠️',
      description: '규칙 위반 시 토큰 차감 기록',
    },
    {
      href: `/${classCode}/fba`,
      label: 'FBA 분석',
      icon: '🔍',
      description: '기능행동분석 기록 및 AI 자동 분석',
      badge: 'GPT-4o',
    },
    {
      href: `/${classCode}/interventions`,
      label: '중재 전략',
      icon: '📚',
      description: 'PBS 중재 계획 수립 및 전략 관리',
    },
    {
      href: `/${classCode}/extinction-alerts`,
      label: '소거 알림',
      icon: '🚨',
      description: '소거 폭발 경고 및 단계별 알림',
    },
    {
      href: `/${classCode}/ethics`,
      label: '윤리/동의',
      icon: '📜',
      description: '학부모 동의서 및 윤리 기록 관리',
    },
    {
      href: `/${classCode}/qr-tokens`,
      label: 'QR 토큰',
      icon: '🪙',
      description: '실물 코인용 QR 코드 배치 생성·인쇄',
    },
    {
      href: `/${classCode}/class-account`,
      label: '학급 계좌',
      icon: '🏫',
      description: '학급 공동 적립금 관리',
    },
    {
      href: `/${classCode}/settings`,
      label: '설정',
      icon: '⚙️',
      description: '급여·이자·데이터 보관 규칙 설정',
    },
  ]

  return (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        const isHovered = hoveredHref === item.href
        return (
          <div key={item.href} className="relative">
            <Link
              href={item.href}
              onMouseEnter={() => setHoveredHref(item.href)}
              onMouseLeave={() => setHoveredHref(null)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full flex-shrink-0">
                  AI
                </span>
              )}
            </Link>
            {isHovered && (
              <div className="absolute left-full top-0 ml-2 z-50 w-48 px-3 py-2 bg-gray-900 text-white text-xs rounded-xl shadow-xl pointer-events-none whitespace-normal leading-relaxed">
                <p className="font-medium text-gray-200 mb-0.5">{item.label}</p>
                <p className="text-gray-400">{item.description}</p>
                {item.badge && (
                  <p className="text-purple-400 mt-1">✨ {item.badge} AI 분석 지원</p>
                )}
                <div className="absolute right-full top-3 border-4 border-transparent border-r-gray-900" />
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
