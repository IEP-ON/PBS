import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getStoragePath } from '@/lib/speech-diary'

export const runtime = 'nodejs'

const MAX_BATCH = 200

// POST /api/speech-diary/bulk-delete — 선택한 말 일기 다건 삭제 (교사·학급 소속 검증)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const rawIds = body?.diaryIds
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: '삭제할 일기 id 목록이 필요합니다.' }, { status: 400 })
    }

    const diaryIds = [...new Set(rawIds.map((id: unknown) => String(id).trim()).filter(Boolean))]
    if (diaryIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `한 번에 최대 ${MAX_BATCH}건까지 삭제할 수 있습니다.` }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: diaries, error: fetchError } = await supabase
      .from('pbs_speech_diaries')
      .select('id, student_id, audio_url, image_url')
      .in('id', diaryIds)

    if (fetchError) {
      return NextResponse.json({ error: '일기 조회에 실패했습니다.' }, { status: 500 })
    }

    if (!diaries || diaries.length === 0) {
      return NextResponse.json({ error: '해당 일기를 찾을 수 없습니다.' }, { status: 404 })
    }

    const studentIds = [...new Set(diaries.map((d) => d.student_id))]
    const { data: allowedStudents, error: stErr } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('class_code_id', session.classroomId)
      .eq('is_active', true)
      .in('id', studentIds)

    if (stErr) {
      return NextResponse.json({ error: '학생 권한 확인에 실패했습니다.' }, { status: 500 })
    }

    const allowed = new Set((allowedStudents || []).map((s) => s.id))
    const deletable = diaries.filter((d) => allowed.has(d.student_id))
    if (deletable.length === 0) {
      return NextResponse.json({ error: '삭제할 수 있는 일기가 없습니다.' }, { status: 403 })
    }

    const idsToDelete = deletable.map((d) => d.id)
    const storagePaths = deletable
      .flatMap((d) => [getStoragePath(d.audio_url), getStoragePath(d.image_url)])
      .filter((path): path is string => Boolean(path))

    const { error: deleteError } = await supabase.from('pbs_speech_diaries').delete().in('id', idsToDelete)

    if (deleteError) {
      return NextResponse.json({ error: '일기 삭제에 실패했습니다.' }, { status: 500 })
    }

    if (storagePaths.length > 0) {
      await supabase.storage.from('audio-diaries').remove(storagePaths)
    }

    const skipped = diaryIds.length - idsToDelete.length

    return NextResponse.json({
      ok: true,
      deletedCount: idsToDelete.length,
      deletedDiaryIds: idsToDelete,
      skippedCount: skipped > 0 ? skipped : 0,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
