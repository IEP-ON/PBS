import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase/server'
import { getKstToday } from '@/lib/speech-diary'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const imageFile = formData.get('image') as File | null
    const studentId = formData.get('studentId')?.toString()

    if (!audioFile || !studentId) {
      return NextResponse.json({ error: '오디오 파일과 학생 정보가 필요합니다.' }, { status: 400 })
    }

    if (audioFile.size === 0) {
      return NextResponse.json({ error: '녹음된 내용이 없습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name, class_code_id')
      .eq('id', studentId)
      .eq('is_active', true)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko',
      prompt:
        '학생, 친구, 선생님, 엄마, 아빠, 가족, 집, 동생, 언니, 형, 누나, 할머니, 할아버지, 주말, 여행, 놀이터, 놀이, 장난감, 게임, 밥, 급식, 맛있다, 재미있다, 좋았다, 슬펐다, 무서웠다, 행복했다, 학교, 수업, 공부',
      temperature: 0,
    })

    const rawTranscript = transcription.text
    const today = getKstToday()

    const { data: aiProfile } = await supabase
      .from('pbs_student_ai_profiles')
      .select('preferences, student_voice_keywords, support_needs, public_safe_summary')
      .eq('student_id', student.id)
      .maybeSingle()

    const { data: context } = await supabase
      .from('pbs_speech_context')
      .select('*')
      .eq('class_code_id', student.class_code_id)
      .eq('date', today)
      .maybeSingle()

    const contextInfo = context
      ? `오늘의 급식: ${context.lunch_menu || '정보 없음'}\n오늘의 행사: ${context.event || '정보 없음'}\n오늘의 메모: ${context.memo || '정보 없음'}`
      : ''

    const aiProfileInfo = aiProfile
      ? `학생이 좋아하는 것: ${(aiProfile.preferences || []).slice(0, 3).join(', ') || '정보 없음'}
학생이 자주 쓰는 표현: ${(aiProfile.student_voice_keywords || []).slice(0, 5).join(', ') || '정보 없음'}
학생 지원 포인트: ${(aiProfile.support_needs || []).slice(0, 3).join(', ') || '정보 없음'}
학생 공개 요약: ${aiProfile.public_safe_summary || '정보 없음'}`
      : ''

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `당신은 특수교육 대상 아동의 음성 일기를 보정하는 전문가입니다.
학생 이름은 ${student.name}입니다.
학생이 실제로 말한 의미와 감정을 보존하면서, 읽기 쉬운 짧은 일기로 다듬어 주세요.

원칙:
1. 학생이 말하지 않은 사실을 지어내지 않습니다.
2. 발음이 불명확해도 확실한 의미만 정리합니다.
3. 학교 맥락은 학생의 말과 맞을 때만 참고합니다.
4. 말투를 지나치게 어른스럽게 바꾸지 않습니다.

${contextInfo}
${aiProfileInfo}

반드시 아래 JSON만 반환하세요:
{
  "correctedText": "보정된 일기 내용",
  "sentiment": "positive|negative|neutral",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`,
        },
        {
          role: 'user',
          content: rawTranscript,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    const timestamp = Date.now()
    const audioExtension = audioFile.type.includes('mp4') ? 'm4a' : 'webm'
    const audioPath = `speech-diary/${student.id}/${timestamp}.${audioExtension}`

    const audioBuffer = await audioFile.arrayBuffer()
    const { error: audioUploadError } = await supabase.storage
      .from('audio-diaries')
      .upload(audioPath, audioBuffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: false,
      })

    const audioUrl = audioUploadError
      ? null
      : supabase.storage.from('audio-diaries').getPublicUrl(audioPath).data.publicUrl

    let imageUrl: string | null = null
    if (imageFile && imageFile.size > 0) {
      const imagePath = `speech-diary/${student.id}/${timestamp}.jpg`
      const imageBuffer = await imageFile.arrayBuffer()

      const { error: imageUploadError } = await supabase.storage
        .from('audio-diaries')
        .upload(imagePath, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (!imageUploadError) {
        imageUrl = supabase.storage.from('audio-diaries').getPublicUrl(imagePath).data.publicUrl
      }
    }

    const { data: diary, error: insertError } = await supabase
      .from('pbs_speech_diaries')
      .insert({
        student_id: student.id,
        raw_transcript: rawTranscript,
        corrected_text: result.correctedText || rawTranscript,
        audio_url: audioUrl,
        image_url: imageUrl,
        sentiment: result.sentiment || null,
        keywords: Array.isArray(result.keywords) ? result.keywords : [],
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: '일기 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        diaryId: diary.id,
        studentName: student.name,
        rawTranscript,
        correctedText: diary.corrected_text,
        sentiment: diary.sentiment,
        keywords: diary.keywords,
      },
    })
  } catch (error) {
    console.error('speech diary transcribe error:', error)
    return NextResponse.json({ error: '음성 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
