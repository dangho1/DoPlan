-- Run this in Supabase SQL Editor.
-- Adds one-off custody overrides (exceptions) for a single calendar date.
--
-- A custody override always wins over the recurring custody_schedules pattern
-- for the date it covers. The three supported shapes are:
--   assigned_user_id set                       -> an existing guardian has the child
--   assigned_user_id null + assigned_label set -> a non-app person (e.g. "Aunt Lisa")
--   assigned_user_id null + assigned_label null-> nobody has responsibility that day
--
-- start_time / end_time are 'HH:MM' strings. Both null means the override
-- covers the whole day.
-- note is free text used to document handover details (e.g. who picks the
-- child up if they get sick at 10:00).

create table if not exists public.custody_overrides (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  date date not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_label text,
  start_time text,
  end_time text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One override per child per date. The app upserts on this constraint, so a
-- second "Override this day" save replaces the previous exception instead of
-- stacking ambiguous responsibility rows on the same date.
create unique index if not exists custody_overrides_child_date_key
  on public.custody_overrides(child_id, date);

create index if not exists custody_overrides_child_date_idx
  on public.custody_overrides(child_id, date);

alter table public.custody_overrides enable row level security;

drop policy if exists "Guardians can view custody overrides" on public.custody_overrides;
drop policy if exists "Guardians can create custody overrides" on public.custody_overrides;
drop policy if exists "Guardians can update custody overrides" on public.custody_overrides;
drop policy if exists "Guardians can delete custody overrides" on public.custody_overrides;

create policy "Guardians can view custody overrides"
on public.custody_overrides
for select
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = custody_overrides.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can create custody overrides"
on public.custody_overrides
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.user_children
    where user_children.child_id = custody_overrides.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can update custody overrides"
on public.custody_overrides
for update
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = custody_overrides.child_id
      and user_children.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.user_children
    where user_children.child_id = custody_overrides.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can delete custody overrides"
on public.custody_overrides
for delete
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = custody_overrides.child_id
      and user_children.user_id = auth.uid()
  )
);

create or replace function public.update_custody_overrides_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_custody_overrides_updated_at on public.custody_overrides;

create trigger update_custody_overrides_updated_at
  before update on public.custody_overrides
  for each row
  execute function public.update_custody_overrides_updated_at();

grant all on public.custody_overrides to authenticated;
grant all on public.custody_overrides to service_role;

notify pgrst, 'reload schema';
