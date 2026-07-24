alter type public.capture_kind add value if not exists 'text';

alter table public.captures
  add column if not exists pasted_text text;
