-- 행동계약서 이미지 URL·보상 설명 (한 번에 실행: SQL Editor 또는 npm run db:apply-014)
-- 오류 "Could not find the behavior_image_url column ... schema cache" → 이 파일 실행 후 1~2분 대기 또는 대시보드에서 API 재시작

ALTER TABLE public.pbs_behavior_contracts
  ADD COLUMN IF NOT EXISTS behavior_image_url text,
  ADD COLUMN IF NOT EXISTS reward_image_url text,
  ADD COLUMN IF NOT EXISTS reward_description text;

COMMENT ON COLUMN public.pbs_behavior_contracts.behavior_image_url IS '표적 행동 설명 이미지 (난독 지원)';
COMMENT ON COLUMN public.pbs_behavior_contracts.reward_image_url IS '보상 설명 이미지 (난독 지원)';
COMMENT ON COLUMN public.pbs_behavior_contracts.reward_description IS '보상 내용 텍스트 (이미지와 함께 표시)';

-- PostgREST 스키마 캐시 갱신 (컬럼 추가 직후 API가 인식하도록)
NOTIFY pgrst, 'reload schema';
