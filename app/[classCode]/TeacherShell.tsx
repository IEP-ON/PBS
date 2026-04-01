'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SidebarNav from './SidebarNav'

const TEACHER_SIDEBAR_STORAGE_KEY = 'teacher_shell_sidebar_collapsed'

export default function TeacherShell({
  classCode,
  children,
}: {
  classCode: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false

    const stored = window.localStorage.getItem(TEACHER_SIDEBAR_STORAGE_KEY)
    if (stored !== null) {
      return stored === 'true'
    }

    return window.matchMedia('(max-width: 1280px)').matches
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(TEACHER_SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  return (
    <div className="teacher-shell min-h-[100dvh] bg-slate-100 print:bg-white">
      <div className="flex min-h-[100dvh] print:block">
        {drawerOpen && (
          <button
            type="button"
            aria-label="사이드바 닫기"
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden print:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        <aside
          className={`print:hidden ${
            collapsed ? 'teacher-sidebar-collapsed' : 'teacher-sidebar-expanded'
          } fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
            <Link href={`/${classCode}/dashboard`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-200">
                🏦
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">PBS 토큰 이코노미</p>
                  <p className="truncate font-mono text-[11px] text-slate-400">{classCode}</p>
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="hidden rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
              aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            >
              {collapsed ? '»' : '«'}
            </button>
          </div>

          <SidebarNav
            classCode={classCode}
            collapsed={collapsed}
            onNavigate={() => setDrawerOpen(false)}
          />

          <div className={`border-t border-slate-100 p-3 ${collapsed ? 'px-2' : ''}`}>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className={`flex w-full items-center rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 ${
                  collapsed ? 'justify-center' : 'gap-3'
                }`}
              >
                <span className="text-lg">🚪</span>
                {!collapsed && <span>로그아웃</span>}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col print:block">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-5 print:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
                aria-label="메뉴 열기"
              >
                ☰
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">교사 운영 화면</p>
                <p className="truncate text-xs text-slate-500">갤럭시탭 가로 PWA 기준 레이아웃</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <a
                href={`/tv/${classCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                📺 TV
              </a>
              <a
                href="/help"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                ❓ Help
              </a>
            </div>
          </header>

          <main className="teacher-main min-w-0 flex-1 overflow-x-hidden print:overflow-visible">
            <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-4 xl:p-5 print:max-w-none print:p-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
