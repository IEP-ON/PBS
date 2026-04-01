import Link from 'next/link'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ classCode: string; studentId: string }>
}) {
  const session = await getSession()
  const { classCode, studentId } = await params

  if (!session.role || session.role !== 'student') {
    redirect('/login')
  }

  if (session.studentId !== studentId) {
    redirect('/login')
  }

  const navItems = [
    { href: `/s/${classCode}/${studentId}/home`, label: '홈', icon: '🏠' },
    { href: `/s/${classCode}/${studentId}/bankbook`, label: '통장', icon: '📒' },
    { href: `/s/${classCode}/${studentId}/stocks`, label: '주식', icon: '📈' },
    { href: `/s/${classCode}/${studentId}/shop`, label: '가게', icon: '🏪' },
    { href: `/s/${classCode}/${studentId}/selfcheck`, label: '셀프체크', icon: '✅' },
  ]

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-100">🏦</span>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-900">{session.studentName}의 은행</p>
              <p className="truncate text-xs text-slate-500">통장, 주식, 가게, 셀프체크를 한 번에</p>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 md:block">
            {classCode}
          </div>
          <form action="/api/auth/logout" method="POST" className="shrink-0">
            <button type="submit" className="rounded-xl px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-slate-100 hover:text-gray-600">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="student-shell-main flex-1 overflow-x-hidden overflow-y-auto">
        <div className="tablet-page mx-auto w-full max-w-6xl px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
          {children}
        </div>
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav className="student-bottom-nav fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/96 px-3 backdrop-blur">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600"
            >
              <span className="text-[1.35rem]">{item.icon}</span>
              <span className="text-[11px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
