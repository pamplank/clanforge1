-- Corrected approach: `revoke select (password) on members from anon`
-- (see revoke_password_select_only.sql) reported success but never
-- actually blocked anything -- confirmed live, twice, including after a
-- PostgREST schema-cache reload. Root cause: anon already has a
-- TABLE-WIDE `select` grant on members (Supabase's default for every new
-- table), and that already covers every column including password. A
-- column-specific REVOKE doesn't carve an exception out of a broader
-- table-level grant -- Postgres checks each independently, and the
-- table-wide grant alone is enough to allow the read regardless of what
-- the column-level ACL says.
--
-- The correct pattern: revoke the blanket table-level SELECT entirely,
-- then explicitly grant SELECT back for every column except password.
-- Only affects reads -- INSERT/UPDATE (needed for login/password-change
-- writes) are untouched.
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor.
revoke select on members from anon, authenticated;

grant select (
  id, name, username, role, cls, power, coins, attendance, join_date,
  auction_wins, decay_log, tx_log, attend_log, discord, power_log,
  profile_rarity, awakening_level, last_login_ts
) on members to anon, authenticated;

notify pgrst, 'reload schema';
