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

type NcrScheduleNormalized = {
  intervalMinutes: number
  reinforcerType: 'attention' | 'tangible' | 'activity'
  description: string
  rationale: string
}

function normalizeNcrSchedule(raw: unknown, estimatedFunction: string): NcrScheduleNormalized | null {
  const fn = String(estimatedFunction || '').trim().toLowerCase()
  if (fn !== 'attention' && fn !== 'tangible') return null
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.intervalMinutes === null || o.intervalMinutes === undefined) return null
  const intervalRaw =
    typeof o.intervalMinutes === 'number' && Number.isFinite(o.intervalMinutes)
      ? Math.floor(o.intervalMinutes)
      : null
  if (intervalRaw === null || intervalRaw <= 0) return null
  const intervalMinutes = Math.min(180, Math.max(3, intervalRaw))
  const rt = typeof o.reinforcerType === 'string' ? o.reinforcerType.trim().toLowerCase() : 'attention'
  const reinforcerType =
    rt === 'tangible' || rt === 'activity' ? (rt as 'tangible' | 'activity') : 'attention'
  return {
    intervalMinutes,
    reinforcerType,
    description:
      typeof o.description === 'string' ? o.description.slice(0, 500) : '비수반 강화 일정',
    rationale: typeof o.rationale === 'string' ? o.rationale.slice(0, 500) : '',
  }
}

type ScheduleFadingNormalized = {
  currentSchedule: string
  targetSchedule: string
  criterionToFade: string
  steps: string[]
  rationale: string
}

function normalizeScheduleFading(raw: unknown): ScheduleFadingNormalized {
  if (!raw || typeof raw !== 'object') {
    return {
      currentSchedule: 'FR1 (매 목표 체크 시 토큰)',
      targetSchedule: 'VR5 (평균 5회당 1회 강화)',
      criterionToFade: '일일 목표 5일 연속 달성 시 다음 단계 검토',
      steps: ['FR1 고정비율', 'FR2로 증가', 'VR3 전환', '목표 VR/VI'],
      rationale: 'Ferster & Skinner (1957) 고정·변간 강화 및 희석 원칙.',
    }
  }
  const o = raw as Record<string, unknown>
  const steps = Array.isArray(o.steps)
    ? o.steps.map((s) => String(s).trim().slice(0, 220)).filter(Boolean).slice(0, 14)
    : []
  return {
    currentSchedule:
      typeof o.currentSchedule === 'string' && o.currentSchedule.trim()
        ? o.currentSchedule.trim().slice(0, 400)
        : 'FR1 (매 체크 강화)',
    targetSchedule:
      typeof o.targetSchedule === 'string' && o.targetSchedule.trim()
        ? o.targetSchedule.trim().slice(0, 400)
        : 'VR5',
    criterionToFade:
      typeof o.criterionToFade === 'string' && o.criterionToFade.trim()
        ? o.criterionToFade.trim().slice(0, 600)
        : '교사가 일일 기록을 보고 단계 전환',
    steps: steps.length > 0 ? steps : ['현재 일정 유지', '달성도 확인 후 희석'],
    rationale:
      typeof o.rationale === 'string' && o.rationale.trim()
        ? o.rationale.trim().slice(0, 900)
        : 'Ferster & Skinner (1957) 기반.',
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
2. pbsGoals는 최소 2개 이상 포함하세요 (대체행동 + 보완행동). 각 목표에 dailyTarget(하루 달성 목표 횟수, 3~10 정수)을 포함하세요.
3. interventions는 최소 2개 이상 포함하세요. DB의 전략 목록에서 선택하세요.
4. tokenPerOccurrence는 100~500원 범위로 설정하세요.
5. contract의 rewardAmount는 1000~5000원 범위로 설정하세요.
6. sensory 기능으로 판단되면 소거(EXT) 절대 제안 금지.
7. interventions의 evidenceLevel은 DB의 evidence_level 값(strong/moderate/emerging)을 그대로 사용하세요.
8. estimatedFunction이 attention 또는 tangible이면 루트에 ncrSchedule 객체를 반드시 포함하고, pbsGoals에 strategyType이 NCR인 목표를 정확히 1개 포함하세요. NCR 목표는 예방적 비수반 강화(선제적 관심·선호자원 접근)를 관찰 가능한 행동으로 정의하세요.
9. estimatedFunction이 escape 또는 sensory이면 ncrSchedule은 null이고, NCR 전략 목표는 포함하지 마세요.
10. 루트에 scheduleFading 객체를 반드시 포함하세요. 토큰경제의 강화 일정(FR/VR/VI 등)을 현재→목표로 희석하는 단계·전환 기준·근거(Ferster & Skinner, 1957)를 한국어로 채웁니다.

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
      "dailyTarget": 3~10 사이 정수(하루 목표 횟수),
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
  },
  "ncrSchedule": {
    "intervalMinutes": "3~30 사이 정수(분 단위, 비수반 강화 제공 간격)",
    "reinforcerType": "attention|tangible|activity 중 하나",
    "description": "교사가 수업 중 실행할 NCR 절차 (1-2문장)",
    "rationale": "간격 설정 근거 (기저선 간격의 70~80% 수준 권장)"
  },
  "scheduleFading": {
    "currentSchedule": "예: FR1 매 체크마다 강화",
    "targetSchedule": "예: VR5 평균 5회에 1회 강화",
    "criterionToFade": "전환 기준 (예: 5일 연속 dailyTarget 달성 시)",
    "steps": ["FR1→FR2→VR3→목표 스케줄"],
    "rationale": "Ferster & Skinner (1957) 고정·변간 강화 일정 희석 원칙에 따른 근거"
  }
}
또는 escape/sensory인 경우 ncrSchedule은 null로 두세요. scheduleFading은 항상 포함하세요.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 3400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI 응답이 없습니다.' }, { status: 500 })
    }

    const plan = JSON.parse(content) as Record<string, unknown>
    const estFn = String((plan.fba as Record<string, unknown> | undefined)?.estimatedFunction ?? '')
    plan.ncrSchedule = normalizeNcrSchedule(plan.ncrSchedule, estFn)
    plan.scheduleFading = normalizeScheduleFading(plan.scheduleFading)

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
          estimated_function:
            (plan.fba as Record<string, unknown> | undefined)?.estimatedFunction != null
              ? String((plan.fba as Record<string, unknown>).estimatedFunction)
              : null,
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
