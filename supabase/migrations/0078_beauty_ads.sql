-- beauty_ad_slots: 광고 슬롯 정의
CREATE TABLE IF NOT EXISTS public.beauty_ad_slots (
  id TEXT PRIMARY KEY,
  slot_name TEXT NOT NULL,
  location_description TEXT,
  monthly_price NUMERIC NOT NULL,
  max_capacity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO public.beauty_ad_slots (id, slot_name, location_description, monthly_price, max_capacity) VALUES
  ('featured_supplier', 'Featured Supplier', '바이어 공급사 탐색 페이지 상단 고정 노출', 149, 3),
  ('data_sources_banner', 'Data Sources Banner', 'Data Sources 페이지 섹션 사이 배너', 49, 2),
  ('dashboard_sidebar', 'Dashboard Sidebar', '바이어·셀러 대시보드 사이드바 상시 노출', 39, 2),
  ('sourcing_sniper', 'Sourcing Sniper', 'Sourcing Sniper 결과 하단 노출', 99, 2)
ON CONFLICT (id) DO NOTHING;

-- beauty_ads: 광고 신청·집행 관리
CREATE TABLE IF NOT EXISTS public.beauty_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id TEXT NOT NULL REFERENCES public.beauty_ad_slots(id),
  advertiser_id UUID NOT NULL REFERENCES auth.users(id),
  advertiser_type TEXT NOT NULL CHECK (advertiser_type IN ('supplier', 'buyer', 'seller')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'expired')),
  start_date DATE,
  end_date DATE,
  monthly_price NUMERIC NOT NULL,
  paid BOOLEAN DEFAULT false,
  paddle_transaction_id TEXT,
  impressions_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.beauty_ads ENABLE ROW LEVEL SECURITY;

-- 광고주 본인 광고 조회
CREATE POLICY "beauty_ads_advertiser_select" ON public.beauty_ads
  FOR SELECT TO authenticated
  USING (advertiser_id = auth.uid());

-- 광고주 신청
CREATE POLICY "beauty_ads_advertiser_insert" ON public.beauty_ads
  FOR INSERT TO authenticated
  WITH CHECK (advertiser_id = auth.uid());

-- 어드민 전체 조회·수정
CREATE POLICY "beauty_ads_admin_select" ON public.beauty_ads
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "beauty_ads_admin_update" ON public.beauty_ads
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 프론트엔드 노출용: status = 'active' + end_date 유효한 광고만 공개 조회
CREATE POLICY "beauty_ads_public_select" ON public.beauty_ads
  FOR SELECT TO authenticated
  USING (status = 'active' AND (end_date IS NULL OR end_date >= current_date));

GRANT SELECT, INSERT ON public.beauty_ads TO authenticated;
GRANT UPDATE ON public.beauty_ads TO authenticated;
GRANT SELECT ON public.beauty_ad_slots TO authenticated;

-- 노출·클릭 집계 인덱스
CREATE INDEX IF NOT EXISTS idx_beauty_ads_slot_status
  ON public.beauty_ads (slot_id, status, end_date);

-- 만료 자동 처리 트리거 (매일 자정 end_date 지난 광고 expired 전환)
CREATE OR REPLACE FUNCTION public.expire_beauty_ads()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.beauty_ads
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < current_date;
END;
$$;
