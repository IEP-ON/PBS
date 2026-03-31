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

interface TooltipState {
  item: NavItem
  y: number
}

export default function SidebarNav({ classCode }: { classCode: string }) {
  const pathname = usePathname()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const navItems: NavItem[] = [
    {
      href: `/${classCode}/dashboard`,
      label: '대시보드',
      icon: '📊',
      description: '학생 잔액 및 오늘 현황 요약 · 소거 알림',
    },
    {
      href: `/${classCode}/pbs`,
      label: 'PBS 체크',
      icon: '✅',
      description: '학생별 목표 행동 토큰 지급 · 반응대가',
    },
    {
      href: `/${classCode}/students`,
      label: '학생 관리',
      icon: '👨‍🎓',
      description: '학생 등록·수정·QR 통장 발급',
    },
    {
      href: `/${classCode}/token-economy`,
      label: '토큰 경제',
      icon: '🏪',
      description: '가게·주식·QR토큰·학급계좌 통합',
    },
    {
      href: `/${classCode}/speech-diary`,
      label: '말 일기장',
      icon: '🎙️',
      description: 'QR 카드로 음성 녹음·누적 일기 관리',
      badge: 'Whisper',
    },
    {
      href: `/${classCode}/behavior-analysis`,
      label: '행동 분석',
      icon: '�',
      description: 'FBA·중재전략·행동계약서·DRO 통합',
      badge: 'GPT-4o',
    },
    {
      href: `/${classCode}/settings`,
      label: '설정',
      icon: '⚙️',
      description: '급여·이자·윤리·동의서 설정',
    },
  ]

  return (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* 수업 모드 — 최상단 고정 */}
        <Link
          href={`/${classCode}/teach`}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setTooltip({
              item: {
                href: `/${classCode}/teach`,
                label: '수업 모드',
                icon: '👨‍🏫',
                description: '6명 동시 체크 · DRO 통합 · 사건 기록 · 수업 종료 정산',
              },
              y: rect.top,
            })
          }}
          onMouseLeave={() => setTooltip(null)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors mb-2 ${
            pathname === `/${classCode}/teach`
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
          }`}
        >
          <span className="text-lg flex-shrink-0">👨‍🏫</span>
          <span className="flex-1 truncate">수업 모드</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded-full flex-shrink-0">
            NEW
          </span>
        </Link>

        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({ item, y: rect.top })
              }}
              onMouseLeave={() => setTooltip(null)}
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
          )
        })}

        {/* TV 모드 (새 탭으로 열기) */}
        <a
          href={`/tv/${classCode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setTooltip({
              item: {
                href: `/tv/${classCode}`,
                label: 'TV 순위판',
                icon: '📺',
                description: '교실 화면용 학생 잔액 순위판 (새 탭)',
              },
              y: rect.top,
            })
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <span className="text-lg flex-shrink-0">📺</span>
          <span className="flex-1 truncate">TV 순위판</span>
          <span className="text-[9px] text-gray-400">↗</span>
        </a>

        {/* 도움말 */}
        <a
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <span className="text-lg flex-shrink-0">❓</span>
          <span className="flex-1 truncate">시작 가이드</span>
          <span className="text-[9px] text-gray-400">↗</span>
        </a>
      </nav>

      {/* fixed 툴팁 — overflow 잘림 없음 */}
      {tooltip && (
        <div
          style={{ top: tooltip.y, left: 244 }}
          className="fixed z-[9999] w-52 px-3 py-2.5 bg-gray-900 text-white text-xs rounded-xl shadow-2xl pointer-events-none"
        >
          <p className="font-semibold text-white mb-0.5">{tooltip.item.label}</p>
          <p className="text-gray-400 leading-relaxed">{tooltip.item.description}</p>
          {tooltip.item.badge && (
            <p className="text-purple-400 mt-1.5">✨ {tooltip.item.badge} AI 분석 지원</p>
          )}
          <div className="absolute right-full top-3 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </>
  )
}
