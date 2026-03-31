import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/students/[studentId]/qr — QR 코드 SVG 생성
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { studentId } = await params
    const supabase = await createServerSupabase()

    const { data: student } = await supabase
      .from('pbs_students')
      .select('name, qr_code, grade, pbs_accounts(balance)')
      .eq('id', studentId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: classroom } = await supabase
      .from('pbs_class_codes')
      .select('code, class_name, school_name')
      .eq('id', session.classroomId)
      .single()

    // QR 카드 정보를 JSON으로 반환 (클라이언트에서 QR 이미지 생성)
    return NextResponse.json({
      student: {
        name: student.name,
        grade: student.grade,
        qrCode: student.qr_code,
      },
      classroom: {
        code: classroom?.code,
        className: classroom?.class_name,
        schoolName: classroom?.school_name,
      },
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
