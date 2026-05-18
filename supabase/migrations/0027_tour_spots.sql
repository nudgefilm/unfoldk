-- =============================================================
-- 0027 — Curation K Phase 2: tour_spots (TourAPI 5개 카테고리 통합)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델: 한국관광공사 TourAPI 4.0 (KorService2) 의 5개 카테고리를
--   단일 테이블에 통합 저장. content_type_id 로 탭 구분.
--
--   12: 관광지   / 14: 문화시설 / 15: 축제·행사
--   32: 숙박     / 39: 음식점
--
-- 비고:
--   - content_id 는 TourAPI 전체 고유 → unique 키로 upsert.
--   - title 은 한글 원본 (KorService2). eng_title 은 추후 enrichment
--     (EngService2 또는 Claude 번역) 단계에서 채워 넣음 — 현재 nullable.
--   - overview_ko 는 detailCommon2 enrichment 가 필요 (현재 list 응답엔 없음).
--     overview_en 은 overview_ko 가 채워진 후 Claude 번역으로 1회 생성.
--   - filming_spots 와 별도 테이블 — filming_spots 는 K드라마 촬영지 마스터
--     (드라마 연계 필수), tour_spots 는 일반 카탈로그 (드라마 무관).
--   - 정책은 0023 패턴 (anon+auth read / admin write / service_role full).
-- =============================================================


-- 1. tour_spots ------------------------------------------------
create table if not exists public.tour_spots (
  id uuid primary key default gen_random_uuid(),

  -- TourAPI 식별자 (전체 카테고리 통틀어 globally unique)
  content_id text not null unique,
  content_type_id integer not null
    check (content_type_id in (12, 14, 15, 32, 39)),

  -- 명칭
  title text not null,                       -- 한글 원본 (KorService2 응답)
  eng_title text,                            -- 영문명 (추후 enrichment)

  -- 위치
  area_code integer,                         -- 광역시도 (1~39)
  sigungu_code integer,                      -- 시군구
  addr1 text,
  addr2 text,
  latitude numeric(10, 7),                   -- WGS84 (TourAPI mapy)
  longitude numeric(10, 7),                  -- WGS84 (TourAPI mapx)

  -- 이미지
  image_url text,                            -- TourAPI firstimage (대표 큰 이미지)
  image_url2 text,                           -- TourAPI firstimage2 (썸네일)

  -- 설명·외부 링크
  overview_ko text,                          -- TourAPI detailCommon2 overview (추후 enrichment)
  overview_en text,                          -- Claude 번역 (overview_ko 가 있을 때 1회 생성)
  homepage text,                             -- detailCommon2 homepage (HTML 포함 가능)

  -- 행사·축제 (content_type_id=15 에서만 set)
  event_start_date text,                     -- YYYYMMDD
  event_end_date text,                       -- YYYYMMDD

  -- TourAPI modifiedtime (YYYYMMDDHHMMSS) — 증분 비교용
  modified_time text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 탭+지역 필터 — content_type_id + area_code 복합 인덱스
create index if not exists idx_tour_spots_type_area
  on public.tour_spots(content_type_id, area_code);

-- 번역 대기열 — overview_ko 있고 overview_en 없는 항목 빠르게 조회
create index if not exists idx_tour_spots_translate_pending
  on public.tour_spots(content_type_id)
  where overview_ko is not null and overview_en is null;

-- 축제·행사 정렬 — event_start_date 오름차순
create index if not exists idx_tour_spots_event_start
  on public.tour_spots(event_start_date)
  where content_type_id = 15;


-- 2. updated_at 트리거 (set_updated_at 은 0001 에서 정의) ------
drop trigger if exists trg_tour_spots_updated_at on public.tour_spots;
create trigger trg_tour_spots_updated_at
  before update on public.tour_spots
  for each row execute function public.set_updated_at();


-- 3. RLS 활성화 ------------------------------------------------
alter table public.tour_spots enable row level security;


-- 4. GRANT — 0023 패턴 일관 ------------------------------------
grant select on public.tour_spots to anon, authenticated;
grant insert, update, delete on public.tour_spots to authenticated;  -- admin RLS 만 통과
grant select, insert, update, delete on public.tour_spots to service_role;


-- 5. RLS 정책 — 공개 카탈로그 (anon+auth read), admin write ----

drop policy if exists "tour_spots_select_all" on public.tour_spots;
create policy "tour_spots_select_all"
  on public.tour_spots for select
  to anon, authenticated
  using (true);

drop policy if exists "tour_spots_admin_write" on public.tour_spots;
create policy "tour_spots_admin_write"
  on public.tour_spots for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
