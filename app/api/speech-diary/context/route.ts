import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { getKstToday } from '@/lib/speech-diary'

// GET /api/speech-diary/context?date=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getKstToday()

    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from('pbs_speech_context')
      .select('*')
      .eq('class_code_id', session.classroomId)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: '학교 맥락 조회에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ context: data })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST/PATCH /api/speech-diary/context
export async function POST(request: Request) {
  return upsertContext(request)
}

export async function PATCH(request: Request) {
  return upsertContext(request)
}

async function upsertContext(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const date = body.date || getKstToday()

    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from('pbs_speech_context')
      .upsert({
        class_code_id: session.classroomId,
        date,
        lunch_menu: body.lunchMenu || null,
        event: body.event || null,
        memo: body.memo || null,
      }, {
        onConflict: 'class_code_id,date',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '학교 맥락 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ context: data })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
