-- 0049: user_curation_collections — Curation K 저장 장소

create table if not exists public.user_curation_collections (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  item_type  text        not null check (item_type in ('filming', 'tour')),
  item_id    uuid        not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

alter table public.user_curation_collections enable row level security;

create policy "user_curation_collections_all_own"
  on public.user_curation_collections for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_curation_collections to authenticated;
grant select, insert, update, delete on public.user_curation_collections to service_role;

create index if not exists idx_user_curation_coll_user
  on public.user_curation_collections (user_id);
