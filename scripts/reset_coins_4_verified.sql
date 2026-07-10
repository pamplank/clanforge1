-- Resets coins to match logged My Points History (net of active-bid
-- escrow) for the 4 members whose remaining drift we chronologically
-- verified: their auction wins all match their own bid_events exactly
-- (real, legitimate spending), yet their overall balance still exceeds
-- what any logged activity explains — confirmed residue of the pre-fix
-- live bidding-refund leak, not a logging error.
--
-- LadyLeti, eithan10, ikillyou, ChiefRGB only. GinisangOtin is
-- deliberately excluded — 2 of GinisangOtin's backfilled tx_log entries
-- were outright fabricated (no matching bid at all, not just mislabeled),
-- so that case needs separate handling rather than this same formula.
--
-- LadyLeti's raw history total comes out negative (her validated real
-- spending exceeds her validated real income) — floored at 0 rather
-- than displaying a negative balance.
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
  where m.name in ('LadyLeti','eithan10','ikillyou','ChiefRGB')
)
select name, current_coins, target_coins, target_coins - current_coins as change
from totals
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
  where m.name in ('LadyLeti','eithan10','ikillyou','ChiefRGB')
)
update members m
set coins = t.target_coins
from totals t
where m.id = t.id
  and m.coins <> t.target_coins;


-- ============================================================
-- STEP 3 — VERIFY (these 4 only)
-- ============================================================
select id, name, coins from members
where name in ('LadyLeti','eithan10','ikillyou','ChiefRGB');
