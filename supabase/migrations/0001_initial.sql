create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists citext;

create type public.capture_kind as enum ('image', 'link', 'youtube');
create type public.capture_status as enum ('queued', 'processing', 'ready', 'needs_attention', 'deleting', 'failed');
create type public.failure_category as enum (
  'authentication_required', 'paywall', 'robots_denied', 'bot_protection',
  'unsupported_content', 'empty_content', 'captions_unavailable', 'invalid_url', 'unsafe_url',
  'fetch_timeout', 'transient', 'unknown'
);
create type public.relation_type as enum ('complements', 'updates', 'contradicts', 'recurring_theme');

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null,
  display_name text,
  preferred_language text not null default 'en',
  monthly_capture_limit integer not null default 500 check (monthly_capture_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.digest_settings (
  user_id uuid primary key references public.user_profiles(user_id) on delete cascade,
  timezone text not null default 'America/New_York',
  weekday smallint not null default 0 check (weekday between 0 and 6),
  local_time time not null default '18:00',
  enabled boolean not null default true,
  last_period_end timestamptz,
  next_due_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  kind public.capture_kind not null,
  status public.capture_status not null default 'queued',
  original_url text,
  normalized_url text,
  note text check (char_length(note) <= 2000),
  archived boolean not null default false,
  captured_at timestamptz not null default now(),
  failure_category public.failure_category,
  failure_detail text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint non_image_has_url check (kind = 'image' or original_url is not null)
);

create index captures_user_captured_idx on public.captures(user_id, captured_at desc) where deleted_at is null;
create index captures_user_status_idx on public.captures(user_id, status) where deleted_at is null;
create index captures_normalized_url_idx on public.captures(user_id, normalized_url) where normalized_url is not null;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  capture_id uuid not null references public.captures(id) on delete cascade,
  object_key text not null unique,
  normalized_object_key text,
  ordinal smallint not null check (ordinal between 0 and 9),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  checksum_sha256 text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (capture_id, ordinal)
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  capture_id uuid not null references public.captures(id) on delete cascade,
  previous_revision_id uuid references public.content_revisions(id) on delete set null,
  content_hash text not null,
  title text,
  author text,
  publication text,
  published_at timestamptz,
  language text,
  extracted_text text not null,
  extraction_method text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (capture_id, content_hash)
);

create index content_revisions_hash_idx on public.content_revisions(user_id, content_hash);

create table public.item_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  revision_id uuid not null unique references public.content_revisions(id) on delete cascade,
  title text not null,
  summary text not null,
  key_ideas jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  source_clues jsonb not null default '{}'::jsonb,
  confidence real not null check (confidence between 0 and 1),
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  name text not null,
  normalized_name text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table public.item_topics (
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  revision_id uuid not null references public.content_revisions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  confidence real not null default 1 check (confidence between 0 and 1),
  primary key (revision_id, topic_id)
);

create table public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  capture_id uuid not null references public.captures(id) on delete cascade,
  revision_id uuid not null references public.content_revisions(id) on delete cascade,
  ordinal integer not null,
  content text not null,
  start_offset integer not null,
  end_offset integer not null,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (revision_id, ordinal)
);

create index content_chunks_search_idx on public.content_chunks using gin(search_vector);
create index content_chunks_embedding_idx on public.content_chunks using hnsw (embedding vector_cosine_ops);
create index content_chunks_user_idx on public.content_chunks(user_id, created_at desc);

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  title text not null,
  overview text not null,
  themes jsonb not null default '[]'::jsonb,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_sent_at timestamptz,
  model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, period_end),
  check (period_start < period_end)
);

create table public.digest_entries (
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  digest_id uuid not null references public.digests(id) on delete cascade,
  capture_id uuid not null references public.captures(id) on delete cascade,
  ordinal integer not null,
  primary key (digest_id, capture_id),
  unique (digest_id, ordinal)
);

create table public.digest_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  digest_id uuid not null references public.digests(id) on delete cascade,
  current_capture_id uuid not null references public.captures(id) on delete cascade,
  prior_capture_id uuid not null references public.captures(id) on delete cascade,
  relation_type public.relation_type not null,
  explanation text not null,
  current_evidence text not null,
  prior_evidence text not null,
  confidence real not null check (confidence between 0.8 and 1),
  created_at timestamptz not null default now(),
  check (current_capture_id <> prior_capture_id)
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  capture_id uuid references public.captures(id) on delete cascade,
  digest_id uuid references public.digests(id) on delete cascade,
  job_type text not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0,
  error_category text,
  error_detail text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.extension_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  code_hash text not null unique,
  token_hash text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  capture_id uuid not null,
  object_keys text[] not null default '{}',
  run_after timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_touch before update on public.user_profiles for each row execute function public.touch_updated_at();
create trigger digest_settings_touch before update on public.digest_settings for each row execute function public.touch_updated_at();
create trigger captures_touch before update on public.captures for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare matching_invite public.invites%rowtype;
begin
  select * into matching_invite
  from public.invites
  where email = new.email::citext
    and used_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if matching_invite.id is null then
    raise exception 'A valid invite is required';
  end if;

  insert into public.user_profiles(user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  insert into public.digest_settings(user_id) values (new.id);
  update public.invites set used_at = now() where id = matching_invite.id;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.soft_delete_capture(target_capture_id uuid)
returns void
language plpgsql
security invoker
as $$
declare keys text[];
begin
  select coalesce(array_agg(asset_key), '{}') into keys
  from (
    select object_key as asset_key from public.assets where capture_id = target_capture_id and user_id = auth.uid()
    union all
    select normalized_object_key as asset_key from public.assets where capture_id = target_capture_id and user_id = auth.uid() and normalized_object_key is not null
  ) all_asset_keys;

  update public.captures
  set status = 'deleting', deleted_at = now()
  where id = target_capture_id and user_id = auth.uid() and deleted_at is null;

  if found then
    insert into public.cleanup_queue(user_id, capture_id, object_keys)
    values (auth.uid(), target_capture_id, keys);
  end if;
end;
$$;

create or replace function public.hybrid_search(
  search_query text,
  query_embedding vector(1536),
  result_limit integer default 20,
  source_filter public.capture_kind default null,
  status_filter public.capture_status default null,
  captured_after timestamptz default null,
  captured_before timestamptz default null
)
returns table (
  capture_id uuid,
  revision_id uuid,
  title text,
  summary text,
  snippet text,
  score double precision
)
language sql
stable
security invoker
as $$
  with ranked as (
    select
      cc.capture_id,
      cc.revision_id,
      ia.title,
      ia.summary,
      left(cc.content, 500) as snippet,
      ts_rank_cd(cc.search_vector, websearch_to_tsquery('simple', search_query)) as text_score,
      case when query_embedding is null or cc.embedding is null then 0
        else 1 - (cc.embedding <=> query_embedding)
      end as semantic_score
    from public.content_chunks cc
    join public.captures c on c.id = cc.capture_id
    join public.item_analyses ia on ia.revision_id = cc.revision_id
    where cc.user_id = auth.uid()
      and c.deleted_at is null
      and (source_filter is null or c.kind = source_filter)
      and (status_filter is null or c.status = status_filter)
      and (captured_after is null or c.captured_at >= captured_after)
      and (captured_before is null or c.captured_at < captured_before)
  )
  select capture_id, revision_id, title, summary, snippet,
    ((text_score * 0.45) + (semantic_score * 0.55))::double precision as score
  from ranked
  where text_score > 0 or semantic_score > 0.2
  order by score desc
  limit least(greatest(result_limit, 1), 100);
$$;

create or replace function public.match_topic(
  target_user_id uuid,
  query_embedding vector(1536),
  minimum_similarity double precision default 0.88
)
returns table (topic_id uuid, name text, similarity double precision)
language sql
stable
security definer
set search_path = public
as $$
  select id, topics.name, (1 - (embedding <=> query_embedding))::double precision
  from public.topics
  where user_id = target_user_id and embedding is not null
    and 1 - (embedding <=> query_embedding) >= minimum_similarity
  order by embedding <=> query_embedding
  limit 1;
$$;

create or replace function public.related_chunks(
  target_user_id uuid,
  current_capture uuid,
  before_time timestamptz,
  query_embedding vector(1536),
  result_limit integer default 20
)
returns table (capture_id uuid, title text, summary text, evidence text, similarity double precision)
language sql
stable
security definer
set search_path = public
as $$
  select cc.capture_id, ia.title, ia.summary, left(cc.content, 1200),
    (1 - (cc.embedding <=> query_embedding))::double precision
  from public.content_chunks cc
  join public.captures c on c.id = cc.capture_id
  join public.item_analyses ia on ia.revision_id = cc.revision_id
  where cc.user_id = target_user_id
    and cc.capture_id <> current_capture
    and c.captured_at < before_time
    and c.deleted_at is null
    and cc.embedding is not null
  order by cc.embedding <=> query_embedding
  limit least(greatest(result_limit, 1), 100);
$$;

alter table public.invites enable row level security;
alter table public.user_profiles enable row level security;
alter table public.digest_settings enable row level security;
alter table public.captures enable row level security;
alter table public.assets enable row level security;
alter table public.content_revisions enable row level security;
alter table public.item_analyses enable row level security;
alter table public.topics enable row level security;
alter table public.item_topics enable row level security;
alter table public.content_chunks enable row level security;
alter table public.digests enable row level security;
alter table public.digest_entries enable row level security;
alter table public.digest_relations enable row level security;
alter table public.job_runs enable row level security;
alter table public.extension_pairings enable row level security;
alter table public.cleanup_queue enable row level security;

create policy "users read own profile" on public.user_profiles for select using (user_id = auth.uid());
create policy "users update own profile" on public.user_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage digest settings" on public.digest_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users read own captures" on public.captures for select using (user_id = auth.uid() and deleted_at is null);
create policy "users create own captures" on public.captures for insert with check (user_id = auth.uid());
create policy "users update own captures" on public.captures for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users read own assets" on public.assets for select using (user_id = auth.uid());
create policy "users create own assets" on public.assets for insert with check (user_id = auth.uid());
create policy "users read own revisions" on public.content_revisions for select using (user_id = auth.uid());
create policy "users read own analyses" on public.item_analyses for select using (user_id = auth.uid());
create policy "users read own topics" on public.topics for select using (user_id = auth.uid());
create policy "users read own item topics" on public.item_topics for select using (user_id = auth.uid());
create policy "users read own chunks" on public.content_chunks for select using (user_id = auth.uid());
create policy "users read own digests" on public.digests for select using (user_id = auth.uid());
create policy "users read own digest entries" on public.digest_entries for select using (user_id = auth.uid());
create policy "users read own digest relations" on public.digest_relations for select using (user_id = auth.uid());
create policy "users read own jobs" on public.job_runs for select using (user_id = auth.uid());
create policy "users manage extension pairing" on public.extension_pairings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own cleanup" on public.cleanup_queue for select using (user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('captures', 'captures', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "users read own capture objects" on storage.objects for select
using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload own capture objects" on storage.objects for insert
with check (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own capture objects" on storage.objects for delete
using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

grant execute on function public.soft_delete_capture(uuid) to authenticated;
grant execute on function public.hybrid_search(text, vector, integer, public.capture_kind, public.capture_status, timestamptz, timestamptz) to authenticated;
revoke execute on function public.match_topic(uuid, vector, double precision) from public, anon, authenticated;
revoke execute on function public.related_chunks(uuid, uuid, timestamptz, vector, integer) from public, anon, authenticated;
grant execute on function public.match_topic(uuid, vector, double precision) to service_role;
grant execute on function public.related_chunks(uuid, uuid, timestamptz, vector, integer) to service_role;
