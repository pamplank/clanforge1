-- Resets every member's `coins` to match their logged My Points History
-- (tx_log + attend_log + decay_log), net of any active-bid escrow, and
-- floored at 0 for anyone whose logged spending exceeds logged income.
--
-- Applied to everyone with remaining drift, not just the members we
-- individually chronologically verified - now that bid_events has been
-- backfilled from the authoritative auctions.bids source (see
-- backfill_missing_bid_events.sql), the earlier concern about
-- unverified false positives (like GinisangOtin's initially-flagged
-- entries, which turned out to be real) is much less of a risk.
--
-- Run each step in order in the Supabase SQL Editor.


-- ============================================================
-- STEP 1 — PREVIEW
-- ============================================================
with escrow as (
  select top_bidder as name, sum(current_bid) as escrowed
  from auctions
  where status = 'active' and top_bidder is not null
  group by top_bidder
),
totals as (
  select
    m.id, m.name, m.coins as current_coins,
    greatest(
      coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
      - coalesce(esc.escrowed, 0),
      0
    ) as target_coins
  from members m
  left join escrow esc on esc.name = m.name
)
select name, current_coins, target_coins, target_coins - current_coins as change
from totals
where current_coins <> target_coins
order by abs(target_coins - current_coins) desc;


-- ============================================================
-- STEP 2 — APPLY
-- ============================================================
with escrow as (
  select top_bidder as name, sum(current_bid) as escrowed
  from auctions
  where status = 'active' and top_bidder is not null
  group by top_bidder
),
totals as (
  select
    m.id,
    greatest(
      coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
      - coalesce(esc.escrowed, 0),
      0
    ) as target_coins
  from members m
  left join escrow esc on esc.name = m.name
)
update members m
set coins = t.target_coins
from totals t
where m.id = t.id
  and m.coins <> t.target_coins;


-- ============================================================
-- STEP 3 — VERIFY: should return zero rows (or only members with an
-- active bid whose escrow shifted between steps 1 and 2 - re-run if so).
-- ============================================================
with escrow as (
  select top_bidder as name, sum(current_bid) as escrowed
  from auctions
  where status = 'active' and top_bidder is not null
  group by top_bidder
),
logs as (
  select
    m.name,
    m.coins as current_coins,
    greatest(
      coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
      - coalesce(esc.escrowed, 0),
      0
    ) as supposed_coins
  from members m
  left join escrow esc on esc.name = m.name
)
select name, current_coins, supposed_coins, current_coins - supposed_coins as diff
from logs
where current_coins <> supposed_coins
order by abs(current_coins - supposed_coins) desc;
