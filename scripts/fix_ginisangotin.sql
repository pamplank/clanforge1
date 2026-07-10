-- Corrected plan for GinisangOtin. Originally thought 2 of her 4
-- backfilled "Auction Win" entries were fabricated (no matching bid in
-- bid_events), but checking the authoritative source instead
-- (auctions.bids, not bid_events - see backfill_missing_bid_events.sql)
-- showed bid_events itself had gaps: both "13:00 Match 2" (-250) and
-- "20:00 Match 1" (-250) were her real, final, winning bids. All 4 of
-- her entries are legitimate.
--
-- So her case is identical to the other 4 verified members: real,
-- validated spending, with the whole remaining gap confirmed as leak
-- surplus. Just reset, net of active-bid escrow - no log correction
-- needed.
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
)
select
  m.name,
  m.coins as current_coins,
  greatest(
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    - coalesce(esc.escrowed, 0),
    0
  ) as target_coins
from members m
left join escrow esc on esc.name = m.name
where m.name = 'GinisangOtin';


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
  where m.name = 'GinisangOtin'
)
update members m
set coins = t.target_coins
from totals t
where m.id = t.id;


-- ============================================================
-- STEP 3 — VERIFY
-- ============================================================
select id, name, coins from members where name = 'GinisangOtin';
