import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// DELETE /api/pbs/records/[id] — PBS 체크 기록 취소 (오늘 미정산 기록만 가능)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createServerSupabase()
    const today = new Date().toISOString().split('T')[0]

    // 오늘 미정산 기록인지 + 같은 학급인지 확인
    const { data: record } = await supabase
      .from('pbs_records')
      .select('id, student_id, pbs_students!inner(class_code_id)')
      .eq('id', id)
      .eq('record_date', today)
      .eq('is_settled', false)
      .single()

    if (!record) {
      return NextResponse.json({ error: '취소할 수 없는 기록입니다. (이미 정산됐거나 오늘 기록이 아님)' }, { status: 404 })
    }

    const students = Array.isArray(record.pbs_students) ? record.pbs_students : [record.pbs_students]
    const belongs = students.some(
      (s: { class_code_id: string }) => s.class_code_id === session.classroomId
    )
    if (!belongs) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { error } = await supabase.from('pbs_records').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
