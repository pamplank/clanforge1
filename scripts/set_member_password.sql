-- Closes a regression from scripts/lock_down_password_column_v2.sql: that
-- script revoked anon's SELECT on members.password (to stop the password
-- leak), but PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` -- which is
-- exactly what every setMembers()-driven write in this app uses via
-- PostgREST's `Prefer: resolution=merge-duplicates` -- requires SELECT
-- privilege on any column that appears in the DO UPDATE SET list, not
-- just UPDATE privilege. Confirmed live: a disposable test upsert with no
-- password field in the payload succeeded (201); the identical upsert
-- WITH a password field failed with the same 42501 "permission denied"
-- error the original leak fix was supposed to eliminate -- even for a
-- brand-new row with return=minimal, since Postgres checks this at the
-- statement level regardless of whether a real conflict occurs. That
-- silently broke both AddMemberModal (new member's initial password) and
-- ChangePasswordModal (self-service password change) the moment the
-- previous fix shipped.
--
-- Fix: password writes now go through this dedicated SECURITY DEFINER
-- function instead of ever appearing in a generic members upsert payload
-- (see MEMBER_ALL_COLS_NO_PASSWORD / setMembers in App.jsx -- password is
-- no longer included in that row-builder's payload at all). This uses a
-- plain UPDATE, not upsert/ON CONFLICT, so the stricter privilege rule
-- above never applies -- SECURITY DEFINER lets it write the column
-- despite anon having no SELECT on it, the same way verify_login reads it.
--
-- Run this once in the Supabase SQL Editor for this project.
create or replace function set_member_password(p_member_id text, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update members
  set password = p_new_password
  where id::text = p_member_id;
end;
$$;
