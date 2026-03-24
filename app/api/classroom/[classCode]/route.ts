import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/classroom/[classCode] — 학급 정보 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ classCode: string }> }
) {
  try {
    const { classCode } = await params
    const supabase = await createServerSupabase()

    const { data, error } = await supabase
      .from('pbs_class_codes')
      .select('class_name, school_name, is_active, teacher_name')
      .eq('code', classCode)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '학급을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      className: data.class_name,
      schoolName: data.school_name,
      teacherName: data.teacher_name,
      isActive: data.is_active,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
