-- =============================================================
-- 0019_fix_bts_blackpink_channel.sql
-- BTS · BLACKPINK 의 youtube_channel_id 가 search.list 자동 매핑으로 잘못 박힌 케이스 정정.
-- - search.list q="BTS"/"BLACKPINK" 1위가 공식 채널이 아닐 가능성 (팬 채널·라벨 채널 등).
-- - 한 번 박히면 ingest-kpop-stats 의 자동 매핑 단계 (unmappedArtists 필터) 에서 제외돼
--   재정정 안 됨 → SQL 로 강제 박제.
-- - thumbnail_url 도 NULL 로 reset 해 다음 ingest 에서 정확한 채널 썸네일로 backfill.
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행.
-- =============================================================

-- BTS 공식 채널 (Bangtan TV)
update public.kpop_artists
set youtube_channel_id = 'UCLkAepWjdylmXSltofFvsYA',
    thumbnail_url = null
where name = 'BTS';

-- BLACKPINK 공식 채널
update public.kpop_artists
set youtube_channel_id = 'UCOmHUn--16B90oW2L6FRR3A',
    thumbnail_url = null
where name = 'BLACKPINK';
