import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getSupportOverview } from '@/lib/support/overview'

export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()
    const overview = await getSupportOverview(supabase, session.classroomId)

    return NextResponse.json(overview)
  } catch {
    return NextResponse.json({ error: '학생 지원 허브 개요 조회에 실패했습니다.' }, { status: 500 })
  }
}
