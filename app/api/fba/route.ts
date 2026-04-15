import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/fba — FBA 기록 조회
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    const supabase = await createServerSupabase()

    let query = supabase
      .from('pbs_fba_records')
      .select('*, pbs_students(name)')
      .order('created_at', { ascending: false })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data: records } = await query

    return NextResponse.json({ records: records || [] })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/fba — FBA 기록 생성 + AI 분석 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const {
      studentId,
      behaviorDescription,
      antecedentPatterns,
      consequencePatterns,
      frequencyData,
      requestAiAnalysis = false,
      // AI 행동 지원 계획에서 직접 전달받는 필드
      estimatedFunction: externalFunction,
      confidence: externalConfidence,
      rationale: externalRationale,
      /** 최근 N분 안에 같은 학생 FBA가 있으면 갱신(중복 행 방지). AI 일괄 저장 등에서 사용 */
      replaceIfRecentMinutes,
    } = await request.json()

    if (!studentId || !behaviorDescription) {
      return NextResponse.json({ error: '학생과 행동 설명은 필수입니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 학생 확인
    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 외부(AI 행동 지원 계획)에서 전달된 분석 결과 우선 사용
    let gptAnalysis: string | null = externalRationale || null
    let estimatedFunction: string | null = externalFunction || null
    let confidence: string | null = externalConfidence || null

    // AI 분석 요청 시 (외부 전달값이 없을 때만)
    if (requestAiAnalysis && !estimatedFunction && process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import('openai')
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const analysisPrompt = `다음 학생의 문제 행동에 대한 기능행동분석(FBA)을 수행해주세요:

학생: ${student.name}
행동 설명: ${behaviorDescription}
선행 패턴: ${antecedentPatterns?.join(', ') || '없음'}
결과 패턴: ${consequencePatterns?.join(', ') || '없음'}
빈도 데이터: ${JSON.stringify(frequencyData) || '없음'}

다음 형식으로 분석해주세요:
1. 추정 행동 기능 (주의추구/회피/감각/물건획득 중 하나)
2. 신뢰도 (높음/중간/낮음)
3. 간단한 분석 근거 (2-3문장)

간결하게 답변해주세요.`

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 500,
          messages: [{ role: 'user', content: analysisPrompt }],
        })

        gptAnalysis = completion.choices[0]?.message?.content || null

        if (gptAnalysis) {
          // AI 응답에서 기능과 신뢰도 추출
          if (gptAnalysis.includes('주의추구')) estimatedFunction = 'attention'
          else if (gptAnalysis.includes('회피')) estimatedFunction = 'escape'
          else if (gptAnalysis.includes('감각')) estimatedFunction = 'sensory'
          else if (gptAnalysis.includes('물건')) estimatedFunction = 'tangible'

          if (gptAnalysis.includes('높음')) confidence = 'high'
          else if (gptAnalysis.includes('중간')) confidence = 'medium'
          else confidence = 'low'
        }
      } catch (aiError) {
        console.error('AI 분석 실패:', aiError)
      }
    }

    const rowPayload = {
      behavior_description: behaviorDescription,
      antecedent_patterns: antecedentPatterns || [],
      consequence_patterns: consequencePatterns || [],
      frequency_data: frequencyData || null,
      estimated_function: estimatedFunction,
      confidence,
      gpt_analysis: gptAnalysis,
    }

    const windowMinutes =
      typeof replaceIfRecentMinutes === 'number' && replaceIfRecentMinutes > 0
        ? Math.min(Math.floor(replaceIfRecentMinutes), 24 * 60)
        : 0

    if (windowMinutes > 0) {
      const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('pbs_fba_records')
        .select('id')
        .eq('student_id', studentId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recent?.id) {
        const { data: updated, error: updateError } = await supabase
          .from('pbs_fba_records')
          .update(rowPayload)
          .eq('id', recent.id)
          .select()
          .single()

        if (updateError) {
          console.error('FBA 기록 갱신 오류:', updateError)
          return NextResponse.json({ error: 'FBA 기록 갱신에 실패했습니다.' }, { status: 500 })
        }

        return NextResponse.json({
          record: updated,
          aiAnalysisPerformed: !!gptAnalysis,
          replacedRecent: true,
        })
      }
    }

    const { data: record, error: insertError } = await supabase
      .from('pbs_fba_records')
      .insert({
        student_id: studentId,
        ...rowPayload,
      })
      .select()
      .single()

    if (insertError) {
      console.error('FBA 기록 삽입 오류:', insertError)
      return NextResponse.json({ error: 'FBA 기록 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      record,
      aiAnalysisPerformed: !!gptAnalysis,
      replacedRecent: false,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
