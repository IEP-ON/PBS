import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getStoragePath } from '@/lib/speech-diary'

export const runtime = 'nodejs'

// PATCH /api/speech-diary/[diaryId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ diaryId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { diaryId } = await params
    const body = await request.json()

    const supabase = await createServerSupabase()

    const { data: targetDiary } = await supabase
      .from('pbs_speech_diaries')
      .select('id, student_id')
      .eq('id', diaryId)
      .single()

    if (!targetDiary) {
      return NextResponse.json({ error: '일기를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('id', targetDiary.student_id)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('pbs_speech_diaries')
      .update({
        corrected_text: body.correctedText ?? null,
        teacher_note: body.teacherNote ?? null,
      })
      .eq('id', diaryId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '일기 수정에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ diary: data })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE /api/speech-diary/[diaryId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ diaryId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { diaryId } = await params
    const supabase = await createServerSupabase()

    const { data: targetDiary } = await supabase
      .from('pbs_speech_diaries')
      .select('id, student_id, created_at, audio_url, image_url')
      .eq('id', diaryId)
      .single()

    if (!targetDiary) {
      return NextResponse.json({ error: '삭제할 일기를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: student } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('id', targetDiary.student_id)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const storagePaths = [
      getStoragePath(targetDiary.audio_url),
      getStoragePath(targetDiary.image_url),
    ].filter((path): path is string => Boolean(path))

    const { error: deleteError } = await supabase
      .from('pbs_speech_diaries')
      .delete()
      .eq('id', diaryId)

    if (deleteError) {
      return NextResponse.json({ error: '일기 삭제에 실패했습니다.' }, { status: 500 })
    }

    if (storagePaths.length > 0) {
      await supabase.storage.from('audio-diaries').remove(storagePaths)
    }

    return NextResponse.json({
      ok: true,
      deletedDiaryIds: [diaryId],
      deletedCount: 1,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
