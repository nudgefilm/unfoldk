-- =============================================================
-- KdramaMatch Phase 2.1 — 버라이어티 / 리얼리티 / 애니메이션 정리
-- 적용: Supabase Dashboard > SQL Editor 에서 단계별로 실행
-- 작성: 2026-05-18
-- =============================================================
--
-- 배경:
--   초기 ingest 는 TMDB discover/tv with_origin_country=KR 만 사용해 모든 한국 TV 컨텐츠를 수집.
--   따라서 "런닝맨", "나혼자 산다" 같은 버라이어티·리얼리티·토크쇼·애니메이션이 dramas 테이블에 포함됨.
--
-- 정책 (Phase 2.1):
--   ALLOWED  : Drama(18) / Mystery(9648) / Romance(10749) / Soap(10766 — TV Romance)
--   EXCLUDED : Reality(10764) / Talk(10767) / Animation(16)
--   Comedy(35) 단독은 ALLOWED 미통과로 자동 제외
--
-- 본 스크립트는 dramas.genre 컬럼 (normalizeGenre 결과 또는 TMDB 원본) 기준으로
-- 기존 데이터를 정리. ingest 단계 필터는 lib/ingest/dramas.ts 의 passesGenreFilter 가
-- 신규 수집부터 차단.
--
-- ⚠️ 단계별로 진행: SELECT 로 대상 확인 → 사용자 확인 후 DELETE 실행.
-- =============================================================


-- ─── STEP 1. 삭제 대상 후보 확인 (실행 전 행 수 점검) ─────────
--
-- normalizeGenre 매핑 안 된 원본 (Reality/Talk Show/Animation/News/Documentary/Kids 등) 식별.
-- 일부 K-드라마가 'Animation' 으로 잘못 태깅된 경우도 함께 제거됨 (TMDB 메타 오류라 손실 미미).

SELECT
  genre,
  count(*) AS row_count,
  array_agg(title ORDER BY title) FILTER (WHERE rn <= 5) AS sample_titles
FROM (
  SELECT
    id, title, genre,
    row_number() OVER (PARTITION BY genre ORDER BY title) AS rn
  FROM public.dramas
  WHERE genre IN (
    'Animation',
    'Reality',
    'Reality TV',
    'Talk Show',
    'Talk',
    'News',
    'Documentary',
    'Game Show',
    'Kids',
    'Family'
  )
) t
GROUP BY genre
ORDER BY row_count DESC;


-- ─── STEP 2. user_watchlist 영향 점검 ─────────────────────────
--
-- ON DELETE CASCADE (FK on user_watchlist.drama_id) 라 자동 정리되지만,
-- 사용자가 워치리스트에 담은 비-드라마가 얼마나 있는지 미리 본다.

SELECT
  d.genre,
  count(DISTINCT w.user_id) AS distinct_users,
  count(*) AS watchlist_rows
FROM public.user_watchlist w
JOIN public.dramas d ON d.id = w.drama_id
WHERE d.genre IN (
  'Animation', 'Reality', 'Reality TV', 'Talk Show', 'Talk',
  'News', 'Documentary', 'Game Show', 'Kids', 'Family'
)
GROUP BY d.genre
ORDER BY watchlist_rows DESC;


-- ─── STEP 3. 실제 삭제 ────────────────────────────────────────
--
-- ⚠️ 비가역. STEP 1·2 결과 확인 후에만 실행.
-- ON DELETE CASCADE 로 user_watchlist.drama_id 행도 함께 삭제됨.
-- drama_ai_summaries / drama_ai_characters / 등 FK 도 cascade.

DELETE FROM public.dramas
WHERE genre IN (
  'Animation',
  'Reality',
  'Reality TV',
  'Talk Show',
  'Talk',
  'News',
  'Documentary',
  'Game Show',
  'Kids',
  'Family'
);


-- ─── STEP 4. 정리 후 통계 ─────────────────────────────────────

SELECT
  count(*)                                          AS total_dramas,
  count(*) FILTER (WHERE is_active = true)          AS active_dramas,
  count(*) FILTER (WHERE genre IS NULL)             AS no_genre_dramas,
  count(DISTINCT genre)                             AS distinct_genres
FROM public.dramas;

-- 잔여 장르 분포 확인 — Romance / Thriller / Drama / Comedy 등이 주로 남아야 정상
SELECT genre, count(*) AS row_count
FROM public.dramas
GROUP BY genre
ORDER BY row_count DESC;
