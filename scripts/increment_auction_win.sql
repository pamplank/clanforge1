-- Atomic auction-win increment, matching the same pattern as
-- adjust_member_coins and place_bid_atomic (see App.jsx comments near
-- adjustMemberCoinsAtomic/placeBidAtomic): a single UPDATE statement that
-- reads and writes auction_wins in one indivisible database operation,
-- instead of the old client-side "read local auctionWins, add 1 in JS,
-- write the whole members table back" pattern.
--
-- That old pattern could silently lose a win: if the same member won two
-- different auctions closing around the same time (processed by different
-- browser tabs, or the same tab before a poll caught up), both reads could
-- see the same stale win count, and whichever write landed last in
-- Postgres would overwrite the other — discarding one win entirely, even
-- though both auctions correctly showed that member as the winner.
-- Postgres serializes UPDATEs to the same row, so this can never happen
-- here no matter how many auctions close for the same member at once.
--
-- Run this once in the Supabase SQL Editor for this project.
--
-- FIX (see incident notes below): members.tx_log is actually a TEXT column
-- storing a JSON-encoded string (matching how every other read/write path
-- in the client treats it - always JSON.stringify/JSON.parse), not a real
-- jsonb column. The original version below assumed jsonb and did
-- `coalesce(tx_log, '[]'::jsonb)`, which Postgres cannot type-check against
-- a text column - "COALESCE types text and jsonb cannot be matched". This
-- has been failing on every single call where tx_log is non-null (i.e.
-- basically every real member), permanently losing auction winners' coin-
-- deduction history entry and win counter increment, ever since this RPC
-- replaced the older non-atomic path. Casting tx_log to jsonb for the
-- concatenation and back to text for storage fixes this while keeping the
-- on-disk representation identical to every other write path.
create or replace function increment_auction_win(
  p_member_name text,
  p_tx_entry jsonb
)
returns int
language plpgsql
as $$
declare
  new_wins int;
begin
  update members
  set
    auction_wins = coalesce(auction_wins, 0) + 1,
    tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(p_tx_entry))::text
  where name = p_member_name
  returning auction_wins into new_wins;

  return new_wins;
end;
$$;
