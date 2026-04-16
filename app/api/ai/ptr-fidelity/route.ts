import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  computePtrFidelity,
  heuristicPtrRecommendation,
  type PtrFidelityGoal,
  type PtrFidelityRecord,
} from '@/lib/ptr-fidelity'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const KST = '+09:00'

function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const y2 = dt.getFullYear()
  const m2 = String(dt.getMonth() + 1).padStart(2, '0')
  const d2 = String(dt.getDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

/** 주간 트랜잭션 조회용: KST 자정~23:59:59.999 를 UTC ISO로 변환 */
function kstRangeToIsoUtc(weekStart: string, weekEnd: string): { start: string; end: string } {
  const start = new Date(`${weekStart}T00:00:00${KST}`)
  const end = new Date(`${weekEnd}T23:59:59.999${KST}`)
  return { start: start.toISOString(), end: end.toISOString() }
}

function normalizeDateInput(s: unknown): string | null {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return s
}

async function fetchOptionalRecommendation(
  summary: string,
  include: boolean
): Promise<string | null> {
  if (!include || !process.env.OPENAI_API_KEY) return null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            '당신은 특수교육 현장의 PBS·PTR 코치다. 한 문장(90자 이내)으로만 답한다. 추측보다 주어진 수치에 근거한다.',
        },
        {
          role: 'user',
          content: `다음 PTR 충실도 요약을 보고 교사에게 한 줄 실천 권고를 한국어로: ${summary}`,
        },
      ],
    })
    const t = completion.choices[0]?.message?.content?.trim()
    return t && t.length > 0 ? t.slice(0, 200) : null
  } catch {
    return null
  }
}

// POST /api/ai/ptr-fidelity — PTR 실행 충실도(서버 산출, GPT 권고는 선택)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
    const weekStartRaw = body.weekStart ?? body.week_start
    const weekStart = normalizeDateInput(weekStartRaw)
    const includeRecommendation =
      body.includeRecommendation === true || body.include_recommendation === true

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 })
    }
    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart는 YYYY-MM-DD 형식이어야 합니다.' }, { status: 400 })
    }

    const weekEnd = addDaysLocal(weekStart, 6)
    const txRange = kstRangeToIsoUtc(weekStart, weekEnd)
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

    const [recordsRes, goalsRes, profileRes, txRes] = await Promise.all([
      supabase
        .from('pbs_records')
        .select('occurrence_count, antecedent_tag, prompt_level, token_granted, is_settled')
        .eq('student_id', studentId)
        .gte('record_date', weekStart)
        .lte('record_date', weekEnd),
      supabase
        .from('pbs_goals')
        .select('daily_target')
        .eq('student_id', studentId)
        .eq('is_active', true),
      supabase.from('pbs_student_ai_profiles').select('prevention_supports').eq('student_id', studentId).maybeSingle(),
      supabase
        .from('pbs_transactions')
        .select('id, created_at')
        .eq('student_id', studentId)
        .eq('type', 'salary_pbs')
        .gte('created_at', txRange.start)
        .lte('created_at', txRange.end),
    ])

    if (recordsRes.error) {
      console.error('ptr-fidelity records', recordsRes.error)
      return NextResponse.json({ error: 'PBS 기록 조회에 실패했습니다.' }, { status: 500 })
    }
    if (goalsRes.error) {
      console.error('ptr-fidelity goals', goalsRes.error)
      return NextResponse.json({ error: '목표 조회에 실패했습니다.' }, { status: 500 })
    }

    const records = (recordsRes.data ?? []) as PtrFidelityRecord[]
    const goals = (goalsRes.data ?? []) as PtrFidelityGoal[]
    const rawPrev = profileRes.data?.prevention_supports
    const preventionSupports = Array.isArray(rawPrev) ? (rawPrev as string[]) : []

    const salaryPbsInWeek = txRes.error ? 0 : txRes.data?.length ?? 0

    const computed = computePtrFidelity({
      records,
      preventionSupports,
      goals,
      salaryPbsInWeek,
      weekStart,
      weekEnd,
    })

    let recommendation = heuristicPtrRecommendation(computed)
    if (includeRecommendation) {
      const summary = `Prevent ${computed.fidelity.prevent.score} (${computed.fidelity.prevent.antecedentTagRate}% 태그), Teach ${computed.fidelity.teach.score} (${computed.fidelity.teach.promptLevelRate}% 촉구기록, 독립 ${computed.fidelity.teach.independenceRate}%), Reinforce ${computed.fidelity.reinforce.score} (목표대비 ${computed.fidelity.reinforce.goalCheckRate}%, 정산지표 ${computed.fidelity.reinforce.settlementRate}%). 경고: ${computed.warnings.slice(0, 2).join('; ') || '없음'}.`
      const gpt = await fetchOptionalRecommendation(summary, true)
      if (gpt) recommendation = gpt
    }

    return NextResponse.json({
      weekStart,
      weekEnd,
      recordCount: records.length,
      fidelity: computed.fidelity,
      warnings: computed.warnings,
      recommendation,
    })
  } catch (e) {
    console.error('ptr-fidelity', e)
    return NextResponse.json({ error: 'PTR 충실도 계산 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
