-- Run this in Supabase SQL Editor.
-- DOP-45: Adds a "paid" status to expenses so guardians can track and browse
-- payment history instead of relying on memory (and to make room for
-- replacing the standalone Delete action with a "Mark as paid" toggle).
--
-- Nullable boolean, defaulting to false. Existing rows are backfilled to
-- false (unpaid) since we have no historical payment data to infer from.
-- Row-level security is unaffected: expenses already has an UPDATE policy
-- scoped through user_children (see expenses_schema.sql), which covers
-- updates to this new column too.

alter table if exists public.expenses
add column if not exists paid boolean default false;

update public.expenses
set paid = false
where paid is null;

-- Refresh PostgREST schema cache so the new column is available immediately.
notify pgrst, 'reload schema';
