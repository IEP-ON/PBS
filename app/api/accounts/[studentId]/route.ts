import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/accounts/[studentId] — 계좌 잔액 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 학생은 본인 계좌만
    if (session.role === 'student' && session.studentId !== (await params).studentId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const { studentId } = await params
    const supabase = await createServerSupabase()

    const { data, error } = await supabase
      .from('pbs_accounts')
      .select('*')
      .eq('student_id', studentId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '계좌를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      balance: data.balance,
      totalEarned: data.total_earned,
      totalSpent: data.total_spent,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
