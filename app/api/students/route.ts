import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { generateQrCode } from '@/lib/utils'
import bcrypt from 'bcryptjs'

// GET /api/students — 학급 학생 목록
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    const { data: students, error } = await supabase
      .from('pbs_students')
      .select('*, pbs_accounts(*)')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .order('name')

    if (error) {
      return NextResponse.json({ error: '학생 목록 조회 실패' }, { status: 500 })
    }

    const studentIds = (students || []).map((student) => student.id)
    const { data: profiles } = studentIds.length > 0
      ? await supabase
          .from('pbs_student_ai_profiles')
          .select('student_id, student_registration_summary, public_safe_summary')
          .in('student_id', studentIds)
      : { data: [] }

    const profileMap = new Map(
      (profiles || []).map((profile) => [profile.student_id, profile])
    )

    const enriched = (students || []).map((student) => ({
      ...student,
      ai_profile_summary: profileMap.get(student.id)?.student_registration_summary || null,
      public_safe_summary: profileMap.get(student.id)?.public_safe_summary || null,
    }))

    return NextResponse.json({ students: enriched })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/students — 학생 등록
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { name, grade, disabilityType, pbsStage, pin } = body

    if (!name || !pin) {
      return NextResponse.json({ error: '이름과 PIN을 입력해주세요.' }, { status: 400 })
    }

    if (pin.length !== 4) {
      return NextResponse.json({ error: 'PIN은 4자리여야 합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 같은 학급에 동일 이름 학생 중복 확인
    const { data: existing } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('class_code_id', session.classroomId)
      .eq('name', name)
      .eq('is_active', true)
      .single()

    if (existing) {
      return NextResponse.json({ error: '같은 이름의 학생이 이미 등록되어 있습니다.' }, { status: 409 })
    }

    const pinHash = await bcrypt.hash(pin, 10)
    const qrCode = generateQrCode()

    // 학생 INSERT
    const { data: student, error: studentError } = await supabase
      .from('pbs_students')
      .insert({
        class_code_id: session.classroomId,
        name,
        grade: grade || null,
        pin_hash: pinHash,
        qr_code: qrCode,
        disability_type: disabilityType || null,
        pbs_stage: pbsStage || 1,
      })
      .select()
      .single()

    if (studentError) {
      console.error('학생 등록 오류:', studentError)
      return NextResponse.json({ error: '학생 등록에 실패했습니다.' }, { status: 500 })
    }

    // 시스템 설정에서 시작 잔액 조회
    const { data: settings } = await supabase
      .from('pbs_system_settings')
      .select('starting_balance')
      .eq('class_code_id', session.classroomId)
      .single()

    const startBalance = settings?.starting_balance || 1000

    // 계좌 생성
    await supabase.from('pbs_accounts').insert({
      student_id: student.id,
      balance: startBalance,
      total_earned: startBalance,
    })

    // 초기 잔액 거래 기록
    await supabase.from('pbs_transactions').insert({
      student_id: student.id,
      type: 'level_up_bonus',
      amount: startBalance,
      balance_after: startBalance,
      description: '학기 초 시작 잔액',
    })

    return NextResponse.json({
      studentId: student.id,
      qrCode: student.qr_code,
    })
  } catch (error) {
    console.error('학생 등록 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
