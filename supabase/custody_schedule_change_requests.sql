-- Run this in Supabase SQL Editor.
-- Adds approval workflow for custody schedule changes between guardians.

create table if not exists public.custody_schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  proposed_schedules jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists custody_schedule_change_requests_child_status_idx
  on public.custody_schedule_change_requests(child_id, status);

alter table public.custody_schedule_change_requests enable row level security;

drop policy if exists "Guardians can view custody schedule change requests" on public.custody_schedule_change_requests;
drop policy if exists "Guardians can create custody schedule change requests" on public.custody_schedule_change_requests;
drop policy if exists "Guardians can review custody schedule change requests" on public.custody_schedule_change_requests;

create policy "Guardians can view custody schedule change requests"
on public.custody_schedule_change_requests
for select
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = custody_schedule_change_requests.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can create custody schedule change requests"
on public.custody_schedule_change_requests
for insert
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.user_children
    where user_children.child_id = custody_schedule_change_requests.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can review custody schedule change requests"
on public.custody_schedule_change_requests
for update
using (
  status = 'pending'
  and requested_by is distinct from auth.uid()
  and exists (
    select 1 from public.user_children
    where user_children.child_id = custody_schedule_change_requests.child_id
      and user_children.user_id = auth.uid()
  )
)
with check (
  status in ('approved', 'rejected')
  and exists (
    select 1 from public.user_children
    where user_children.child_id = custody_schedule_change_requests.child_id
      and user_children.user_id = auth.uid()
  )
);

grant all on public.custody_schedule_change_requests to authenticated;
grant all on public.custody_schedule_change_requests to service_role;

notify pgrst, 'reload schema';
