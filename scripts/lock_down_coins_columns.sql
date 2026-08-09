-- Closes a currently-exploitable vulnerability: Row Level Security is
-- disabled on every table in this database, and the anon key -- public by
-- design, embedded in every visitor's downloaded JS bundle -- has a full
-- table-level UPDATE grant on `members`, covering `coins` and `tx_log`
-- directly. Anyone who opens devtools, copies the anon key out of the
-- bundle, and sends a raw PATCH to /rest/v1/members can set their own (or
-- anyone's) coin balance to literally anything, or fabricate their own
-- tx_log history -- completely bypassing every atomic RPC this app's
-- whole coin economy depends on. Confirmed open today, 2026-08-09.
--
-- This is also very plausibly the real, no-exploit-needed cause of the
-- 2026-08-06/07 incident investigated this session (Dexxu's missing
-- refund and the other broken auctions) -- see setMembers's own fix in
-- src/App.jsx, landed the same session, which closes an ordinary-admin-
-- action version of nearly the same failure: a stale local snapshot
-- silently overwriting a real, just-landed coin/log change. That fix
-- doesn't need this migration to work, but this migration is what
-- actually prevents a THIRD, deliberate version of the same failure.
--
-- Every legitimate writer of coins/tx_log after this migration is either
-- one of the SECURITY DEFINER functions below, or a plain INSERT of a
-- brand-new member row (member seeding / AddMemberModal) -- INSERT
-- privilege is separate from UPDATE in Postgres's ACL model and is
-- untouched by the REVOKE below, so those keep working unmodified.
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor.

revoke update (coins, tx_log) on members from anon, authenticated;

-- These six already ran as one indivisible UPDATE per call and were
-- already the only safe way to change coins/tx_log -- but as SECURITY
-- INVOKER (the caller's own privileges), so revoking anon's own grant
-- above would have broken them too. SECURITY DEFINER runs them with the
-- function owner's privileges regardless of the caller's, same pattern
-- already established by verify_login / set_member_password. search_path
-- pinned per Postgres's own SECURITY DEFINER hardening guidance.
alter function place_bid_atomic(p_auction_id text, p_bidder text, p_amount numeric, p_min_increment numeric) security definer set search_path = public;
alter function adjust_member_coins_and_log(p_member_name text, p_delta numeric, p_tx_entry jsonb) security definer set search_path = public;
alter function adjust_member_coins(member_name text, delta integer) security definer set search_path = public;
alter function record_attendance_and_log(p_member_name text, p_coins_delta numeric, p_attendance_delta integer, p_attend_entry jsonb, p_bonus_tx_entries jsonb) security definer set search_path = public;
alter function revert_attendance_and_log(p_member_name text, p_refund numeric, p_attendance_delta integer, p_attend_entry jsonb, p_entry_ts text) security definer set search_path = public;
alter function increment_auction_win(p_member_name text, p_tx_entry jsonb) security definer set search_path = public;

-- New: weekly decay was the one other real, legitimate direct writer of
-- `coins` found while auditing this -- both an admin "run decay now"
-- client action and the check-weekly-decay.js cron job PATCHed
-- members.coins/decay_log directly. Routes both through the same atomic-
-- RPC pattern as everything else instead of carving out a raw grant
-- exception (or a separate service-role key) just for decay.
create or replace function apply_member_decay_atomic(p_member_id bigint, p_new_coins numeric, p_decay_log text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  result numeric;
begin
  update members
  set coins = p_new_coins,
      decay_log = p_decay_log
  where id = p_member_id
  returning coins into result;
  return result;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFY: run these individually after the block above.
-- ============================================================

-- 1. Should now FAIL with a permission error (42501) -- confirms the
--    exploit is actually closed, not just hidden by the app's own UI.
-- update members set coins = 999999 where name = 'put a real test member here';

-- 2. Should still succeed and return the new balance -- confirms the RPC
--    path still works after the lockdown.
-- select adjust_member_coins_and_log('put a real test member here', 1, '{"change":1,"reason":"migration verify","date":"1/1/2000","ts":0,"logType":"Balance Correction","addedBy":"System"}'::jsonb);
