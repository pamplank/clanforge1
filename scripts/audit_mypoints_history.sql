-- Full "My Points History" reconciliation for ALL members, including
-- bidding activity — not just attendance/decay/manual adjustments.
--
-- Background: bidding moves real coins (adjustMemberCoinsAtomic deducts on
-- every bid, refunds the previous top bidder) but writes NOTHING to any
-- per-member log (tx_log/attend_log/decay_log) — it's pure escrow. Only
-- the final winning bid ever gets a permanent record, written as an
-- "Auction Win" tx_log entry by increment_auction_win when the auction
-- closes. `bid_events` is a separate, permanent, never-purged table
-- (unlike `auctions`, which drops ended rows after 14 days — see
-- api/clear-auction-history.js) recording every bid ever placed, so it's
-- the real source of truth for bidding history even for old auctions.
--
-- Run each numbered block separately in the Supabase SQL editor.


-- ============================================================
-- 1) BALANCE AUDIT (all members) — now also nets out coins
--    currently held in escrow by an ACTIVE auction bid, which the
--    original tx_log/attend_log/decay_log-only audit couldn't see.
-- ============================================================
with escrow as (
  select top_bidder as name, sum(current_bid) as escrowed
  from auctions
  where status = 'active' and top_bidder is not null
  group by top_bidder
),
logs as (
  select
    m.id,
    m.name,
    m.coins as current_coins,
    coalesce((
      select sum((elem->>'change')::numeric)
      from jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
    ), 0) as tx_log_total,
    coalesce((
      select sum((elem->>'coins')::numeric)
      from jsonb_array_elements(coalesce(m.attend_log::jsonb, '[]'::jsonb)) elem
    ), 0) as attend_log_total,
    coalesce((
      select sum((elem->>'amount')::numeric)
      from jsonb_array_elements(coalesce(m.decay_log::jsonb, '[]'::jsonb)) elem
    ), 0) as decay_log_total,
    coalesce(e.escrowed, 0) as active_bid_escrow
  from members m
  left join escrow e on e.name = m.name
)
select
  name,
  current_coins,
  (tx_log_total + attend_log_total + decay_log_total - active_bid_escrow) as supposed_coins,
  current_coins - (tx_log_total + attend_log_total + decay_log_total - active_bid_escrow) as diff,
  tx_log_total,
  attend_log_total,
  decay_log_total,
  active_bid_escrow
from logs
order by diff desc;


-- ============================================================
-- 2) MISSING "AUCTION WIN" ENTRIES — reconstructs the true winner
--    of every auction ever bid on (from bid_events, so it survives
--    auctions being purged after 14 days) and flags any winner whose
--    tx_log has no matching "Auction Win" entry — i.e. coins were
--    genuinely paid (via bidding escrow) but the record of it never
--    got written to My Points History (the increment_auction_win bug
--    fixed in scripts/increment_auction_win.sql would look exactly
--    like this: real payment, missing record).
-- ============================================================
with final_bids as (
  select distinct on (auction_name)
    auction_name, bidder, amount, ts
  from bid_events
  order by auction_name, ts desc
)
select
  fb.bidder,
  fb.auction_name,
  fb.amount as amount_actually_paid,
  to_timestamp(fb.ts/1000) as won_at,
  exists (
    select 1
    from members m, jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
    where m.name = fb.bidder
      and elem->>'logType' = 'Auction Win'
      and elem->>'reason' = 'Won auction: ' || fb.auction_name
      and (elem->>'change')::numeric = -fb.amount
  ) as has_matching_tx_log_entry
from final_bids fb
order by has_matching_tx_log_entry asc, fb.ts desc;


-- ============================================================
-- 3) FULL PER-MEMBER LEDGER — every tx_log/attend_log/decay_log
--    entry AND every bid_events row, chronologically interleaved,
--    with a running total, for every member. This is the raw
--    evidence to eyeball if (1) or (2) flags someone.
-- ============================================================
with entries as (
  select
    m.name,
    'tx_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'change')::numeric as amount,
    coalesce(elem->>'logType', '') as label,
    coalesce(elem->>'reason', '') as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem

  union all

  select
    m.name,
    'attend_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'coins')::numeric as amount,
    'Attendance' as label,
    coalesce(elem->>'event', '') || ' (' || coalesce(elem->>'qualifier', '') || ')' as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.attend_log::jsonb, '[]'::jsonb)) elem

  union all

  select
    m.name,
    'decay_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'amount')::numeric as amount,
    'Weekly Decay' as label,
    '' as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.decay_log::jsonb, '[]'::jsonb)) elem

  union all

  -- Every bid placed (not net of refunds — see note above: only the
  -- final/highest bid per auction is a permanent charge, everything
  -- else nets to zero once the previous bidder is refunded).
  select
    be.bidder as name,
    'bid_events' as source,
    be.ts,
    -be.amount as amount,
    'Bid Placed' as label,
    be.auction_name as detail
  from bid_events be
)
select
  name,
  to_timestamp(ts/1000) as when_utc,
  source,
  label,
  amount,
  sum(amount) over (partition by name order by ts rows between unbounded preceding and current row) as running_total_excl_bid_refunds,
  detail
from entries
order by name, ts;
