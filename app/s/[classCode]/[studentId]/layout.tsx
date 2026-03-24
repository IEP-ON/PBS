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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏦</span>
          <span className="font-bold text-gray-900 text-sm">{session.studentName}의 은행</span>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
            로그아웃
          </button>
        </form>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 px-4 safe-area-pb">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
