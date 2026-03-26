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

    const { freeText, studentName, grade } = await request.json()

    if (!freeText || freeText.trim().length < 10) {
      return NextResponse.json({ error: '학생에 대한 설명을 10자 이상 입력해주세요.' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = `당신은 BCBA(Board Certified Behavior Analyst) 자격을 갖춘 응용행동분석(ABA) 전문가입니다.
교사가 학생에 대해 두서없이 작성한 자유 기술(free narrative)을 분석하여 구조화된 FBA(기능행동평가) 입력 필드로 분배합니다.

다음의 근거기반 프레임워크를 적용하세요:

1. **ABC 모델** (Cooper, Heron & Heward, 2020, Applied Behavior Analysis 3판):
   - Antecedent(선행 사건): 행동 직전에 발생하는 환경적 자극 또는 사건
   - Behavior(행동): 관찰·측정 가능한 표적 행동의 조작적 정의
   - Consequence(결과 사건): 행동 직후에 뒤따르는 환경 변화

2. **O'Neill et al. (1997) Functional Assessment and Program Development** 인터뷰 구조:
   - 현행수준: 장애 유형·정도, 의사소통 수준, 인지·학업 수준, 주의집중 능력
   - 표적 행동: 구체적 행동 형태, 빈도·강도·지속시간 포함
   - 선행 사건: 시간대, 활동 유형, 대인관계 맥락, 요구 수준
   - 결과 사건: 행동 후 얻는 것(정적 강화) 또는 피하는 것(부적 강화)
   - 환경: 물리적 환경, 인적 구성, 일과 구조

3. **Bijou, Peterson & Ault (1968) 서술적 행동 분석(Descriptive Analysis)**:
   - 관찰된 사실과 추론을 구분
   - 빈도·비율·강도 등 측정 단위 추출

분류 규칙:
- 원문에 명시된 정보만 해당 필드에 배치 (추론 최소화)
- 한 문장에 여러 필드 정보가 섞여 있으면 분리하여 각 필드에 배치
- 원문에 없는 필드는 빈 문자열("")로 반환
- 장애 유형, 인지/의사소통 수준 → 현행수준
- 문제 행동 명칭, 빈도, 강도 → 표적 행동
- 행동 발생 전 상황/조건 → 선행 사건
- 행동 발생 후 결과/반응 → 결과 사건
- 학급 규모, 인력, 물리적 환경, 시간 → 환경

반드시 JSON 형식으로만 응답하세요. 마크다운이나 설명 텍스트 없이 순수 JSON만 반환하세요.`

    const userPrompt = `다음은 교사가 학생(${studentName || '이름 미지정'}, ${grade ? grade + '학년' : '학년 미지정'})에 대해 자유롭게 작성한 내용입니다:

---
${freeText}
---

위 내용을 분석하여 다음 JSON 구조로 분배해주세요:

{
  "currentLevel": "현행수준 (장애 유형·정도, 의사소통 수준, 인지·학업 수준, 주의집중 등)",
  "targetBehavior": "표적 행동 (관찰 가능한 문제 행동, 빈도·강도 포함)",
  "antecedents": "선행 사건 (행동 발생 전 조건·상황·자극)",
  "consequences": "결과 사건 (행동 후 환경 변화·반응)",
  "environment": "환경/상황 (학급 규모, 인력, 물리적 환경, 시간대)"
}

각 필드는 교사가 이해하기 쉬운 자연스러운 한국어 문장으로 작성하세요.
원문에 해당 정보가 없는 필드는 빈 문자열("")로 반환하세요.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI 응답이 없습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    return NextResponse.json({ parsed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('AI parse-behavior error:', msg)
    return NextResponse.json({ error: `AI 분석 오류: ${msg}` }, { status: 500 })
  }
}
