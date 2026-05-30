-- =============================================================
-- 0052 — KpopStats Artist Comparison 인사이트 캐시
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- kpop_comparison_cache: Claude Haiku 인사이트 24시간 캐싱
--   (artist_a_id, artist_b_id) unique — 재생성 시 upsert
-- =============================================================

create table if not exists public.kpop_comparison_cache (
  id uuid primary key default gen_random_uuid(),
  artist_a_id uuid not null references public.kpop_artists(id) on delete cascade,
  artist_b_id uuid not null references public.kpop_artists(id) on delete cascade,
  insight text not null,
  created_at timestamptz not null default now(),
  unique (artist_a_id, artist_b_id)
);

create index if not exists idx_kpop_comparison_cache_artists
  on public.kpop_comparison_cache(artist_a_id, artist_b_id);

alter table public.kpop_comparison_cache enable row level security;

grant select on public.kpop_comparison_cache to anon, authenticated;
grant all    on public.kpop_comparison_cache to service_role;

drop policy if exists "kpop_comparison_cache_select_all" on public.kpop_comparison_cache;
create policy "kpop_comparison_cache_select_all"
  on public.kpop_comparison_cache for select to anon, authenticated using (true);
