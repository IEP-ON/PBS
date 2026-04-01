import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/session'
import { createServerSupabase } from '@/lib/supabase/server'
import { sanitizeAiProfilePayload } from '@/lib/ai-profile'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
    }

    const { studentId, sourceFreeText, currentProfile, answers } = await request.json()

    if (!studentId || !currentProfile || !answers || typeof answers !== 'object') {
      return NextResponse.json({ error: '학생 정보, 현재 프로필, 보완 답변이 필요합니다.' }, { status: 400 })
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2400,
      messages: [
        {
          role: 'system',
          content: `당신은 교사가 보완한 정보를 반영해 학생 AI 프로필을 정교화하는 ABA/PBS 전문가입니다.
현재 프로필을 유지하되, 보완 답변으로 누락 항목만 보강하세요.

규칙:
1. 기존 정보는 근거 없이 삭제하지 않습니다.
2. 교사 답변으로 확인된 내용만 보완합니다.
3. 여전히 부족한 정보가 있을 때만 follow_up_questions를 0~2개 남깁니다.
4. 출력 형식은 parse 단계와 동일합니다.

반드시 JSON만 반환하세요.`,
        },
        {
          role: 'user',
          content: `학생: ${student.name} (${student.grade || '학년 미입력'})
원본 자유입력:
${sourceFreeText || ''}

현재 프로필:
${JSON.stringify(currentProfile, null, 2)}

교사 보완 답변:
${JSON.stringify(answers, null, 2)}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI 응답이 없습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    const profile = sanitizeAiProfilePayload(parsed.profile ?? currentProfile, {
      sourceFreeText,
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
    console.error('student-profile refine error:', msg)
    return NextResponse.json({ error: `AI 보강 오류: ${msg}` }, { status: 500 })
  }
}
