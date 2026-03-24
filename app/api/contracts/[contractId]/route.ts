import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

// PATCH /api/contracts/[contractId] — 행동계약서 수정 (교사 전용)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { contractId } = await params
    const body = await request.json()

    const allowedFields: Record<string, string> = {
      contractTitle: 'contract_title',
      targetBehavior: 'target_behavior',
      behaviorDefinition: 'behavior_definition',
      measurementMethod: 'measurement_method',
      achievementCriteria: 'achievement_criteria',
      rewardAmount: 'reward_amount',
      contractStart: 'contract_start',
      contractEnd: 'contract_end',
      isActive: 'is_active',
      teacherSigned: 'teacher_signed',
      studentSigned: 'student_signed',
      parentSigned: 'parent_signed',
      teacherNote: 'teacher_note',
    }

    const updateData: Record<string, unknown> = {}
    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        updateData[col] = body[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // 기존 계약서 조회 (버전 관리용)
    const { data: oldContract } = await supabase
      .from('pbs_behavior_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!oldContract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 주요 필드 변경 여부 확인
    const majorFields = ['contract_title', 'target_behavior', 'behavior_definition', 'measurement_method', 'achievement_criteria', 'reward_amount']
    const hasMajorChange = majorFields.some(field => updateData[field] !== undefined && updateData[field] !== oldContract[field])

    // 주요 변경사항이 있으면 이전 버전 저장
    if (hasMajorChange) {
      const changedFields = Object.keys(updateData).filter(key => updateData[key] !== oldContract[key])
      const changesSummary = `${changedFields.join(', ')} 수정`

      await supabase.from('pbs_contract_versions').insert({
        contract_id: contractId,
        version: oldContract.version || 1,
        changes_summary: changesSummary,
      })

      // 버전 번호 증가
      updateData.version = (oldContract.version || 1) + 1
    }

    const { data: contract, error } = await supabase
      .from('pbs_behavior_contracts')
      .update(updateData)
      .eq('id', contractId)
      .eq('class_code_id', session.classroomId)
      .select()
      .single()

    if (error || !contract) {
      return NextResponse.json({ error: '계약서 수정 실패' }, { status: 500 })
    }

    return NextResponse.json({ contract })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
