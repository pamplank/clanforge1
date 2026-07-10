-- Finds "(backfilled ...)" Auction Win tx_log entries that do NOT match
-- any bid the same member actually placed (per bid_events) on an auction
-- with that name and amount.
--
-- Why this matters: increment_auction_win only ever writes the tx_log
-- record (see scripts/increment_auction_win.sql) — the real coin
-- deduction already happened earlier via the bid-escrow path
-- (adjustMemberCoinsAtomic). So a misattributed backfill entry costs the
-- member NO real coins, but makes their logged history claim a payment
-- that never happened — which understates supposed_coins and inflates
-- the current-vs-supposed diff without any actual overpayment bug.
--
-- Likely root cause: the backfill matched auctions by NAME, and names
-- like "13:00 Match 2 Clan Annihilation MVP" recur every week with a
-- different winner/price, so a member can get charged for a same-named
-- auction from a different week than the one they actually won.

with backfilled as (
  select
    m.name as member_name,
    (elem->>'reason') as reason,
    (elem->>'change')::numeric as charged_amount,
    (elem->>'ts')::bigint as ts
  from members m,
       jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
  where elem->>'logType' = 'Auction Win'
    and elem->>'reason' ilike '%backfilled%'
)
select
  b.member_name,
  b.reason,
  b.charged_amount,
  exists (
    select 1 from bid_events be
    where be.bidder = b.member_name
      and b.reason ilike '%' || be.auction_name || '%'
      and be.amount = -b.charged_amount
  ) as matches_own_bid_history
from backfilled b
order by matches_own_bid_history asc, b.member_name;
