-- Resets coins to match logged My Points History (net of active-bid
-- escrow) for ONLY the 5 members we actually investigated chronologically
-- and confirmed the drift concentrated in the pre-fix live bidding-refund
-- leak windows: GinisangOtin, LadyLeti, ikillyou, eithan10, ChiefRGB.
--
-- Deliberately NOT applied to the other ~30 members with smaller,
-- unverified drift — see the "accept as baseline" decision for those.
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
  where m.name in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')
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
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0) as target_coins
  from members m
  left join escrow esc on esc.name = m.name
  where m.name in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')
)
update members m
set coins = t.target_coins
from totals t
where m.id = t.id
  and m.coins <> t.target_coins;


-- ============================================================
-- STEP 3 — VERIFY (these 5 only)
-- ============================================================
with escrow as (
  select top_bidder as name, sum(current_bid) as escrowed
  from auctions
  where status = 'active' and top_bidder is not null
  group by top_bidder
),
logs as (
  select
    m.name, m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0) as supposed_coins
  from members m
  left join escrow esc on esc.name = m.name
  where m.name in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')
)
select name, current_coins, supposed_coins, current_coins - supposed_coins as diff
from logs;
