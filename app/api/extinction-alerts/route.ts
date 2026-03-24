import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/extinction-alerts — 소거 알림 조회
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const showResolved = searchParams.get('showResolved') === 'true'

    const supabase = await createServerSupabase()

    let query = supabase
      .from('pbs_extinction_alerts')
      .select('*, pbs_students(name), pbs_goals(behavior_name)')
      .order('created_at', { ascending: false })

    if (!showResolved) {
      query = query.eq('is_resolved', false)
    }

    const { data: alerts } = await query

    return NextResponse.json({ alerts: alerts || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/extinction-alerts — 소거 위험 자동 감지 (크론 작업용)
export async function POST(request: Request) {
  try {
    const { cronSecret } = await request.json()

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    // 최근 7일간 PBS 기록 조회
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: goals } = await supabase
      .from('pbs_goals')
      .select('id, student_id, behavior_name, is_active')
      .eq('is_active', true)

    if (!goals || goals.length === 0) {
      return NextResponse.json({ message: '활성 목표 없음', detected: 0 })
    }

    let detectedCount = 0

    for (const goal of goals) {
      // 최근 7일간 기록 조회
      const { data: records } = await supabase
        .from('pbs_records')
        .select('occurrence_count, record_date')
        .eq('goal_id', goal.id)
        .gte('record_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('record_date', { ascending: true })

      if (!records || records.length < 3) continue

      // 소거 폭발 패턴 감지: 최근 3일 연속 감소
      const recent3 = records.slice(-3)
      const isDecreasing = recent3.every((r, i) => 
        i === 0 || r.occurrence_count < recent3[i - 1].occurrence_count
      )

      // 급격한 증가 후 감소 패턴
      const hasSpike = records.some((r, i) => 
        i > 0 && r.occurrence_count > records[i - 1].occurrence_count * 1.5
      )

      if (isDecreasing && hasSpike) {
        // 기존 미해결 알림 확인
        const { data: existing } = await supabase
          .from('pbs_extinction_alerts')
          .select('id')
          .eq('goal_id', goal.id)
          .eq('is_resolved', false)
          .single()

        if (!existing) {
          await supabase.from('pbs_extinction_alerts').insert({
            student_id: goal.student_id,
            goal_id: goal.id,
            alert_type: 'extinction_burst',
            risk_level: 'medium',
            description: `${goal.behavior_name}: 소거 폭발 패턴 감지 (급증 후 연속 감소)`,
            gpt_recommendation: '소거 절차 지속, 대체 행동 강화 권장',
          })
          detectedCount++
        }
      }
    }

    return NextResponse.json({ 
      message: '소거 위험 감지 완료',
      detected: detectedCount,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/extinction-alerts — 알림 해결 처리
export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { alertId } = await request.json()

    if (!alertId) {
      return NextResponse.json({ error: '알림 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: alert } = await supabase
      .from('pbs_extinction_alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .select()
      .single()

    return NextResponse.json({ alert })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
