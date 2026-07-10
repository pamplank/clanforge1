-- Resets every member's `coins` to exactly match the sum of their own
-- logged history (tx_log + attend_log + decay_log), closing out the
-- remaining drift from the pre-fix live bidding-refund leak (see
-- scripts/fix_place_bid_atomic_refund_target.sql for that root cause).
--
-- This is a deliberate, blunt reset — not a targeted correction. It will:
--   - claw back coins from members who benefited from stray refunds
--   - also reduce members whose real activity legitimately isn't fully
--     captured in the log for other reasons
-- The one safeguard applied: a member currently the top bidder on a
-- still-ACTIVE auction has real coins legitimately held in escrow that
-- isn't in their log yet (the auction hasn't closed) — that amount is
-- excluded from their reset target so an open bid isn't punished.
--
-- Run each step in order in the Supabase SQL Editor.


-- ============================================================
-- STEP 1 — PREVIEW: shows current coins, the reset target (history
-- total, net of any active-bid escrow), and the change every member
-- would see. Review before applying.
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
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0) as target_coins
  from members m
  left join escrow esc on esc.name = m.name
)
select
  name,
  current_coins,
  target_coins,
  target_coins - current_coins as change
from totals
where current_coins <> target_coins
order by abs(target_coins - current_coins) desc;


-- ============================================================
-- STEP 2 — APPLY: sets coins to the reset target for every member
-- whose current coins don't already match it.
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
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0) as target_coins
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
-- active bid whose escrow shifted between steps 1 and 2 — re-run if so).
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
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0) as supposed_coins
  from members m
  left join escrow esc on esc.name = m.name
)
select name, current_coins, supposed_coins, current_coins - supposed_coins as diff
from logs
where current_coins <> supposed_coins
order by abs(current_coins - supposed_coins) desc;
