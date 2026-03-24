import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/settings — 시스템 설정 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServerSupabase()

    const { data: settings } = await supabase
      .from('pbs_system_settings')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .single()

    // 급여 규칙도 함께 조회
    const { data: salaryRules } = await supabase
      .from('pbs_salary_rules')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .order('rule_type')

    return NextResponse.json({
      settings: settings || null,
      salaryRules: salaryRules || [],
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/settings — 시스템 설정 수정
export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = await createServerSupabase()

    const allowedFields: Record<string, string> = {
      currencyUnit: 'currency_unit',
      startingBalance: 'starting_balance',
      minBalanceProtection: 'min_balance_protection',
      interestRateWeekly: 'interest_rate_weekly',
      interestMinBalance: 'interest_min_balance',
      balanceCarryover: 'balance_carryover',
      dataRetentionMonths: 'data_retention_months',
      weatherLocation: 'weather_location',
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        updateData[col] = body[key]
      }
    }

    const { data: settings, error } = await supabase
      .from('pbs_system_settings')
      .update(updateData)
      .eq('class_code_id', session.classroomId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
    }

    // 급여 규칙 업데이트
    if (body.attendanceSalary !== undefined) {
      await supabase
        .from('pbs_salary_rules')
        .update({ amount: Number(body.attendanceSalary) })
        .eq('class_code_id', session.classroomId)
        .eq('rule_type', 'attendance')
    }

    if (body.weeklyBonus !== undefined) {
      await supabase
        .from('pbs_salary_rules')
        .update({ amount: Number(body.weeklyBonus) })
        .eq('class_code_id', session.classroomId)
        .eq('rule_type', 'weekly_perfect')
    }

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
