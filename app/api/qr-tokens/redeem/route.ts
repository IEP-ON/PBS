import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

// POST /api/qr-tokens/redeem — ATM: QR 토큰 코인 충전
// 세션 없이 작동 (ATM 공용 기기용)
// studentId 방식: ATM 로그인 후 이미 인증된 상태 (PIN 재검증 불필요)
// studentName+PIN 방식: 직접 인증
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const code = body.code?.trim()
    const classCode = body.classCode?.trim()
    const studentId = body.studentId?.trim()
    const studentName = body.studentName?.trim()
    const studentPin = body.studentPin?.toString().trim()

    if (!code || !classCode) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }
    if (!studentId && (!studentName || !studentPin)) {
      return NextResponse.json({ error: '학생 정보가 누락되었습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 1. 학급 확인
    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('id')
      .eq('code', classCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: '학급코드가 올바르지 않습니다.' }, { status: 401 })
    }

    // 2. 학생 확인 (studentId 또는 이름+PIN)
    let student: { id: string; name: string } | null = null

    if (studentId) {
      // ATM 로그인 후 이미 인증된 studentId로 직접 조회
      const { data } = await supabase
        .from('pbs_students')
        .select('id, name')
        .eq('id', studentId)
        .eq('class_code_id', classroom.id)
        .eq('is_active', true)
        .single()
      student = data
    } else {
      // 이름+PIN 방식
      const { data } = await supabase
        .from('pbs_students')
        .select('id, name, pin_hash')
        .eq('class_code_id', classroom.id)
        .eq('name', studentName)
        .eq('is_active', true)
        .single()
      if (data) {
        const pinMatch = await bcrypt.compare(studentPin, data.pin_hash)
        if (!pinMatch) {
          return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
        }
        student = data
      }
    }

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 확인해주세요.' }, { status: 401 })
    }

    // 3. QR 토큰 확인
    const { data: token } = await supabase
      .from('pbs_qr_tokens')
      .select('*')
      .eq('code', code)
      .eq('class_code_id', classroom.id)
      .single()

    if (!token) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 404 })
    }

    if (token.is_used) {
      return NextResponse.json({ error: '이미 사용된 토큰입니다.' }, { status: 400 })
    }

    // 4. 계좌 조회
    const { data: account } = await supabase
      .from('pbs_accounts')
      .select('balance, total_earned')
      .eq('student_id', student.id)
      .single()

    if (!account) {
      return NextResponse.json({ error: '계좌를 찾을 수 없습니다.' }, { status: 404 })
    }

    const newBalance = account.balance + token.amount
    const newEarned = account.total_earned + token.amount

    // 5. 계좌 충전
    await supabase
      .from('pbs_accounts')
      .update({ balance: newBalance, total_earned: newEarned })
      .eq('student_id', student.id)

    // 6. 거래 기록
    await supabase.from('pbs_transactions').insert({
      student_id: student.id,
      type: 'qr_token',
      amount: token.amount,
      balance_after: newBalance,
      description: `QR 토큰 충전: ${token.label || token.amount + '원'} (+${token.amount}원)`,
    })

    // 7. 토큰 사용 처리
    await supabase
      .from('pbs_qr_tokens')
      .update({ is_used: true, used_by: student.id, used_at: new Date().toISOString() })
      .eq('id', token.id)

    return NextResponse.json({
      ok: true,
      amount: token.amount,
      balanceAfter: newBalance,
      studentName: student.name,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
