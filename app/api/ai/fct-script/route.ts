import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { normalizeStringArray } from '@/lib/ai-profile'

const PROMPT_LEVELS = ['full', 'partial', 'gesture', 'independent'] as const
type PromptLevel = (typeof PROMPT_LEVELS)[number]

function normalizePromptLevel(v: unknown): PromptLevel {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return PROMPT_LEVELS.includes(s as PromptLevel) ? (s as PromptLevel) : 'full'
}

function defaultNextLevel(current: PromptLevel): PromptLevel {
  const i = PROMPT_LEVELS.indexOf(current)
  if (i < 0 || i >= PROMPT_LEVELS.length - 1) return 'independent'
  return PROMPT_LEVELS[i + 1]
}

type FctScript = {
  setup: string
  prompt: string
  expectedResponse: string
  reinforcement: string
  errorCorrection: string
}

type FadingPlan = {
  currentLevel: PromptLevel
  nextLevel: PromptLevel
  criterionToAdvance: string
  rationale: string
}

function asStr(v: unknown, max = 1200): string {
  if (typeof v !== 'string') return ''
  return v.trim().slice(0, max)
}

function parseAiPayload(raw: Record<string, unknown>, fallbackCurrent: PromptLevel): { script: FctScript; fadingPlan: FadingPlan } {
  const scriptRaw = (raw.script && typeof raw.script === 'object' ? raw.script : {}) as Record<string, unknown>
  const fadeRaw = (raw.fadingPlan && typeof raw.fadingPlan === 'object' ? raw.fadingPlan : {}) as Record<string, unknown>

  const script: FctScript = {
    setup: asStr(scriptRaw.setup, 800),
    prompt: asStr(scriptRaw.prompt, 800),
    expectedResponse: asStr(scriptRaw.expectedResponse, 600),
    reinforcement: asStr(scriptRaw.reinforcement, 800),
    errorCorrection: asStr(scriptRaw.errorCorrection, 800),
  }

  const currentLevel = normalizePromptLevel(fadeRaw.currentLevel || fallbackCurrent)
  let nextLevel = normalizePromptLevel(fadeRaw.nextLevel)
  if (nextLevel === currentLevel && currentLevel !== 'independent') {
    nextLevel = defaultNextLevel(currentLevel)
  }
  const idxNext = PROMPT_LEVELS.indexOf(nextLevel)
  const idxCur = PROMPT_LEVELS.indexOf(currentLevel)
  if (idxNext < idxCur) nextLevel = defaultNextLevel(currentLevel)

  const fadingPlan: FadingPlan = {
    currentLevel,
    nextLevel,
    criterionToAdvance: asStr(fadeRaw.criterionToAdvance, 500) || '교사가 일일 기록을 보고 전문가와 협의해 기준을 정합니다.',
    rationale: asStr(fadeRaw.rationale, 800) || 'Carr & Durand(1985) FCT 및 Cooper et al.(2020) 촉구 페이딩 원칙.',
  }

  return { script, fadingPlan }
}

// POST /api/ai/fct-script — FCT 교수 시나리오 + 촉구 페이딩 힌트 (GPT 1회)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
    const replacementBehavior =
      typeof body.replacementBehavior === 'string' ? body.replacementBehavior.trim() : ''
    const behaviorFunction =
      typeof body.behaviorFunction === 'string' ? body.behaviorFunction.trim().toLowerCase() : 'attention'
    const currentPromptLevel = normalizePromptLevel(body.currentPromptLevel ?? body.current_prompt_level)

    let antecedentPatterns: string[] = Array.isArray(body.antecedentPatterns)
      ? normalizeStringArray(body.antecedentPatterns)
      : normalizeStringArray(body.antecedent_patterns)

    if (!studentId || !replacementBehavior) {
      return NextResponse.json({ error: 'studentId와 replacementBehavior는 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { data: student, error: stErr } = await supabase
      .from('pbs_students')
      .select('id, name')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .maybeSingle()

    if (stErr || !student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (antecedentPatterns.length === 0) {
      const { data: prof } = await supabase
        .from('pbs_student_ai_profiles')
        .select('antecedent_patterns')
        .eq('student_id', studentId)
        .maybeSingle()
      antecedentPatterns = normalizeStringArray(prof?.antecedent_patterns)
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = `당신은 특수교육 현장의 ABA·PBS 전문가다. 출력은 반드시 JSON 한 덩어리뿐이다.
참고 문헌: Carr & Durand (1985) FCT 원저; Cooper, Heron & Heward (2020) Applied Behavior Analysis 14장(대체행동·촉구 페이딩).
맥락: 한국 학급의 토큰경제(PBS 체크)와 연계해 강화를 구체적으로 쓴다.
언어: 한국어. 문장은 실행 가능하게 짧고 단계적으로.`

    const userPrompt = `학생 이름(참고): ${student.name}
대체 의사소통 행동(FCT 표적): ${replacementBehavior}
추정/가정 행동 기능: ${behaviorFunction} (attention|escape|tangible|sensory 중 하나로 해석)
현재 촉구 단계: ${currentPromptLevel} (full=전체 촉구, partial=부분, gesture=제스처, independent=독립)
선행 패턴 힌트(프로필): ${antecedentPatterns.length ? antecedentPatterns.slice(0, 8).join(' | ') : '(없음 — 일반적 교실 상황 가정)'}

다음 JSON 스키마로만 응답하라 (다른 키·설명 금지):
{
  "script": {
    "setup": "상황 설정(환경·선행 조건·교사 준비)",
    "prompt": "촉구 제공 절차(현재 촉구 단계에 맞게)",
    "expectedResponse": "학생의 적응적 반응 예시",
    "reinforcement": "토큰경제(PBS 체크)와 연결한 즉시·자연 강화",
    "errorCorrection": "무반응·문제행동 시 오류 수정(최소 억제, FCT 재촉구)"
  },
  "fadingPlan": {
    "currentLevel": "${currentPromptLevel}",
    "nextLevel": "한 단계 덜 직접적인 촉구로 제안 (independent면 independent 유지)",
    "criterionToAdvance": "다음 단계로 넘어갈 관찰 가능한 기준(예: 3교시 연속 80% 독립)",
    "rationale": "페이딩 근거 한두 문장"
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0.35,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI 응답이 없습니다.' }, { status: 500 })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'AI JSON 파싱에 실패했습니다.' }, { status: 500 })
    }

    const { script, fadingPlan } = parseAiPayload(parsed, currentPromptLevel)

    const emptyFields = ['setup', 'prompt', 'expectedResponse', 'reinforcement', 'errorCorrection'].filter(
      (k) => !script[k as keyof FctScript]
    )
    if (emptyFields.length >= 3) {
      return NextResponse.json({ error: 'AI 시나리오가 불완전합니다. 다시 시도해 주세요.' }, { status: 502 })
    }

    return NextResponse.json({
      studentId,
      replacementBehavior,
      behaviorFunction,
      antecedentPatterns,
      script,
      fadingPlan,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('fct-script', msg)
    return NextResponse.json({ error: `FCT 시나리오 생성 오류: ${msg}` }, { status: 500 })
  }
}
