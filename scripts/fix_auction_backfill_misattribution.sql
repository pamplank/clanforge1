-- Final cleanup pass: corrects the remaining members whose balance still
-- doesn't match their My Points History after migrate_misattributed_decay_
-- entries.sql and apply_missing_decay_deduction.sql have been run.
--
-- These are the auction-backfill misattribution cases (e.g. GinisangOtin,
-- ChiefRGB, AScott) — some "(backfilled ...)" Auction Win tx_log entries
-- don't match anything in that member's own bid_events history, meaning
-- the backfill script (which matched recurring-named auctions like
-- "13:00 Match 2 Clan Annihilation MVP" by name across different weeks)
-- likely attributed the wrong week's charge to them.
--
-- SELF-VERIFYING, LOG-ONLY, NEVER TOUCHES COINS: increment_auction_win
-- only ever writes tx_log, never coins (see scripts/increment_auction_win.sql)
-- — so a misattributed entry never cost real coins, it only overstates
-- what the log claims was paid. This only removes a suspicious entry if
-- doing so brings that member's current_coins to within 5 coins of their
-- logged history — i.e. it PROVES the entry was the cause of their drift
-- before touching anything. A member like ikillyou, whose repeated wins
-- are real (confirmed by the clan) but happen to predate bid_events
-- tracking, will NOT match this test and is left untouched, because
-- removing their entries would NOT cleanly resolve their diff.
--
-- Run each step in order in the Supabase SQL Editor.


-- ============================================================
-- STEP 1 — PREVIEW: for every member with a nonzero diff, shows which
-- of their "(backfilled ...)" Auction Win entries have no matching
-- bid_events row, and whether removing exactly those entries would
-- cleanly resolve their diff (would_fix_cleanly = true).
-- ============================================================
with logs as (
  select
    m.id, m.name, m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0) as supposed_coins
  from members m
),
suspects as (
  select
    l.id, l.name, l.current_coins, l.supposed_coins,
    l.current_coins - l.supposed_coins as diff,
    elem as entry,
    (elem->>'change')::numeric as amount,
    elem->>'reason' as reason
  from logs l
  join members m on m.id = l.id,
       jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem
  where l.current_coins - l.supposed_coins <> 0
    and elem->>'logType' = 'Auction Win'
    and elem->>'reason' ilike '%backfilled%'
    and not exists (
      select 1 from bid_events be
      where be.bidder = l.name
        and elem->>'reason' ilike '%' || be.auction_name || '%'
        and be.amount = -(elem->>'change')::numeric
    )
),
per_member as (
  select
    id, name, current_coins, supposed_coins, diff,
    sum(amount) as unmatched_total,
    jsonb_agg(jsonb_build_object('reason', reason, 'amount', amount)) as unmatched_entries
  from suspects
  group by id, name, current_coins, supposed_coins, diff
)
select
  name, current_coins, supposed_coins, diff,
  unmatched_total,
  diff + unmatched_total as diff_after_fix,
  (abs(diff + unmatched_total) <= 5) as would_fix_cleanly,
  unmatched_entries
from per_member
order by would_fix_cleanly desc, abs(diff + unmatched_total) asc;


-- ============================================================
-- STEP 2 — APPLY: removes only the unmatched backfilled entries for
-- members where doing so would cleanly resolve their diff. Never
-- modifies `coins`.
-- ============================================================
with logs as (
  select
    m.id, m.name, m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0) as supposed_coins
  from members m
),
suspects as (
  select
    l.id, l.name, l.current_coins - l.supposed_coins as diff,
    elem
  from logs l
  join members m on m.id = l.id,
       jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem
  where l.current_coins - l.supposed_coins <> 0
    and elem->>'logType' = 'Auction Win'
    and elem->>'reason' ilike '%backfilled%'
    and not exists (
      select 1 from bid_events be
      where be.bidder = l.name
        and elem->>'reason' ilike '%' || be.auction_name || '%'
        and be.amount = -(elem->>'change')::numeric
    )
),
per_member as (
  select id, diff, sum((elem->>'change')::numeric) as unmatched_total, jsonb_agg(elem) as unmatched_entries
  from suspects
  group by id, diff
  having abs(diff + sum((elem->>'change')::numeric)) <= 5
)
update members m
set tx_log = (
  select coalesce(jsonb_agg(e), '[]'::jsonb)::text
  from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e
  where not (pm.unmatched_entries @> jsonb_build_array(e))
)
from per_member pm
where m.id = pm.id;


-- ============================================================
-- STEP 3 — FINAL VERIFY: everyone's diff after all three cleanup
-- scripts. Anything still nonzero here needs manual review — it wasn't
-- safe to auto-correct (e.g. a genuinely unresolved discrepancy, or a
-- member with an actively open auction bid in escrow).
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
where current_coins - supposed_coins <> 0
order by abs(current_coins - supposed_coins) desc;
