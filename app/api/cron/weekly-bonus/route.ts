import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { verifyCronAuth } from '@/lib/utils'

// POST /api/cron/weekly-bonus — 주간 개근 보너스 + 이자 지급
// 호출: Vercel Cron (금요일 KST 14:00) 또는 교사 수동 실행
export async function POST(request: Request) {
  try {
    const isCron = verifyCronAuth(request)
    if (!isCron) {
      const session = await getSession()
      if (!session.classroomId || session.role !== 'teacher') {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
    }

    const supabase = await createServerSupabase()

    // 대상 학급 결정
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
    }

    // 이번 주 월~금 날짜 계산
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const weekDates: string[] = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      weekDates.push(d.toISOString().split('T')[0])
    }

    let bonusCount = 0
    let interestCount = 0
    let totalBonusAmount = 0
    let totalInterestAmount = 0

    for (const classId of classIds) {
      // 주간 개근 보너스 규칙
      const { data: bonusRule } = await supabase
        .from('pbs_salary_rules')
        .select('amount')
        .eq('class_code_id', classId)
        .eq('rule_type', 'weekly_perfect')
        .eq('is_active', true)
        .single()

      // 시스템 설정 (이자율)
      const { data: settings } = await supabase
        .from('pbs_system_settings')
        .select('interest_rate_weekly, interest_min_balance')
        .eq('class_code_id', classId)
        .single()

      // 활성 학생
      const { data: students } = await supabase
        .from('pbs_students')
        .select('id')
        .eq('class_code_id', classId)
        .eq('is_active', true)

      if (!students || students.length === 0) continue

      for (const student of students) {
        const { data: account } = await supabase
          .from('pbs_accounts')
          .select('balance, total_earned')
          .eq('student_id', student.id)
          .single()

        if (!account) continue

        let currentBalance = account.balance
        let currentEarned = account.total_earned

        // 1) 주간 개근 보너스: 이번 주 5일 모두 출석 기본급을 받았으면 지급
        if (bonusRule) {
          const { data: attendanceRecords } = await supabase
            .from('pbs_transactions')
            .select('created_at')
            .eq('student_id', student.id)
            .eq('type', 'salary_basic')
            .gte('created_at', `${weekDates[0]}T00:00:00`)
            .lte('created_at', `${weekDates[4]}T23:59:59`)

          const attendedDays = new Set(
            attendanceRecords?.map(r => r.created_at.split('T')[0]) || []
          )

          if (attendedDays.size >= 5) {
            const bonusAmount = bonusRule.amount
            currentBalance += bonusAmount
            currentEarned += bonusAmount

            await supabase
              .from('pbs_accounts')
              .update({ balance: currentBalance, total_earned: currentEarned })
              .eq('student_id', student.id)

            await supabase.from('pbs_transactions').insert({
              student_id: student.id,
              type: 'salary_bonus',
              amount: bonusAmount,
              balance_after: currentBalance,
              description: `주간 개근 보너스 (+${bonusAmount}원)`,
            })

            bonusCount++
            totalBonusAmount += bonusAmount
          }
        }

        // 2) 주간 이자: 잔액이 최소 기준 이상이면 이자 지급
        if (settings && currentBalance >= settings.interest_min_balance) {
          const interestAmount = Math.floor(currentBalance * Number(settings.interest_rate_weekly))
          if (interestAmount > 0) {
            currentBalance += interestAmount
            currentEarned += interestAmount

            await supabase
              .from('pbs_accounts')
              .update({ balance: currentBalance, total_earned: currentEarned })
              .eq('student_id', student.id)

            await supabase.from('pbs_transactions').insert({
              student_id: student.id,
              type: 'interest',
              amount: interestAmount,
              balance_after: currentBalance,
              description: `주간 이자 (+${interestAmount}원)`,
            })

            interestCount++
            totalInterestAmount += interestAmount
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      weekRange: `${weekDates[0]} ~ ${weekDates[4]}`,
      bonus: { students: bonusCount, totalAmount: totalBonusAmount },
      interest: { students: interestCount, totalAmount: totalInterestAmount },
    })
  } catch (error) {
    console.error('주간 보너스 정산 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
