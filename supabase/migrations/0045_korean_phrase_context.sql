-- =============================================================
-- 0045 — HangeulGo: korean_phrases 드라마 맥락 컬럼 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   드라마 팩 표현 카드에 에피소드·장면 설명·감정 태그 노출.
--   "This Week's K-Drama Food Guide" 패턴과 동일하게 DB 직접 저장.
--
-- 추가 컬럼:
--   - episode_tag       : 화수 정보 (예: "8화", "Season 1, Ep 3")
--   - scene_description : 장면 설명 한 줄 (팬 감성 — 한국어 또는 영문)
--   - emotion_tag       : 감정 태그 (로맨틱/코믹/감동/일상/우정)
--
-- 참고: korean_phrases.drama_id = dramas.id (KdramaMatch 공유 테이블)
-- =============================================================


-- 1. 컬럼 추가 ─────────────────────────────────────────────────
alter table public.korean_phrases
  add column if not exists episode_tag       text;

alter table public.korean_phrases
  add column if not exists scene_description text;

alter table public.korean_phrases
  add column if not exists emotion_tag       text
  check (emotion_tag is null or emotion_tag in ('로맨틱', '코믹', '감동', '일상', '우정'));


-- 2. 인덱스 — 감정 태그 필터 조회 최적화 ─────────────────────
create index if not exists idx_korean_phrases_emotion_tag
  on public.korean_phrases(emotion_tag)
  where emotion_tag is not null;

-- drama_id + emotion_tag 복합 조회 (팩별 감정 태그 목록)
create index if not exists idx_korean_phrases_drama_emotion
  on public.korean_phrases(drama_id, emotion_tag)
  where emotion_tag is not null;


-- 3. 코멘트 ────────────────────────────────────────────────────
comment on column public.korean_phrases.episode_tag is
  '화수 정보 (예: "8화", "Ep 3"). drama_id 있는 경우만 유효.';

comment on column public.korean_phrases.scene_description is
  '장면 설명 한 줄 (예: "현빈이 손예진에게 처음 마음을 열며 건넨 말"). 팬 감성 묘사.';

comment on column public.korean_phrases.emotion_tag is
  '감정 태그. 허용값: 로맨틱 / 코믹 / 감동 / 일상 / 우정. NULL = 미분류.
   드라마 팩 감정 필터에 사용됨.';
