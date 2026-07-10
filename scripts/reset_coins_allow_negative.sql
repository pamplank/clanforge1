-- Follow-up to reset_coins_to_history.sql: that script floored every
-- member's target at 0 ("greatest(..., 0)"), so anyone whose logged
-- spending genuinely exceeded their logged income got set to 0 instead
-- of their real negative balance. Decision now: show the real negative
-- number instead, so a member who owes coins sees their balance rise
-- back toward (and eventually past) zero as they actually earn more -
-- debt shouldn't just get silently forgiven.
--
-- Every tx_log/attend_log/decay_log entry is written in lockstep with a
-- coins change everywhere except escrow (active bids, netted out below)
-- and the three admin/attendance-refund code paths that used to clamp
-- at 0 (App.jsx) - the logs themselves were never clamped, so this same
-- history-total formula, unfloored, is still the correct "true" balance
-- even including everything that's happened since the original reset.
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
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0) as target_coins
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
