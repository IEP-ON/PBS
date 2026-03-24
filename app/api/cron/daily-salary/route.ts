import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { verifyCronAuth } from '@/lib/utils'

// POST /api/cron/daily-salary — 출석 기본급 자동 입금
// 호출: Vercel Cron (KST 09:00) 또는 교사 수동 실행
export async function POST(request: Request) {
  try {
    // Cron 인증 또는 교사 세션 인증
    const isCron = verifyCronAuth(request)
    if (!isCron) {
      const session = await getSession()
      if (!session.classroomId || session.role !== 'teacher') {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
    }

    const body = await request.json().catch(() => ({}))
    const { classroomId, date } = body
    const targetDate = date || new Date().toISOString().split('T')[0]

    const supabase = await createServerSupabase()

    // 대상 학급 결정 (Cron이면 모든 활성 학급, 교사면 본인 학급)
    let classIds: string[] = []
    if (isCron) {
      const { data: classes } = await supabase
        .from('pbs_class_codes')
        .select('id')
        .eq('is_active', true)
      classIds = classes?.map(c => c.id) || []
    } else {
      const session = await getSession()
      if (session.classroomId) classIds = [session.classroomId]
      if (classroomId) classIds = [classroomId]
    }

    let totalStudents = 0
    let totalAmount = 0

    for (const classId of classIds) {
      // 출석 기본급 규칙 조회
      const { data: rule } = await supabase
        .from('pbs_salary_rules')
        .select('amount')
        .eq('class_code_id', classId)
        .eq('rule_type', 'attendance')
        .eq('is_active', true)
        .single()

      if (!rule) continue
      const salaryAmount = rule.amount

      // 활성 학생 목록
      const { data: students } = await supabase
        .from('pbs_students')
        .select('id')
        .eq('class_code_id', classId)
        .eq('is_active', true)

      if (!students || students.length === 0) continue

      // 이미 오늘 기본급을 받았는지 확인
      const { data: existing } = await supabase
        .from('pbs_transactions')
        .select('student_id')
        .eq('type', 'salary_basic')
        .gte('created_at', `${targetDate}T00:00:00`)
        .lte('created_at', `${targetDate}T23:59:59`)
        .in('student_id', students.map(s => s.id))

      const alreadyPaid = new Set(existing?.map(e => e.student_id) || [])

      for (const student of students) {
        if (alreadyPaid.has(student.id)) continue

        // 잔액 조회
        const { data: account } = await supabase
          .from('pbs_accounts')
          .select('balance, total_earned')
          .eq('student_id', student.id)
          .single()

        if (!account) continue

        const newBalance = account.balance + salaryAmount
        const newTotalEarned = account.total_earned + salaryAmount

        // 계좌 업데이트
        await supabase
          .from('pbs_accounts')
          .update({ balance: newBalance, total_earned: newTotalEarned })
          .eq('student_id', student.id)

        // 거래 기록
        await supabase.from('pbs_transactions').insert({
          student_id: student.id,
          type: 'salary_basic',
          amount: salaryAmount,
          balance_after: newBalance,
          description: `출석 기본급 (+${salaryAmount}원)`,
        })

        totalStudents++
        totalAmount += salaryAmount
      }
    }

    return NextResponse.json({
      ok: true,
      date: targetDate,
      students: totalStudents,
      totalAmount,
    })
  } catch (error) {
    console.error('출석 기본급 정산 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
