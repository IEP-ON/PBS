import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import TeacherShell from './TeacherShell'

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
    <TeacherShell classCode={classCode}>{children}</TeacherShell>
  )
}
