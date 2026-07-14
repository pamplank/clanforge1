-- Atomic coin adjustment + tx_log append, same pattern as
-- increment_auction_win.sql (see App.jsx comments near
-- adjustMemberCoinsAtomic/claimAuctionWinAndLog): a single UPDATE
-- statement that changes `coins` and appends the matching Points History
-- entry in one indivisible database operation, instead of two separate
-- steps (an atomic coins-only RPC, then a full local-array overwrite via
-- setMembers back to tx_log).
--
-- ROOT CAUSE this closes: placeBid's fire-and-forget adjustMemberCoinsAtomic
-- calls were already fixed to await + retry (see App.jsx), which stops a
-- transient RPC failure from leaving a phantom log entry. But the tx_log
-- write itself still went through setMembers, which persists this
-- browser's ENTIRE locally-cached tx_log array for the target member, not
-- an atomic append. Verified live: outbidding a member from a SECOND
-- browser can write that browser's stale local copy of the outbid
-- member's tx_log back to the database, silently discarding whatever
-- entry that member's OWN browser had just appended (e.g. their "Bid
-- Placed" entry vanishing the moment they're refunded for being outbid) --
-- coins stayed correct throughout (still real balance, unaffected by this
-- race) but the log lost an entry. Doing the coins change AND the log
-- append as one UPDATE, independent of any browser's locally cached
-- array, removes the race entirely for this write.
--
-- Run this once in the Supabase SQL Editor for this project.
create or replace function adjust_member_coins_and_log(
  p_member_name text,
  p_delta numeric,
  p_tx_entry jsonb
)
returns numeric
language plpgsql
as $$
declare
  new_coins numeric;
begin
  update members
  set
    coins = coins + p_delta,
    tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(p_tx_entry))::text
  where name = p_member_name
  returning coins into new_coins;

  return new_coins;
end;
$$;
