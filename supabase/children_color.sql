-- Run this in Supabase SQL Editor.
-- Adds a per-child custom calendar color so each child can be assigned a
-- distinct, user-chosen color instead of always relying on the fixed
-- auto-assigned palette (DOP-40 / DOP-53 / DOP-65).

alter table if exists public.children
add column if not exists color text;

-- Existing "children" RLS policies already allow any guardian linked via
-- user_children to update a child's row (see child-settings.tsx's existing
-- name/avatar updates), so no additional policy changes are needed here.

-- Refresh PostgREST schema cache so the new column is available immediately.
notify pgrst, 'reload schema';
