import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { logId, accepted, teacherModified, finalSaved, teacherFeedback } = await request.json()

    if (!logId) {
      return NextResponse.json({ error: 'logId가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { error } = await supabase
      .from('pbs_ai_generation_log')
      .update({
        accepted: accepted ?? true,
        teacher_modified: teacherModified ?? false,
        final_saved: finalSaved ?? null,
        teacher_feedback: teacherFeedback ?? null,
      })
      .eq('id', logId)
      .eq('classroom_id', session.classroomId)

    if (error) {
      return NextResponse.json({ error: '피드백 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
