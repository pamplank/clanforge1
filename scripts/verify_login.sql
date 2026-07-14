-- Closes a real, currently-exploitable data leak: the Supabase anon key
-- (public by design -- it ships in every visitor's downloaded JS bundle)
-- currently has SELECT access to members.password, which is stored in
-- plaintext. Anyone who opens devtools on the live site, copies the anon
-- key out of the bundle, and queries /rest/v1/members can read every
-- member's real login password today -- confirmed live this session.
--
-- The app's login screen used to work by loading EVERY member (including
-- passwords) into the browser before anyone even logs in, then comparing
-- the entered username/password against that array client-side -- which
-- is *why* anon needed read access to the whole table. This function
-- moves that comparison server-side instead, via SECURITY DEFINER (runs
-- with the function owner's privileges rather than the caller's, so it
-- can still read the password column internally after the REVOKE below
-- takes anon's own read access away). It returns only the matching
-- member's id on success, or null on a bad username/password -- never
-- the password itself, to anyone, including a legitimate login attempt.
--
-- `set search_path` pins name resolution to a fixed, known schema list --
-- standard hardening for SECURITY DEFINER functions, since an attacker
-- who could otherwise influence unqualified name resolution would have
-- that resolution run with this function's elevated privileges.
--
-- App-side: src/App.jsx's verifyLogin() calls this instead of comparing
-- locally; LoginScreen and ChangePasswordModal (the only two places that
-- ever compared a password) now go through it. MEMBER_ALL_COLS_NO_PASSWORD
-- replaces the old `select=*` member fetches so the password column is
-- never requested client-side at all anymore.
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor -- the
-- function is created first, then the REVOKE takes effect immediately
-- after, in the same transaction.
create or replace function verify_login(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_id text;
begin
  select id::text into matched_id
  from members
  where lower(username) = lower(p_username)
    and password = p_password
  limit 1;

  return matched_id;
end;
$$;

-- Blocks the anon (and authenticated) role from reading the password
-- column directly, while leaving every other column -- and every other
-- read/write path the app already depends on -- untouched. verify_login
-- above can still read it internally regardless, since SECURITY DEFINER
-- runs as the function's owner, not as anon. Writing a password (login
-- creation, password changes) is UNAFFECTED -- this only blocks reading
-- it back out.
revoke select (password) on members from anon, authenticated;

-- ============================================================
-- VERIFY: run these individually after the block above.
-- ============================================================

-- 1. Should return exactly one row's worth of columns, WITHOUT `password`
--    in the result (confirms the column is genuinely blocked for anon/
--    authenticated, not just hidden by the app's own query).
-- select * from members limit 1;

-- 2. Should return a real member id (as text) for a real username/password,
--    and null for a wrong password -- replace with a real test account
--    you're comfortable using before trusting this.
-- select verify_login('someusername', 'theirrealpassword');
-- select verify_login('someusername', 'definitely-wrong');
