'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type MouseEvent, useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: string
  description: string
}

interface TooltipState {
  item: NavItem
  y: number
  x: number
}

export default function SidebarNav({
  classCode,
  collapsed = false,
  onNavigate,
}: {
  classCode: string
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const showTooltip = (event: MouseEvent<HTMLElement>, item: NavItem) => {
    if (!collapsed) return
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ item, y: rect.top, x: rect.right + 14 })
  }

  const navItems: NavItem[] = [
    {
      href: `/${classCode}/dashboard`,
      label: '대시보드',
      icon: '📊',
      description: '학급 운영 요약',
    },
    {
      href: `/${classCode}/speech-diary`,
      label: '말 일기장',
      icon: '🎙️',
      description: '녹음 일기 목록·교사 수정',
    },
    {
      href: `/${classCode}/speech-diary/analytics`,
      label: '말 일기 분석',
      icon: '📈',
      description: '참여·길이·TTR·전사 보정 유사도',
    },
    {
      href: `/${classCode}/contracts`,
      label: '행동계약서',
      icon: '📝',
      description: '계약 작성·QR 보상 발급',
    },
    {
      href: `/${classCode}/qr-tokens`,
      label: 'QR 토큰',
      icon: '🪙',
      description: '실물 토큰 발급·인쇄·관리',
    },
    {
      href: `/${classCode}/shop`,
      label: '가게',
      icon: '🏪',
      description: '보상 아이템·가격',
    },
    {
      href: `/${classCode}/students`,
      label: '학생 관리',
      icon: '👨‍🎓',
      description: '학생 등록·QR 통장',
    },
    {
      href: `/${classCode}/settings`,
      label: '설정',
      icon: '⚙️',
      description: '학급 설정·고급 기능 안내',
    },
  ]

  return (
    <>
      <nav className={`flex-1 space-y-1 overflow-y-auto p-3 ${collapsed ? 'px-2' : ''}`}>
        {navItems.map((item) => {
          const isActive = (() => {
            if (pathname === item.href) return true
            if (item.href.endsWith('/speech-diary')) {
              return pathname.startsWith(`${item.href}/context`)
            }
            return pathname.startsWith(`${item.href}/`)
          })()
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={(e) => showTooltip(e, item)}
              onMouseLeave={() => setTooltip(null)}
              onClick={onNavigate}
              className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
                collapsed ? 'justify-center' : 'gap-3'
              } ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            </Link>
          )
        })}

        <a
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 ${
            collapsed ? 'justify-center' : 'gap-3'
          }`}
          onMouseEnter={(e) =>
            showTooltip(e, {
              href: '/help',
              label: '도움말',
              icon: '❓',
              description: '시작 가이드(새 탭)',
            })
          }
          onMouseLeave={() => setTooltip(null)}
        >
          <span className="text-lg flex-shrink-0">❓</span>
          {!collapsed && (
            <>
              <span className="flex-1 truncate">도움말</span>
              <span className="text-[9px] text-gray-400">↗</span>
            </>
          )}
        </a>
      </nav>

      {tooltip && (
        <div
          style={{ top: tooltip.y, left: tooltip.x }}
          className="fixed z-[9999] w-52 px-3 py-2.5 bg-gray-900 text-white text-xs rounded-xl shadow-2xl pointer-events-none"
        >
          <p className="font-semibold text-white mb-0.5">{tooltip.item.label}</p>
          <p className="text-gray-400 leading-relaxed">{tooltip.item.description}</p>
          <div className="absolute right-full top-3 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </>
  )
}
