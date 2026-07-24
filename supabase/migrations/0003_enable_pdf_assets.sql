alter table public.captures drop constraint if exists non_image_has_url;
alter table public.captures
  add constraint non_file_has_url check (kind in ('image', 'pdf') or original_url is not null);

alter table public.assets add column if not exists original_name text;
alter table public.assets drop constraint if exists assets_ordinal_check;
alter table public.assets
  add constraint assets_ordinal_check check (ordinal between 0 and 19);
alter table public.assets drop constraint if exists assets_size_bytes_check;
alter table public.assets
  add constraint assets_size_bytes_check check (size_bytes between 1 and 26214400);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('captures', 'captures', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
