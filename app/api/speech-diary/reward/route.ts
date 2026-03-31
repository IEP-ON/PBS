import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  getKstDateRange,
  getKstToday,
  getSpeechDiaryRewardDescription,
  SPEECH_DIARY_REWARD_AMOUNT,
  SPEECH_DIARY_REWARD_TYPE,
} from '@/lib/speech-diary'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = body.studentId?.toString().trim()
    const amount = Number(body.amount ?? SPEECH_DIARY_REWARD_AMOUNT)

    if (!studentId) {
      return NextResponse.json({ error: '학생을 선택해주세요.' }, { status: 400 })
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: '보상 금액이 올바르지 않습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const today = getKstToday()
    const { startIso, endIso } = getKstDateRange(today)

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, pbs_accounts(id, balance, total_earned)')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const account = Array.isArray(student.pbs_accounts) ? student.pbs_accounts[0] : student.pbs_accounts
    if (!account) {
      return NextResponse.json({ error: '학생 계좌를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { count: diaryCount } = await supabase
      .from('pbs_speech_diaries')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('created_at', startIso)
      .lt('created_at', endIso)

    if (!diaryCount) {
      return NextResponse.json({ error: '오늘 작성한 말 일기가 있어야 보상을 줄 수 있습니다.' }, { status: 400 })
    }

    const { data: existingReward } = await supabase
      .from('pbs_transactions')
      .select('id')
      .eq('student_id', studentId)
      .eq('type', SPEECH_DIARY_REWARD_TYPE)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .maybeSingle()

    if (existingReward) {
      return NextResponse.json({ error: '오늘은 이미 말 일기 보상을 지급했습니다.' }, { status: 409 })
    }

    const newBalance = account.balance + amount
    const newTotalEarned = (account.total_earned || 0) + amount

    const { error: accountError } = await supabase
      .from('pbs_accounts')
      .update({
        balance: newBalance,
        total_earned: newTotalEarned,
      })
      .eq('id', account.id)

    if (accountError) {
      return NextResponse.json({ error: '학생 계좌 갱신에 실패했습니다.' }, { status: 500 })
    }

    const description = getSpeechDiaryRewardDescription(today)
    const { data: transaction, error: transactionError } = await supabase
      .from('pbs_transactions')
      .insert({
        student_id: studentId,
        type: SPEECH_DIARY_REWARD_TYPE,
        amount,
        balance_after: newBalance,
        description,
      })
      .select()
      .single()

    if (transactionError) {
      return NextResponse.json({ error: '보상 거래 기록 생성에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      studentId,
      studentName: student.name,
      amount,
      newBalance,
      transaction,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
