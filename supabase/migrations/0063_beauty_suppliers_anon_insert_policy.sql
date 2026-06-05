-- beauty_suppliers: 공급사 신청 페이지는 비로그인 접근 허용
-- /kbeauty/supplier 는 공개 페이지 — anon 유저도 INSERT 가능
ALTER TABLE public.beauty_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공급사 신청 누구나 가능"
ON public.beauty_suppliers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
