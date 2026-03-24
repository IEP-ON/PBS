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

    let gptAnalysis = null
    let estimatedFunction = null
    let confidence = null

    // AI 분석 요청 시
    if (requestAiAnalysis && process.env.OPENAI_API_KEY) {
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

    // FBA 기록 저장
    const { data: record } = await supabase
      .from('pbs_fba_records')
      .insert({
        student_id: studentId,
        behavior_description: behaviorDescription,
        antecedent_patterns: antecedentPatterns || [],
        consequence_patterns: consequencePatterns || [],
        frequency_data: frequencyData || null,
        estimated_function: estimatedFunction,
        confidence,
        gpt_analysis: gptAnalysis,
      })
      .select()
      .single()

    return NextResponse.json({ 
      record,
      aiAnalysisPerformed: !!gptAnalysis,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
