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
      .select('id, name_ko, name_en, abbreviation, evidence_level, description_ko, target_functions, cautions')
      .order('evidence_level')
      .order('name_ko')

    if (behaviorFunction) {
      // 기능-전략 매핑 테이블에서 우선순위 기준 abbreviation 조회
      const { data: mappings } = await supabase
        .from('pbs_function_intervention_map')
        .select('intervention_abbreviation')
        .eq('function_type', behaviorFunction)
        .order('priority')

      if (mappings && mappings.length > 0) {
        const abbreviations = mappings.map(m => m.intervention_abbreviation)
        query = query.in('abbreviation', abbreviations)
      }
    }

    const { data: strategies } = await query

    // fba/page.tsx 등 이전 코드와의 호환을 위해 strategy_name 필드도 병기
    const result = (strategies || []).map(s => ({
      ...s,
      strategy_name: s.name_ko,
      description: s.description_ko,
    }))

    return NextResponse.json({ strategies: result })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/interventions — AI 생성 또는 교사 추가 중재 전략
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

    // 동일 이름 전략이 이미 있으면 중복 저장 방지
    const { data: existing } = await supabase
      .from('pbs_intervention_library')
      .select('id, name_ko')
      .eq('name_ko', strategyName)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ strategy: existing, duplicate: true })
    }

    // abbreviation 자동 생성 (고유성 보장)
    const baseAbbr = strategyName
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9가-힣]/g, '')
      .substring(0, 12)
    const abbreviation = `${baseAbbr}_${Date.now().toString(36).slice(-4)}`

    const level = ['strong', 'moderate', 'emerging'].includes(evidenceLevel)
      ? evidenceLevel
      : 'emerging'

    const { data: strategy, error } = await supabase
      .from('pbs_intervention_library')
      .insert({
        name_ko: strategyName,
        name_en: strategyName,
        abbreviation,
        category: 'AI생성',
        target_functions: applicableFunctions || [],
        evidence_level: level,
        evidence_basis: level === 'strong'
          ? 'Cooper, Heron & Heward (2020) ABA 3판'
          : 'AI 행동 지원 계획 기반',
        description_ko: description,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 행동 기능 매핑 저장 (AI 생성은 낮은 우선순위 3)
    if (applicableFunctions && applicableFunctions.length > 0 && strategy) {
      const mappings = applicableFunctions.map((func: string) => ({
        function_type: func,
        intervention_abbreviation: abbreviation,
        priority: 3,
        rationale: `AI 행동 지원 계획 자동 생성`,
      }))

      await supabase
        .from('pbs_function_intervention_map')
        .upsert(mappings, { onConflict: 'function_type,intervention_abbreviation' })
    }

    return NextResponse.json({ strategy })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
