import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { generateClassCode, generateQrCode } from '@/lib/utils'
import bcrypt from 'bcryptjs'

// POST /api/classroom — 학급 개설
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { schoolName, teacherName, className, teacherPin, currencyUnit, startBalance } = body

    if (!schoolName || !teacherName || !className || !teacherPin) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
    }

    if (teacherPin.length < 4 || teacherPin.length > 6) {
      return NextResponse.json({ error: 'PIN은 4~6자리여야 합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 기존 학급 수 조회 (식별코드 순번용)
    const { count } = await supabase
      .from('pbs_class_codes')
      .select('*', { count: 'exact', head: true })

    const seq = (count || 0) + 1
    const year = new Date().getFullYear()
    const classCode = generateClassCode(schoolName, year, seq)
    const pinHash = await bcrypt.hash(teacherPin, 10)

    // class_codes INSERT
    const { data: classroom, error: classError } = await supabase
      .from('pbs_class_codes')
      .insert({
        code: classCode,
        school_name: schoolName,
        class_name: className,
        teacher_name: teacherName,
        teacher_pin_hash: pinHash,
        academic_year: year,
      })
      .select()
      .single()

    if (classError) {
      console.error('학급 개설 오류:', classError)
      return NextResponse.json({ error: '학급 개설에 실패했습니다.' }, { status: 500 })
    }

    // system_settings INSERT (기본값)
    await supabase.from('pbs_system_settings').insert({
      class_code_id: classroom.id,
      currency_unit: currencyUnit || 500,
      starting_balance: startBalance || 1000,
    })

    // class_account INSERT (공동계좌)
    await supabase.from('pbs_class_account').insert({
      class_code_id: classroom.id,
    })

    // salary_rules INSERT (기본 출석·주간개근 규칙)
    await supabase.from('pbs_salary_rules').insert([
      {
        class_code_id: classroom.id,
        rule_name: '출석 기본급',
        rule_type: 'attendance',
        amount: currencyUnit || 500,
      },
      {
        class_code_id: classroom.id,
        rule_name: '주간 개근 보너스',
        rule_type: 'weekly_perfect',
        amount: (currencyUnit || 500) * 2,
      },
    ])

    // 세션 설정 (자동 로그인)
    const session = await getSession()
    session.role = 'teacher'
    session.classCode = classCode
    session.classroomId = classroom.id
    await session.save()

    return NextResponse.json({
      classCode,
      classroomId: classroom.id,
    })
  } catch (error) {
    console.error('학급 개설 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
