import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'
import { getStoragePath } from '@/lib/speech-diary'

// GET /api/students/[studentId] — 학생 상세 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { studentId } = await params
    const supabase = await createServerSupabase()

    const { data: student, error } = await supabase
      .from('pbs_students')
      .select('*, pbs_accounts(*)')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (error || !student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ student, account: student.pbs_accounts })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/students/[studentId] — 학생 정보 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId } = await params
    const body = await request.json()
    const supabase = await createServerSupabase()

    // PIN 변경 시 해시 처리
    const updateData: Record<string, unknown> = { ...body }
    if (body.pin) {
      updateData.pin_hash = await bcrypt.hash(body.pin, 10)
      delete updateData.pin
    }

    const { data: student, error } = await supabase
      .from('pbs_students')
      .update(updateData)
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '학생 정보 수정에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ student })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/students/[studentId] — 학생 및 관련 데이터 완전 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { studentId } = await params
    const supabase = await createServerSupabase()

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: diaries } = await supabase
      .from('pbs_speech_diaries')
      .select('audio_url, image_url')
      .eq('student_id', studentId)

    const storagePaths = (diaries || [])
      .flatMap((diary) => [getStoragePath(diary.audio_url), getStoragePath(diary.image_url)])
      .filter((path): path is string => Boolean(path))

    if (storagePaths.length > 0) {
      await supabase.storage.from('audio-diaries').remove(storagePaths)
    }

    const { data: contracts } = await supabase
      .from('pbs_behavior_contracts')
      .select('id')
      .eq('student_id', studentId)

    const contractIds = (contracts || []).map((contract) => contract.id)
    if (contractIds.length > 0) {
      await supabase.from('pbs_contract_versions').delete().in('contract_id', contractIds)
    }

    await supabase.from('pbs_ai_generation_log').delete().eq('student_id', studentId)
    await supabase.from('pbs_speech_diaries').delete().eq('student_id', studentId)
    await supabase.from('pbs_extinction_alerts').delete().eq('student_id', studentId)
    await supabase.from('pbs_dro_timers').delete().eq('student_id', studentId)
    await supabase.from('pbs_records').delete().eq('student_id', studentId)
    await supabase.from('pbs_fba_records').delete().eq('student_id', studentId)
    await supabase.from('pbs_behavior_contracts').delete().eq('student_id', studentId)
    await supabase.from('pbs_stock_holdings').delete().eq('student_id', studentId)
    await supabase.from('pbs_transactions').delete().eq('student_id', studentId)
    await supabase.from('pbs_goals').delete().eq('student_id', studentId)
    await supabase.from('pbs_accounts').delete().eq('student_id', studentId)

    const { error } = await supabase
      .from('pbs_students')
      .delete()
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)

    if (error) {
      return NextResponse.json({ error: '학생 삭제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, studentName: student.name })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
