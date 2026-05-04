-- Run this SQL in Supabase SQL editor.
-- It lets authenticated guardians permanently delete a child they have access to.

create or replace function public.delete_child(child_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_children
    where child_id = child_uuid
    and user_id = auth.uid()
  ) then
    raise exception 'Not allowed to delete this child';
  end if;

  delete from public.calendar_events where child_id = child_uuid;
  delete from public.custody_schedules where child_id = child_uuid;
  delete from public.expenses where child_id = child_uuid;
  delete from public.recurring_activities where child_id = child_uuid;
  delete from public.user_children where child_id = child_uuid;
  delete from public.children where id = child_uuid;
end;
$$;

revoke all on function public.delete_child(uuid) from public;
grant execute on function public.delete_child(uuid) to authenticated;
