import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import OpenAI from 'openai'

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
    } = await request.json()

    if (!studentName || !currentLevel || !targetBehavior) {
      return NextResponse.json({ error: '학생 이름, 현행수준, 표적행동은 필수입니다.' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = `당신은 ABA(응용행동분석) 전문가이자 BCBA 수준의 행동 지원 계획 전문가입니다.
다음 근거기반 문헌과 프레임워크를 기반으로 계획을 수립하세요:
- Cooper, Heron & Heward (2020) Applied Behavior Analysis 3판
- Sugai & Horner (2002) PBIS (긍정적 행동 지원) 3단계 프레임워크
- Lerman & Iwata (1995) 소거 폭발(Extinction Burst) 예측 모델
- Repp & Dietz (1974) DRO 간격 설정 원칙 (기저선 빈도의 1/2 간격 권장)
- What Works Clearinghouse (IES) 근거기반 중재 목록

반드시 JSON 형식으로만 응답하세요. 마크다운이나 설명 텍스트 없이 순수 JSON만 반환하세요.`

    const userPrompt = `다음 학생의 행동 지원 계획 초안을 작성해주세요:

학생: ${studentName} (${grade ? grade + '학년' : '학년 미지정'})
현행수준: ${currentLevel}
표적 행동: ${targetBehavior}
선행 사건: ${antecedents || '정보 없음'}
결과 사건: ${consequences || '정보 없음'}
환경: ${environment || '정보 없음'}

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
      "tokenPerOccurrence": 숫자,
      "rationale": "이 전략을 선택한 ABA 근거"
    }
  ],
  "contract": {
    "contractTitle": "계약서 제목",
    "targetBehavior": "표적 행동",
    "behaviorDefinition": "관찰 가능한 정의",
    "measurementMethod": "측정 방법 (예: 빈도, 지속시간, 간격)",
    "achievementCriteria": "달성 기준 (예: 하루 2회 이하 3일 연속)",
    "rewardAmount": 숫자,
    "teacherNote": "교사 코멘트"
  },
  "interventions": [
    {
      "strategyName": "전략명",
      "description": "구체적 적용 방법 (2-3문장)",
      "evidenceLevel": "evidence-based|promising|emerging",
      "applicableFunctions": ["attention","escape","sensory","tangible"] 중 해당하는 것들
    }
  ],
  "dro": {
    "intervalMinutes": 숫자,
    "tokenReward": 숫자,
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
    return NextResponse.json({ plan })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('AI behavior plan error:', msg)
    return NextResponse.json({ error: `AI 분석 오류: ${msg}` }, { status: 500 })
  }
}
