import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { computeReinforcementEfficacy } from '@/lib/reinforcement-efficacy'

function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const y2 = dt.getFullYear()
  const m2 = String(dt.getMonth() + 1).padStart(2, '0')
  const d2 = String(dt.getDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

async function optionalGptLine(summary: string, include: boolean): Promise<string | null> {
  if (!include || !process.env.OPENAI_API_KEY) return null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.35,
      messages: [
        { role: 'system', content: '특수교육 PBS 강화 코치. 한국어 한 문장(95자 이내).' },
        { role: 'user', content: summary },
      ],
    })
    const t = completion.choices[0]?.message?.content?.trim()
    return t && t.length > 0 ? t.slice(0, 200) : null
  } catch {
    return null
  }
}

// POST /api/ai/reinforcement-efficacy — 목표 체크·가게 구매 기반 강화 효과성(휴리스틱)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
    const days = typeof body.days === 'number' && body.days > 0 && body.days <= 120 ? Math.floor(body.days) : 30
    const includeRecommendation =
      body.includeRecommendation === true || body.include_recommendation === true

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 })
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

    const today = new Date()
    const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const startStr = addDaysLocal(endStr, -(days - 1))

    const [{ data: records, error: recErr }, { data: txsRaw, error: txErr }] = await Promise.all([
      supabase
        .from('pbs_records')
        .select('record_date, occurrence_count, goal_id, pbs_goals(behavior_name)')
        .eq('student_id', studentId)
        .gte('record_date', startStr)
        .lte('record_date', endStr)
        .order('record_date', { ascending: true }),
      supabase
        .from('pbs_transactions')
        .select('created_at, type')
        .eq('student_id', studentId)
        .in('type', ['purchase', 'gift_sent'])
        .order('created_at', { ascending: true }),
    ])

    const txs = (txsRaw || []).filter((t) => {
      const ds = typeof t.created_at === 'string' ? t.created_at.slice(0, 10) : ''
      return ds >= startStr && ds <= endStr
    })

    if (recErr) {
      console.error('reinforcement-efficacy records', recErr)
      return NextResponse.json({ error: 'PBS 기록 조회에 실패했습니다.' }, { status: 500 })
    }

    const dateSet = new Set<string>()
    const dailyByGoal = new Map<string, { goalName: string; days: Map<string, number> }>()

    for (const row of records || []) {
      const gid = row.goal_id as string
      const d = row.record_date as string
      dateSet.add(d)
      const joined = row.pbs_goals as unknown
      let goalName = '목표'
      if (joined && typeof joined === 'object' && !Array.isArray(joined)) {
        goalName = String((joined as { behavior_name?: string }).behavior_name || goalName)
      } else if (Array.isArray(joined) && joined[0]) {
        goalName = String((joined[0] as { behavior_name?: string }).behavior_name || goalName)
      }
      const occ = Number(row.occurrence_count) || 0
      if (!dailyByGoal.has(gid)) {
        dailyByGoal.set(gid, { goalName, days: new Map() })
      }
      const g = dailyByGoal.get(gid)!
      g.days.set(d, (g.days.get(d) || 0) + occ)
    }

    const sortedDates = [...dateSet].sort()

    const midDate = sortedDates[Math.floor(sortedDates.length / 2)] ?? sortedDates[0]
    let purchaseCountEarly = 0
    let purchaseCountLate = 0
    if (!txErr) {
      for (const t of txs) {
        const ds = (t.created_at as string)?.slice(0, 10)
        if (!ds) continue
        if (ds < midDate) purchaseCountEarly++
        else purchaseCountLate++
      }
    }

    const { efficacy, heuristicRecommendation } = computeReinforcementEfficacy({
      dailyByGoal,
      purchaseCountEarly,
      purchaseCountLate,
      sortedDates,
    })

    let recommendation = heuristicRecommendation
    if (includeRecommendation) {
      const summary = `기간 ${startStr}~${endStr}, 구매(초반/후반) ${purchaseCountEarly}/${purchaseCountLate}. 목표별 효과: ${efficacy
        .slice(0, 4)
        .map((e) => `${e.goalName}:${e.effectSize}`)
        .join(', ')}. 위 권고를 한 문장으로.`
      const gpt = await optionalGptLine(summary, true)
      if (gpt) recommendation = gpt
    }

    return NextResponse.json({
      studentId,
      dateFrom: startStr,
      dateTo: endStr,
      days,
      purchaseCountEarly,
      purchaseCountLate,
      efficacy,
      recommendation,
    })
  } catch (e) {
    console.error('reinforcement-efficacy', e)
    return NextResponse.json({ error: '강화 효과성 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
