-- 행동계약서 이미지용 Storage 버킷 (없을 때만 생성)
-- 앱: app/api/contracts/[contractId]/images/route.ts → .from('contract-images')
-- id·name 모두 정확히 `contract-images` (하이픈 하나, images 철자)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'contract-images',
  'contract-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'contract-images');
