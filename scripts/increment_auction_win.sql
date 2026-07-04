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
    tx_log = coalesce(tx_log, '[]'::jsonb) || jsonb_build_array(p_tx_entry)
  where name = p_member_name
  returning auction_wins into new_wins;

  return new_wins;
end;
$$;
