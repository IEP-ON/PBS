-- =============================================================================
-- 행동계약서 이미지 (DB 컬럼 + Storage 버킷) — Supabase SQL Editor 에 전체 복사 후 Run 1회
-- 앱: contract-images 버킷, pbs_behavior_contracts 의 behavior_image_url 등
-- =============================================================================

-- ① 테이블 컬럼
ALTER TABLE public.pbs_behavior_contracts
  ADD COLUMN IF NOT EXISTS behavior_image_url text,
  ADD COLUMN IF NOT EXISTS reward_image_url text,
  ADD COLUMN IF NOT EXISTS reward_description text;

COMMENT ON COLUMN public.pbs_behavior_contracts.behavior_image_url IS '표적 행동 설명 이미지 (난독 지원)';
COMMENT ON COLUMN public.pbs_behavior_contracts.reward_image_url IS '보상 설명 이미지 (난독 지원)';
COMMENT ON COLUMN public.pbs_behavior_contracts.reward_description IS '보상 내용 텍스트 (이미지와 함께 표시)';

-- ② Storage 버킷 (id = contract-images, 하이픈 포함)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'contract-images',
  'contract-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'contract-images');

-- ③ PostgREST 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
