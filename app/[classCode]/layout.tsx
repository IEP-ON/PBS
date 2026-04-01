import Link from 'next/link'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SidebarNav from './SidebarNav'

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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col print:hidden">
        <div className="p-4 border-b border-gray-100">
          <Link href={`/${classCode}/dashboard`} className="flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">PBS 토큰 이코노미</p>
              <p className="text-xs text-gray-400 font-mono">{classCode}</p>
            </div>
          </Link>
        </div>

        <SidebarNav classCode={classCode} />

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
      <main className="flex-1 overflow-auto print:overflow-visible">
        {children}
      </main>
    </div>
  )
}
