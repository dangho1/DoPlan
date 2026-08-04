-- Run this in Supabase SQL Editor.
-- Lets each user pick a personal calendar colour that follows them across every
-- child calendar, instead of relying on a fixed palette assigned by list order.
--
-- The column is nullable: null means "no personal colour picked yet", and the
-- app falls back to its built-in palette.

alter table if exists public.user_profiles
add column if not exists color text;

-- Refresh PostgREST schema cache so the new column is available immediately.
notify pgrst, 'reload schema';
