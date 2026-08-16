-- Run this in Supabase SQL Editor.
-- Adds a per-child contact book (teacher, coach, doctor, and other important people).

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  name text not null,
  role text,
  phone_number text,
  email text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_child_id_idx
  on public.contacts(child_id);

alter table public.contacts enable row level security;

drop policy if exists "Guardians can view contacts" on public.contacts;
drop policy if exists "Guardians can create contacts" on public.contacts;
drop policy if exists "Guardians can update contacts" on public.contacts;
drop policy if exists "Guardians can delete contacts" on public.contacts;

create policy "Guardians can view contacts"
on public.contacts
for select
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = contacts.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can create contacts"
on public.contacts
for insert
with check (
  exists (
    select 1 from public.user_children
    where user_children.child_id = contacts.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can update contacts"
on public.contacts
for update
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = contacts.child_id
      and user_children.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.user_children
    where user_children.child_id = contacts.child_id
      and user_children.user_id = auth.uid()
  )
);

create policy "Guardians can delete contacts"
on public.contacts
for delete
using (
  exists (
    select 1 from public.user_children
    where user_children.child_id = contacts.child_id
      and user_children.user_id = auth.uid()
  )
);

grant all on public.contacts to authenticated;
grant all on public.contacts to service_role;

-- Keep updated_at current on every update.
create or replace function public.update_contacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_contacts_updated_at on public.contacts;
create trigger update_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.update_contacts_updated_at();

notify pgrst, 'reload schema';
