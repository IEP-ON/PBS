import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { buildFeatureOutputs, mapStudentAiProfile } from '@/lib/ai-profile'

async function fetchReferenceContext() {
  try {
    const supabase = await createServerSupabase()

    const [{ data: strategies }, { data: extinctionRisk }, { data: funcMap }] = await Promise.all([
      supabase
        .from('pbs_intervention_library')
        .select('abbreviation,name_ko,evidence_level,target_functions,description_ko,cautions,contraindicated_functions')
        .in('evidence_level', ['strong', 'moderate'])
        .order('evidence_level'),
      supabase
        .from('pbs_extinction_risk_criteria')
        .select('function_type,risk_level,burst_likelihood,recommended_preparation'),
      supabase
        .from('pbs_function_intervention_map')
        .select('function_type,intervention_abbreviation,priority,rationale')
        .order('priority'),
    ])

    const strategyMap: Record<string, string[]> = {}
    for (const row of (funcMap ?? [])) {
      if (!strategyMap[row.function_type]) strategyMap[row.function_type] = []
      strategyMap[row.function_type].push(
        `[우선순위${row.priority}] ${row.intervention_abbreviation}: ${row.rationale}`
      )
    }

    const extinctionMap: Record<string, string> = {}
    for (const row of (extinctionRisk ?? [])) {
      extinctionMap[row.function_type] =
        `위험도:${row.risk_level} / ${row.burst_likelihood ?? ''}`
    }

    const strategyDetails = (strategies ?? [])
      .map((s) => `${s.abbreviation}(${s.name_ko})[${s.evidence_level}]: ${s.description_ko.slice(0, 80)}`)
      .join('\n')

    return `
=== 근거기반 중재전략 DB (pbs_intervention_library) ===
${strategyDetails}

=== 행동 기능별 우선 전략 매핑 (pbs_function_intervention_map) ===
${Object.entries(strategyMap).map(([fn, list]) => `[${fn}]\n  ${list.join('\n  ')}`).join('\n')}

=== 소거 위험도 기준 (pbs_extinction_risk_criteria) ===
${Object.entries(extinctionMap).map(([fn, info]) => `${fn}: ${info}`).join('\n')}
`
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
    }

    const {
      studentName,
      grade,
      currentLevel,
      targetBehavior,
      antecedents,
      consequences,
      environment,
      studentId,
      optionalPrompt,
    } = await request.json()

    const supabase = await createServerSupabase()
    const [{ data: aiProfileRow }, { data: studentRow }] = await Promise.all([
      studentId
        ? supabase
            .from('pbs_student_ai_profiles')
            .select('*')
            .eq('student_id', studentId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      studentId
        ? supabase
            .from('pbs_students')
            .select('name, grade')
            .eq('id', studentId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const aiProfile = aiProfileRow ? mapStudentAiProfile(aiProfileRow as Record<string, unknown>) : null
    const featureOutputs = buildFeatureOutputs(aiProfile)

    const resolvedStudentName = studentName || studentRow?.name || null
    const resolvedGrade = grade || studentRow?.grade || null

    const resolvedCurrentLevel = currentLevel || aiProfile?.current_level_summary
    const resolvedTargetBehavior =
      targetBehavior ||
      aiProfile?.observable_behaviors?.[0] ||
      aiProfile?.positive_target_behaviors?.[0]
    const resolvedAntecedents = antecedents || aiProfile?.antecedent_patterns?.join(', ')
    const resolvedConsequences = consequences || aiProfile?.consequence_patterns?.join(', ')
    const resolvedEnvironment =
      environment ||
      [
        aiProfile?.public_safe_summary,
        aiProfile?.prevention_supports?.length
          ? `예방 지원: ${aiProfile.prevention_supports.slice(0, 3).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join(' / ')

    if (!resolvedStudentName || !resolvedCurrentLevel || !resolvedTargetBehavior) {
      return NextResponse.json({ error: '학생 이름, 현행수준, 표적행동은 필수입니다.' }, { status: 400 })
    }

    const [openai, dbContext] = await Promise.all([
      Promise.resolve(new OpenAI({ apiKey: process.env.OPENAI_API_KEY })),
      fetchReferenceContext(),
    ])

    const systemPrompt = `당신은 ABA(응용행동분석) 전문가이자 BCBA 수준의 행동 지원 계획 전문가입니다.
아래 근거기반 문헌을 기반으로 계획을 수립하세요:
- Cooper, Heron & Heward (2020) Applied Behavior Analysis 3판
- Sugai & Horner (2002) PBIS 3단계 프레임워크
- Lerman & Iwata (1995) 소거 폭발 예측 모델 — JABA 28(1),93-94
- Repp & Dietz (1974) DRO 간격 원칙 (기저선 간격 × 0.5) — JABA 7(2),313-325
- Carr & Durand (1985) FCT 원저 — JABA 18(2),111-126
- What Works Clearinghouse (IES) 근거기반 중재 목록
${dbContext ? `\n[DB에서 조회된 참조 데이터 — 이 전략 목록과 매핑을 최우선 참고하세요]\n${dbContext}` : ''}
중요 규칙:
1. 반드시 모든 필드를 한국어로 작성하세요 (영어 사용 금지).
2. pbsGoals는 최소 2개 이상 포함하세요 (대체행동 + 보완행동).
3. interventions는 최소 2개 이상 포함하세요. DB의 전략 목록에서 선택하세요.
4. tokenPerOccurrence는 100~500원 범위로 설정하세요.
5. contract의 rewardAmount는 1000~5000원 범위로 설정하세요.
6. sensory 기능으로 판단되면 소거(EXT) 절대 제안 금지.
7. interventions의 evidenceLevel은 DB의 evidence_level 값(strong/moderate/emerging)을 그대로 사용하세요.

반드시 JSON 형식으로만 응답하세요. 마크다운이나 설명 텍스트 없이 순수 JSON만 반환하세요.`

    const userPrompt = `다음 학생의 행동 지원 계획 초안을 작성해주세요:

학생: ${resolvedStudentName} (${resolvedGrade ? resolvedGrade + '학년' : '학년 미지정'})
현행수준: ${resolvedCurrentLevel}
표적 행동: ${resolvedTargetBehavior}
선행 사건: ${resolvedAntecedents || '정보 없음'}
결과 사건: ${resolvedConsequences || '정보 없음'}
환경: ${resolvedEnvironment || '정보 없음'}

학생 AI 프로필 요약:
- 학생 등록 요약: ${featureOutputs.registrationSummary}
- AI 계획 한 줄: ${featureOutputs.aiPlanOneLiner}
- 강점: ${aiProfile?.strengths?.join(', ') || '정보 없음'}
- 선호/강화물: ${aiProfile?.preferences?.join(', ') || aiProfile?.reinforcement_preferences?.join(', ') || '정보 없음'}
- 지원 필요: ${aiProfile?.support_needs?.join(', ') || '정보 없음'}
- 위험 요인: ${aiProfile?.risk_flags?.join(', ') || '정보 없음'}
- 대체행동: ${aiProfile?.replacement_behaviors?.join(', ') || '정보 없음'}
- 수업모드 목표: ${featureOutputs.classModeTargets.join(', ') || '정보 없음'}
- 촉구 후보: ${featureOutputs.pPromptOptions.join(', ') || '정보 없음'}
- 사건 태그: ${featureOutputs.incidentTags.join(', ') || '정보 없음'}
- DRO 후보: ${featureOutputs.droCandidate}

교사 추가 요청: ${optionalPrompt || '없음'}

다음 JSON 구조로 응답하세요:
{
  "fba": {
    "estimatedFunction": "attention|escape|sensory|tangible 중 하나",
    "confidence": "high|medium|low",
    "rationale": "2-3문장 분석 근거",
    "behaviorPattern": "ABC 패턴 요약"
  },
  "pbsGoals": [
    {
      "behaviorName": "목표 행동명 (관찰 가능한 형태)",
      "behaviorDefinition": "조작적 정의 (관찰·측정 가능하게)",
      "strategyType": "DRO|DRA|DRI|DRL|FCT|NCR|BC|Shaping 중 하나",
      "tokenPerOccurrence": 100~500 사이 숫자(원),
      "rationale": "이 전략을 선택한 ABA 근거"
    }
  ],
  "contract": {
    "contractTitle": "계약서 제목",
    "targetBehavior": "표적 행동",
    "behaviorDefinition": "관찰 가능한 정의",
    "measurementMethod": "측정 방법 (예: 빈도, 지속시간, 간격)",
    "achievementCriteria": "달성 기준 (예: 하루 2회 이하 3일 연속)",
    "rewardAmount": 1000~5000 사이 숫자(원),
    "teacherNote": "교사 코멘트"
  },
  "interventions": [
    {
      "strategyName": "전략명",
      "description": "구체적 적용 방법 (2-3문장)",
      "evidenceLevel": "strong|moderate|emerging 중 하나 (DB 기준)",
      "applicableFunctions": ["attention","escape","sensory","tangible"] 중 해당하는 것들
    }
  ],
  "dro": {
    "intervalMinutes": 숫자,
    "tokenReward": 100~500 사이 숫자(원),
    "rationale": "간격 설정 근거 (Repp & Dietz 원칙 적용)"
  },
  "extinctionAlert": {
    "baselineCount": 하루평균빈도추정값(숫자),
    "alertThreshold": 소거폭발임계값(숫자),
    "rationale": "Lerman & Iwata(1995) 기반 임계값 설정 근거"
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI 응답이 없습니다.' }, { status: 500 })
    }

    const plan = JSON.parse(content)

    // 생성 로그 저장 후 logId 반환 (실패해도 응답은 정상 반환)
    let logId: string | null = null
    try {
      const { data: logRow } = await supabase
        .from('pbs_ai_generation_log')
        .insert({
          classroom_id: session.classroomId,
          student_id: studentId ?? null,
          input_data: {
            studentName: resolvedStudentName,
            grade: resolvedGrade,
            currentLevel: resolvedCurrentLevel,
            targetBehavior: resolvedTargetBehavior,
            antecedents: resolvedAntecedents,
            consequences: resolvedConsequences,
            environment: resolvedEnvironment,
            aiProfileId: aiProfile?.id ?? null,
            optionalPrompt: optionalPrompt ?? null,
          },
          ai_output: plan,
          estimated_function: plan.fba?.estimatedFunction ?? null,
        })
        .select('id')
        .single()
      logId = logRow?.id ?? null
    } catch {
      // 로그 실패는 무시
    }

    return NextResponse.json({ plan, logId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('AI behavior plan error:', msg)
    return NextResponse.json({ error: `AI 분석 오류: ${msg}` }, { status: 500 })
  }
}
