alter table public.captures drop constraint if exists non_file_has_url;
alter table public.captures drop constraint if exists capture_source_required;
alter table public.captures
  add constraint capture_source_required check (
    kind in ('image', 'pdf')
    or (kind = 'text' and pasted_text is not null and char_length(btrim(pasted_text)) > 0)
    or (kind in ('link', 'youtube') and original_url is not null)
  );

alter table public.captures drop constraint if exists captures_pasted_text_size_check;
alter table public.captures
  add constraint captures_pasted_text_size_check check (
    pasted_text is null or char_length(pasted_text) between 1 and 250000
  );
