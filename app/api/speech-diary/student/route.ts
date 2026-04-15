import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildFallbackPublicCue, sanitizePublicCue } from '@/lib/ai-profile'

// GET /api/speech-diary/student?qrCode=...
// 표준 QR 형식은 pbs_students.qr_code ("QR-...") 하나만 허용
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const qrCode = searchParams.get('qrCode')?.trim()

    if (!qrCode) {
      return NextResponse.json({ error: 'QR 코드가 필요합니다.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: student } = await supabase
      .from('pbs_students')
      .select('id, name')
      .eq('qr_code', qrCode)
      .eq('is_active', true)
      .maybeSingle<{ id: string; name: string }>()

    if (!student) {
      return NextResponse.json(
        { error: '표준 QR 카드가 아닙니다. 학생 관리에서 QR 카드를 다시 출력해주세요.' },
        { status: 404 }
      )
    }

    const { data: aiProfile } = await supabase
      .from('pbs_student_ai_profiles')
      .select('public_cue, class_mode_targets, replacement_behaviors, preferences')
      .eq('student_id', student.id)
      .maybeSingle()

    const publicCue = sanitizePublicCue(aiProfile?.public_cue) || buildFallbackPublicCue({
      classModeTargets: Array.isArray(aiProfile?.class_mode_targets) ? aiProfile.class_mode_targets : [],
      replacementBehaviors: Array.isArray(aiProfile?.replacement_behaviors) ? aiProfile.replacement_behaviors : [],
      preferences: Array.isArray(aiProfile?.preferences) ? aiProfile.preferences : [],
    })

    return NextResponse.json({
      studentId: student.id,
      name: student.name,
      publicCue,
    })
  } catch {
    return NextResponse.json({ error: '학생 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
