-- 행동계약서 이미지·보상 설명 (통합학급 난독 지원)
ALTER TABLE pbs_behavior_contracts
  ADD COLUMN IF NOT EXISTS behavior_image_url text,
  ADD COLUMN IF NOT EXISTS reward_image_url text,
  ADD COLUMN IF NOT EXISTS reward_description text;

COMMENT ON COLUMN pbs_behavior_contracts.behavior_image_url IS '표적 행동 설명 이미지 (난독 지원)';
COMMENT ON COLUMN pbs_behavior_contracts.reward_image_url IS '보상 설명 이미지 (난독 지원)';
COMMENT ON COLUMN pbs_behavior_contracts.reward_description IS '보상 내용 텍스트 (이미지와 함께 표시)';

-- 배포 후 Supabase Storage에 버킷 contract-images 생성(공개 읽기) — app/api/contracts/[contractId]/images/route.ts
