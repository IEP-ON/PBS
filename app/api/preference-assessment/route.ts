import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { rankPreferences, summarizeItems, type PreferenceTrialInput } from '@/lib/preference-assessment'

async function assertOwnedStudent(supabase: Awaited<ReturnType<typeof createServerSupabase>>, studentId: string, classroomId: string) {
  const { data, error } = await supabase
    .from('pbs_students')
    .select('id')
    .eq('id', studentId)
    .eq('class_code_id', classroomId)
    .maybeSingle()
  return { ok: Boolean(data) && !error, student: data }
}

// GET /api/preference-assessment?studentId= — 최근 평가 목록
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')?.trim()
    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { ok } = await assertOwnedStudent(supabase, studentId, session.classroomId)
    if (!ok) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('pbs_preference_assessments')
      .select('id, items, ranked_preferences, assessment_date, created_at')
      .eq('student_id', studentId)
      .eq('class_code_id', session.classroomId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('preference-assessment GET', error)
      return NextResponse.json({ error: '평가 목록 조회에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ assessments: data || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/preference-assessment — 평가 저장 + AI 프로필 reinforcement_preferences 반영
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
    const rawItems = body.items as PreferenceTrialInput[] | undefined

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 })
    }
    if (!Array.isArray(rawItems) || rawItems.length < 5 || rawItems.length > 8) {
      return NextResponse.json({ error: '평가 아이템은 5~8개여야 합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { ok } = await assertOwnedStudent(supabase, studentId, session.classroomId)
    if (!ok) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const inputs: PreferenceTrialInput[] = rawItems.map((row) => ({
      itemId: String(row.itemId ?? '').trim(),
      name: String(row.name ?? '').trim(),
      trials: Array.isArray(row.trials) ? row.trials : [],
    }))

    if (inputs.some((r) => !r.itemId || !r.name)) {
      return NextResponse.json({ error: '각 아이템에 itemId와 name이 필요합니다.' }, { status: 400 })
    }

    const items = summarizeItems(inputs)
    const ranked_preferences = rankPreferences(items)

    const { data: inserted, error: insErr } = await supabase
      .from('pbs_preference_assessments')
      .insert({
        student_id: studentId,
        class_code_id: session.classroomId,
        items,
        ranked_preferences,
      })
      .select('id, items, ranked_preferences, assessment_date, created_at')
      .single()

    if (insErr || !inserted) {
      console.error('preference-assessment POST insert', insErr)
      return NextResponse.json({ error: '평가 저장에 실패했습니다. DB 마이그레이션(013) 적용 여부를 확인하세요.' }, { status: 500 })
    }

    const { data: prof } = await supabase
      .from('pbs_student_ai_profiles')
      .select('student_id')
      .eq('student_id', studentId)
      .maybeSingle()

    if (prof) {
      const { error: upErr } = await supabase
        .from('pbs_student_ai_profiles')
        .update({ reinforcement_preferences: ranked_preferences })
        .eq('student_id', studentId)
      if (upErr) {
        console.error('preference-assessment profile update', upErr)
      }
    } else {
      const { error: insProfErr } = await supabase.from('pbs_student_ai_profiles').insert({
        student_id: studentId,
        class_code_id: session.classroomId,
        reinforcement_preferences: ranked_preferences,
        teacher_verified: false,
      })
      if (insProfErr) {
        console.error('preference-assessment profile insert', insProfErr)
      }
    }

    return NextResponse.json({
      assessment: inserted,
      ranked_preferences,
      profileUpdated: true,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
