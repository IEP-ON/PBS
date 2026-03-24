import Link from 'next/link'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function TeacherLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ classCode: string }>
}) {
  const session = await getSession()
  const { classCode } = await params

  if (!session.role || session.role !== 'teacher') {
    redirect('/login')
  }

  if (session.classCode !== classCode) {
    redirect('/login')
  }

  const navItems = [
    { href: `/${classCode}/dashboard`, label: '대시보드', icon: '📊' },
    { href: `/${classCode}/pbs`, label: 'PBS 체크', icon: '✅' },
    { href: `/${classCode}/students`, label: '학생 관리', icon: '👨‍🎓' },
    { href: `/${classCode}/stocks`, label: '주식', icon: '📈' },
    { href: `/${classCode}/shop`, label: '가게', icon: '🏪' },
    { href: `/${classCode}/contracts`, label: '행동계약서', icon: '📝' },
    { href: `/${classCode}/dro`, label: 'DRO 타이머', icon: '⏱️' },
    { href: `/${classCode}/response-cost`, label: '반응대가', icon: '⚠️' },
    { href: `/${classCode}/fba`, label: 'FBA 분석', icon: '🔍' },
    { href: `/${classCode}/interventions`, label: '중재 전략', icon: '📚' },
    { href: `/${classCode}/extinction-alerts`, label: '소거 알림', icon: '🚨' },
    { href: `/${classCode}/ethics`, label: '윤리/동의', icon: '📜' },
    { href: `/${classCode}/qr-tokens`, label: 'QR 토큰', icon: '🪙' },
    { href: `/${classCode}/class-account`, label: '학급 계좌', icon: '🏫' },
    { href: `/${classCode}/settings`, label: '설정', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link href={`/${classCode}/dashboard`} className="flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">PBS 토큰 이코노미</p>
              <p className="text-xs text-gray-400 font-mono">{classCode}</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium"
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
            >
              <span className="text-lg">🚪</span>
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
