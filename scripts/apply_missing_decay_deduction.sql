-- Applies the missing weekly decay deduction to members' real `coins` for
-- the 2026-07-06 scheduled run (and any later-but-untimestamped decay_log
-- entry alongside it) that was logged but never actually subtracted from
-- their balance.
--
-- SELF-VERIFYING: only touches a member if excluding their "recent" decay
-- (ts >= the 07-06 run, or missing ts) makes current_coins match their
-- full logged history almost exactly (within 5 coins, for rounding).
-- Members whose gap is NOT cleanly explained this way (e.g. GinisangOtin,
-- ChiefRGB, AScott — contaminated by the separate auction-backfill
-- misattribution issue) are left untouched here on purpose. Fix that
-- issue first, then re-run this — or handle them by hand afterward.
--
-- Run each step in order in the Supabase SQL Editor.


-- ============================================================
-- STEP 1 — PREVIEW: shows every member with a nonzero "recent" decay,
-- whether excluding it cleanly explains their diff (would_fix = true),
-- and exactly how many coins would be deducted if applied.
-- ============================================================
with cutoff as (
  select (extract(epoch from '2026-07-06 22:59:00+00'::timestamptz) * 1000)::bigint as cutoff_ts
),
totals as (
  select
    m.id, m.name, m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0) as tx_total,
    coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0) as attend_total,
    coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0) as decay_total,
    coalesce((
      select sum((e->>'amount')::numeric)
      from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e, cutoff c
      where (e->>'ts') is null or (e->>'ts')::bigint >= c.cutoff_ts
    ), 0) as recent_decay_total
  from members m
)
select
  name,
  current_coins,
  (tx_total + attend_total + decay_total) as supposed_full,
  current_coins - (tx_total + attend_total + decay_total) as diff_full,
  -recent_decay_total as missing_decay_amount,
  current_coins - (tx_total + attend_total + decay_total - recent_decay_total) as diff_after_fix,
  (abs(current_coins - (tx_total + attend_total + decay_total - recent_decay_total)) <= 5) as would_fix_cleanly
from totals
where recent_decay_total <> 0
order by would_fix_cleanly desc, abs(current_coins - (tx_total + attend_total + decay_total - recent_decay_total)) asc;


-- ============================================================
-- STEP 2 — APPLY: deducts the missing decay only for members where
-- would_fix_cleanly is true (diff_after_fix within 5 coins of zero).
-- ============================================================
with cutoff as (
  select (extract(epoch from '2026-07-06 22:59:00+00'::timestamptz) * 1000)::bigint as cutoff_ts
),
totals as (
  select
    m.id, m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0) as tx_total,
    coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0) as attend_total,
    coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0) as decay_total,
    coalesce((
      select sum((e->>'amount')::numeric)
      from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e, cutoff c
      where (e->>'ts') is null or (e->>'ts')::bigint >= c.cutoff_ts
    ), 0) as recent_decay_total
  from members m
)
update members m
set coins = m.coins + t.recent_decay_total
from totals t
where m.id = t.id
  and t.recent_decay_total <> 0
  and abs(t.current_coins - (t.tx_total + t.attend_total + t.decay_total - t.recent_decay_total)) <= 5;


-- ============================================================
-- STEP 3 — VERIFY: re-run the clean drift check from before. Members
-- that were fixed should now show diff = 0 (or very close). Members
-- skipped for being contaminated by the auction-misattribution issue
-- will still show a diff — expected, handle those separately.
-- ============================================================
with logs as (
  select
    m.name,
    m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0) as supposed_coins
  from members m
)
select name, current_coins, supposed_coins, current_coins - supposed_coins as diff
from logs
order by abs(current_coins - supposed_coins) desc;
