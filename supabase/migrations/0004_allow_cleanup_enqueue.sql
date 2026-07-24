drop policy if exists "users enqueue own cleanup" on public.cleanup_queue;

create or replace function public.soft_delete_capture(target_capture_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  keys text[];
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select coalesce(array_agg(asset_key), '{}')
  into keys
  from (
    select object_key as asset_key
    from public.assets
    where capture_id = target_capture_id
      and user_id = caller_id
    union all
    select normalized_object_key as asset_key
    from public.assets
    where capture_id = target_capture_id
      and user_id = caller_id
      and normalized_object_key is not null
  ) all_asset_keys;

  update public.captures
  set deleted_at = now(),
      status = 'deleting'
  where id = target_capture_id
    and user_id = caller_id
    and deleted_at is null;

  if found then
    insert into public.cleanup_queue (user_id, capture_id, object_keys)
    values (caller_id, target_capture_id, keys);
  end if;
end;
$$;

revoke all on function public.soft_delete_capture(uuid) from public;
revoke all on function public.soft_delete_capture(uuid) from anon;
grant execute on function public.soft_delete_capture(uuid) to authenticated;
