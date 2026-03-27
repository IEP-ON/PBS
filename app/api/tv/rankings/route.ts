import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/tv/rankings — TV 순위판용 학생 잔액 + 오늘 획득 토큰
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()
    const today = new Date().toISOString().split('T')[0]

    // 학급 이름
    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('class_name')
      .eq('id', session.classroomId)
      .single()

    // 학생 + 계좌 잔액
    const { data: students } = await supabase
      .from('pbs_students')
      .select('id, name, pbs_stage, pbs_accounts(balance)')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('name')

    if (!students) {
      return NextResponse.json({ rankings: [], className: classroom?.class_name || '' })
    }

    // 오늘 획득 토큰 (학생별)
    const { data: todayRecords } = await supabase
      .from('pbs_records')
      .select('student_id, token_granted')
      .eq('record_date', today)
      .in('student_id', students.map(s => s.id))

    const todayMap: Record<string, number> = {}
    for (const rec of todayRecords || []) {
      todayMap[rec.student_id] = (todayMap[rec.student_id] || 0) + rec.token_granted
    }

    const rankings = students.map(s => {
      const account = Array.isArray(s.pbs_accounts) ? s.pbs_accounts[0] : s.pbs_accounts
      return {
        id: s.id,
        name: s.name,
        pbs_stage: s.pbs_stage,
        balance: account?.balance || 0,
        todayEarned: todayMap[s.id] || 0,
        rank: 0,
      }
    })

    return NextResponse.json({
      rankings,
      className: classroom?.class_name || '',
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
