import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { computeTeachProgress, heuristicTeachRecommendation, type TeachProgressRecord } from '@/lib/teach-progress'

function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const y2 = dt.getFullYear()
  const m2 = String(dt.getMonth() + 1).padStart(2, '0')
  const d2 = String(dt.getDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

async function optionalGptRecommendation(summary: string, include: boolean): Promise<string | null> {
  if (!include || !process.env.OPENAI_API_KEY) return null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: '특수교육 ABA 촉구 페이딩 코치. 한국어 한 문장(90자 이내)만.',
        },
        { role: 'user', content: `다음 집계에 따른 교사 권고 한 줄: ${summary}` },
      ],
    })
    const t = completion.choices[0]?.message?.content?.trim()
    return t && t.length > 0 ? t.slice(0, 200) : null
  } catch {
    return null
  }
}

// POST /api/ai/teach-progress — 촉구 진행도(서버 집계, GPT 권고 선택)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
    const goalId = typeof body.goalId === 'string' ? body.goalId.trim() : ''
    const days = typeof body.days === 'number' && body.days > 0 && body.days <= 90 ? Math.floor(body.days) : 14
    const includeRecommendation =
      body.includeRecommendation === true || body.include_recommendation === true

    if (!studentId || !goalId) {
      return NextResponse.json({ error: 'studentId와 goalId는 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: student, error: stErr } = await supabase
      .from('pbs_students')
      .select('id')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .maybeSingle()

    if (stErr || !student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: goal, error: gErr } = await supabase
      .from('pbs_goals')
      .select('id, student_id, behavior_name')
      .eq('id', goalId)
      .eq('class_code_id', session.classroomId)
      .maybeSingle()

    if (gErr || !goal || goal.student_id !== studentId) {
      return NextResponse.json({ error: '목표를 찾을 수 없거나 학생과 일치하지 않습니다.' }, { status: 404 })
    }

    const today = new Date()
    const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const startStr = addDaysLocal(endStr, -(days - 1))

    const { data: rows, error: rErr } = await supabase
      .from('pbs_records')
      .select('record_date, prompt_level')
      .eq('student_id', studentId)
      .eq('goal_id', goalId)
      .gte('record_date', startStr)
      .lte('record_date', endStr)
      .order('record_date', { ascending: true })

    if (rErr) {
      console.error('teach-progress', rErr)
      return NextResponse.json({ error: '기록 조회에 실패했습니다.' }, { status: 500 })
    }

    const records = (rows ?? []) as TeachProgressRecord[]
    const progress = computeTeachProgress(records)

    let recommendation = heuristicTeachRecommendation(progress)
    if (includeRecommendation) {
      const summary = `기간 ${startStr}~${endStr}, N=${progress.totalRecords}, 분포 full/partial/gesture/indep=${progress.levelDistribution.full}/${progress.levelDistribution.partial}/${progress.levelDistribution.gesture}/${progress.levelDistribution.independent}, 독립률 ${progress.independenceRate}%, 추세 ${progress.trend}, 페이딩준비 ${progress.readyToFade}`
      const gpt = await optionalGptRecommendation(summary, true)
      if (gpt) recommendation = gpt
    }

    return NextResponse.json({
      goalId,
      studentId,
      behaviorName: goal.behavior_name,
      dateFrom: startStr,
      dateTo: endStr,
      days,
      progress,
      recommendation,
    })
  } catch (e) {
    console.error('teach-progress', e)
    return NextResponse.json({ error: '촉구 진행도 계산 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
