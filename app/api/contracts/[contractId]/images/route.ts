import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'

const MAX_BYTES = 4 * 1024 * 1024

function extFromMime(type: string) {
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  return 'jpg'
}

// POST /api/contracts/[contractId]/images — FormData: behaviorImage, rewardImage (File)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const session = await getSession()
    if (!session.classroomId || session.role !== 'teacher') {
      return NextResponse.json({ error: '교사 권한이 필요합니다.' }, { status: 403 })
    }

    const { contractId } = await params
    const supabase = await createServerSupabase()

    const { data: contract } = await supabase
      .from('pbs_behavior_contracts')
      .select('id')
      .eq('id', contractId)
      .eq('class_code_id', session.classroomId)
      .single()

    if (!contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
    }

    const formData = await request.formData()
    const behaviorImage = formData.get('behaviorImage') as File | null
    const rewardImage = formData.get('rewardImage') as File | null

    const updateData: Record<string, string> = {}
    const timestamp = Date.now()

    const uploads: { file: File; field: 'behavior' | 'reward'; col: string }[] = []
    if (behaviorImage && behaviorImage.size > 0) {
      if (behaviorImage.size > MAX_BYTES) {
        return NextResponse.json({ error: '행동 이미지는 4MB 이하만 업로드할 수 있습니다.' }, { status: 400 })
      }
      uploads.push({ file: behaviorImage, field: 'behavior', col: 'behavior_image_url' })
    }
    if (rewardImage && rewardImage.size > 0) {
      if (rewardImage.size > MAX_BYTES) {
        return NextResponse.json({ error: '보상 이미지는 4MB 이하만 업로드할 수 있습니다.' }, { status: 400 })
      }
      uploads.push({ file: rewardImage, field: 'reward', col: 'reward_image_url' })
    }

    if (uploads.length === 0) {
      return NextResponse.json({ error: '업로드할 이미지가 없습니다.' }, { status: 400 })
    }

    const uploadedStoragePaths: string[] = []

    for (const { file, field, col } of uploads) {
      const ext = extFromMime(file.type || 'image/jpeg')
      const path = `contracts/${contractId}/${field}_${timestamp}.${ext}`
      const buffer = await file.arrayBuffer()

      const { error: uploadError } = await supabase.storage.from('contract-images').upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

      if (uploadError) {
        console.error('contract image upload:', uploadError)
        const um = uploadError.message || ''
        const bucketHint =
          /bucket|not\s*found|does not exist/i.test(um) || /404/.test(um)
            ? ' 버킷 id는 `contract-images` 한 가지입니다(하이픈 `-` 포함, 띄어쓰기 없음, images 철자). Supabase → SQL Editor에서 supabase/migrations/015_storage_contract_images_bucket.sql 을 실행하거나, Storage → New bucket에서 동일 id로 만드세요.'
            : ''
        return NextResponse.json(
          {
            error: '스토리지에 이미지를 올리지 못했습니다.',
            details: um + bucketHint,
          },
          { status: 500 }
        )
      }

      uploadedStoragePaths.push(path)

      const { data: pub } = supabase.storage.from('contract-images').getPublicUrl(path)
      updateData[col] = pub.publicUrl
    }

    const { data: updated, error: updateError } = await supabase
      .from('pbs_behavior_contracts')
      .update(updateData)
      .eq('id', contractId)
      .select()
      .single()

    if (updateError || !updated) {
      if (uploadedStoragePaths.length > 0) {
        await supabase.storage.from('contract-images').remove(uploadedStoragePaths)
      }
      const em = updateError?.message || ''
      const emLower = em.toLowerCase()
      const missingImageCols =
        emLower.includes('behavior_image_url') ||
        emLower.includes('reward_image_url') ||
        (emLower.includes('column') && emLower.includes('does not exist'))
      if (missingImageCols) {
        return NextResponse.json(
          {
            error:
              'DB에 이미지 URL 컬럼이 없습니다. Supabase SQL에 supabase/migrations/014_contract_images.sql 을 실행한 뒤 다시 시도해 주세요.',
            details: em,
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: '이미지 URL을 계약서에 저장하지 못했습니다.', details: em },
        { status: 500 }
      )
    }

    return NextResponse.json({
      behaviorImageUrl: updated.behavior_image_url ?? null,
      rewardImageUrl: updated.reward_image_url ?? null,
    })
  } catch (e) {
    console.error('contract images POST:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
