import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// GET /api/ethics — 윤리 가이드라인 및 동의서 템플릿 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session.classroomId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = await createServerSupabase()

    const [guidelinesRes, templatesRes] = await Promise.all([
      supabase.from('pbs_ethics_guidelines').select('*').order('priority'),
      supabase.from('pbs_consent_templates').select('*').eq('is_active', true).order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      guidelines: guidelinesRes.data || [],
      templates: templatesRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/ethics — 윤리 가이드라인 또는 동의서 템플릿 추가 (교사 전용)
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { type, ...data } = await request.json()

    const supabase = await createServerSupabase()

    if (type === 'guideline') {
      const { title, description, category, priority } = data
      if (!title || !description) {
        return NextResponse.json({ error: '제목과 설명은 필수입니다.' }, { status: 400 })
      }

      const { data: guideline } = await supabase
        .from('pbs_ethics_guidelines')
        .insert({ title, description, category, priority: priority || 999 })
        .select()
        .single()

      return NextResponse.json({ guideline })
    } else if (type === 'template') {
      const { templateType, titleKo, contentKo, version } = data
      if (!templateType || !titleKo || !contentKo) {
        return NextResponse.json({ error: '템플릿 유형, 제목, 내용은 필수입니다.' }, { status: 400 })
      }

      const { data: template } = await supabase
        .from('pbs_consent_templates')
        .insert({
          template_type: templateType,
          title_ko: titleKo,
          content_ko: contentKo,
          version: version || '1.0',
        })
        .select()
        .single()

      return NextResponse.json({ template })
    } else {
      return NextResponse.json({ error: '유효하지 않은 유형입니다.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
