-- Corrected approach, same lesson as lock_down_password_column_v2.sql:
-- the column-specific `revoke update (coins, tx_log) on members from
-- anon, authenticated` in lock_down_coins_columns.sql reported success
-- but changed nothing -- confirmed live via has_column_privilege(). Root
-- cause: anon already has a TABLE-WIDE UPDATE grant on members
-- (Supabase's default for every new table), which already covers every
-- column including coins and tx_log. A column-specific REVOKE doesn't
-- carve an exception out of a broader table-level grant -- Postgres
-- checks each independently, and the table-wide grant alone is enough to
-- allow the write regardless of what the column-level ACL says.
--
-- The correct pattern: revoke the blanket table-level UPDATE entirely,
-- then explicitly grant UPDATE back for every column except coins,
-- tx_log, decay_log, attend_log, and password. All five now have zero
-- legitimate direct writers left: coins/tx_log/decay_log/attend_log all
-- go through a SECURITY DEFINER RPC (place_bid_atomic,
-- adjust_member_coins(_and_log), record/revert_attendance_and_log,
-- apply_member_decay_atomic) or a brand-new-row INSERT (unaffected by
-- this, since INSERT is a separate privilege from UPDATE); password
-- already goes through set_member_password and was never covered by the
-- app's own writes anyway (see setMembers's password-exclusion comment).
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor.

revoke update on members from anon, authenticated;

grant update (
  id, name, username, role, cls, power, attendance, join_date,
  auction_wins, discord, power_log, profile_rarity, awakening_level,
  last_login_ts
) on members to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFY: run these individually after the block above.
-- ============================================================

-- 1. Should now FAIL with a permission error (42501).
-- update members set coins = 999999 where name = 'put a real test member here';
-- update members set tx_log = '[]' where name = 'put a real test member here';

-- 2. Should still succeed (a column NOT excluded above).
-- update members set discord = discord where name = 'put a real test member here';
