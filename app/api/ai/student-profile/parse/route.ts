import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { sanitizeAiProfilePayload } from '@/lib/ai-profile'

async function fetchProfileReferenceContext() {
  try {
    const supabase = await createServerSupabase()
    const [{ data: functions }, { data: ethics }] = await Promise.all([
      supabase
        .from('pbs_behavior_functions')
        .select('function_type,name_ko,detection_signals,common_antecedents,common_consequences'),
      supabase
        .from('pbs_ethics_guidelines')
        .select('category,guideline_ko,ai_prompt_rule')
        .order('category'),
    ])

    return [
      '=== 행동 기능 분류 기준 ===',
      ...(functions || []).map(
        (row) =>
          `[${row.function_type}/${row.name_ko}] 신호: ${(row.detection_signals || []).join(', ')} / 선행: ${(row.common_antecedents || []).join(', ')} / 결과: ${(row.common_consequences || []).join(', ')}`
      ),
      '=== 윤리 가드레일 ===',
      ...(ethics || []).map((row) => `(${row.category}) ${row.guideline_ko}`),
    ].join('\n')
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

    const { studentId, studentName, grade, freeText } = await request.json()

    if (!studentId || !freeText || freeText.trim().length < 20) {
      return NextResponse.json({ error: '학생 정보와 20자 이상의 자유입력이 필요합니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, grade, class_code_id')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const referenceContext = await fetchProfileReferenceContext()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2600,
      messages: [
        {
          role: 'system',
          content: `당신은 특수교육 학생 지원 정보를 구조화하는 ABA/PBS 전문가입니다.
교사의 자유서술을 학생별 AI 프로필 초안으로 정리하세요.

적용 근거:
- Cooper, Heron & Heward (2020) ABA 3판
- O'Neill et al. (1997) Functional Assessment and Program Development
- Bijou, Peterson & Ault (1968) descriptive analysis
- Sugai & Horner (2002) PBIS
- Carr & Durand (1985) FCT
- Repp & Dietz (1974) DRO
- Lerman & Iwata (1995) extinction burst
${referenceContext ? `\n${referenceContext}` : ''}

핵심 규칙:
1. 학생의 강점과 선호를 먼저 구조화합니다.
2. 관찰 사실과 추론을 구분합니다.
3. 없는 정보는 지어내지 말고 빈값 또는 빈 배열로 둡니다.
4. 위험요인, 감각 기능, 자해/타해는 안전 플래그를 우선 정리합니다.
5. follow_up_questions는 정말 필요한 누락 정보만 2~4개 생성합니다.
6. public_safe_summary에는 학생에게 보여도 안전한 표현만 넣고, 민감한 위험요인은 제외합니다.
7. private_teacher_notes에는 교사용 주의 메모를 짧게 정리합니다.

반드시 아래 JSON 형태만 반환하세요:
{
  "profile": {
    "current_level_summary": "string",
    "strengths": ["string"],
    "preferences": ["string"],
    "student_voice_keywords": ["string"],
    "support_needs": ["string"],
    "risk_flags": ["string"],
    "observable_behaviors": ["string"],
    "antecedent_patterns": ["string"],
    "consequence_patterns": ["string"],
    "hypothesized_functions": ["attention|escape|sensory|tangible"],
    "replacement_behaviors": ["string"],
    "positive_target_behaviors": ["string"],
    "prevention_supports": ["string"],
    "reinforcement_preferences": ["string"],
    "incident_tags": ["string"],
    "class_mode_targets": ["string"],
    "p_prompt_options": ["string"],
    "dro_candidate": "string",
    "student_registration_summary": "string",
    "ai_plan_one_liner": "string",
    "public_safe_summary": "string",
    "private_teacher_notes": "string"
  },
  "confidence_by_field": {
    "field_name": "high|medium|low"
  },
  "follow_up_questions": [
    {
      "id": "q1",
      "question": "string",
      "reason": "string",
      "target_field": "string"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `학생 이름: ${studentName || student.name}
학년: ${grade || student.grade || '미입력'}
자유입력:
${freeText}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI 응답이 없습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    const profile = sanitizeAiProfilePayload(parsed.profile ?? {}, {
      sourceFreeText: freeText,
      teacherVerified: false,
    })

    return NextResponse.json({
      draft: {
        profile,
        follow_up_questions: profile.generated_follow_up_questions,
        confidence_by_field: profile.confidence_by_field,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('student-profile parse error:', msg)
    return NextResponse.json({ error: `AI 구조화 오류: ${msg}` }, { status: 500 })
  }
}
