import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/interventions — 중재 전략 조회
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const behaviorFunction = searchParams.get('function')

    const supabase = await createServerSupabase()

    let query = supabase
      .from('pbs_intervention_library')
      .select('*')
      .order('strategy_name')

    if (behaviorFunction) {
      // 행동 기능별 매칭된 전략 조회
      const { data: mappings } = await supabase
        .from('pbs_function_intervention_map')
        .select('intervention_id')
        .eq('behavior_function', behaviorFunction)

      if (mappings && mappings.length > 0) {
        const ids = mappings.map(m => m.intervention_id)
        query = query.in('id', ids)
      }
    }

    const { data: strategies } = await query

    return NextResponse.json({ strategies: strategies || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/interventions — 중재 전략 추가 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { 
      strategyName, 
      description, 
      evidenceLevel,
      applicableFunctions,
    } = await request.json()

    if (!strategyName || !description) {
      return NextResponse.json({ error: '전략명과 설명은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 중재 전략 저장
    const { data: strategy } = await supabase
      .from('pbs_intervention_library')
      .insert({
        strategy_name: strategyName,
        description,
        evidence_level: evidenceLevel || 'emerging',
      })
      .select()
      .single()

    // 행동 기능 매칭
    if (applicableFunctions && applicableFunctions.length > 0 && strategy) {
      const mappings = applicableFunctions.map((func: string) => ({
        intervention_id: strategy.id,
        behavior_function: func,
      }))

      await supabase
        .from('pbs_function_intervention_map')
        .insert(mappings)
    }

    return NextResponse.json({ strategy })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
