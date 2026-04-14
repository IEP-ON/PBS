import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { getTokenEconomyHealth } from '@/lib/token-economy-health'

export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()
    const health = await getTokenEconomyHealth(supabase, session.classroomId)

    return NextResponse.json(health)
  } catch {
    return NextResponse.json({ error: '경제 건강도 진단에 실패했습니다.' }, { status: 500 })
  }
}
