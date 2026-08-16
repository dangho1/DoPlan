-- Run this in Supabase SQL Editor.
-- DOP-42: Adds a per-child currency setting for shared expenses.
--
-- Nullable text column, defaulting to 'SEK' at the DB level (this is a Swedish
-- team and SEK is the sensible default rather than USD). Existing rows get
-- backfilled to 'SEK' too; the in-app currency selector on the economics
-- screen lets guardians override it per child at any time.

alter table if exists public.children
add column if not exists currency text default 'SEK';

update public.children
set currency = 'SEK'
where currency is null;

-- Refresh PostgREST schema cache so the new column is available immediately.
notify pgrst, 'reload schema';
