-- =============================================================
-- 0036 — kpop_stats_daily.youtube_video_count 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경: KpopStats 아티스트 페이지 Stats Box 에 "Total Videos" 노출용.
--   ingest 가 이미 YouTube channels.list 응답에서 statistics.videoCount 를
--   받고 있었지만 DB 에 저장 안 되고 있었음 (lib/api/youtube.ts 의
--   YoutubeChannelStats.videoCount 필드 — 0036 이전엔 사실상 무용).
--
--   시간 시계열 가치도 있음 — 채널이 영상 누적하는 속도(주간 신규 영상 수)
--   를 추후 계산할 때 daily snapshot 이 있어야 함.
--
-- lastfm_weekly_rank 는 0012 에서 이미 컬럼이 존재. 마이그레이션 없이
-- ingest 만 tag.getTopArtists 매핑해 채우면 됨 (0036 PR 의 ingest 변경 참고).
-- =============================================================

alter table public.kpop_stats_daily
  add column if not exists youtube_video_count integer;

comment on column public.kpop_stats_daily.youtube_video_count is
  '채널 누적 영상 수 (YouTube channels.list statistics.videoCount). 일별 스냅샷. /kpop/[id] Stats Box 노출.';
