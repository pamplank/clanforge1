-- Reconciles Points History for the members currently caught by the
-- coin-sync race just fixed in placeBid() (src/App.jsx): adjustMemberCoinsAtomic
-- was being called without await/retry/success-checking, so a transient
-- RPC failure could leave a "Bid Placed" or "Outbid Refund" entry in
-- tx_log claiming a coin change that never actually landed in `coins` --
-- in either direction, since the same call handles both the bidder's
-- deduction and the outbid party's refund.
--
-- `coins` itself was never at risk -- it only ever changes via the atomic
-- adjust_member_coins RPC (or place_bid_atomic / increment_auction_win),
-- all single indivisible Postgres UPDATEs. It's tx_log that silently
-- under- or over-counted. So unlike scripts/fix_ascott_balance_correction.sql
-- (an unexplained credit with no identified cause), this is a known,
-- code-confirmed bug and `coins` is treated as ground truth here.
--
-- Investigated 2026-07-13: 11 of the 12 members with a bid currently
-- sitting in an active auction showed a coins-vs-history gap, vs only 5 of
-- the other 38 members (whose gaps have separate, already-handled causes --
-- see fix_ginisangotin_duplicate_admin_add.sql, fix_missing_auction_win_entries.sql,
-- fix_ascott_balance_correction.sql). Deliberately scoped to just this
-- confirmed-affected cohort rather than every member with any drift.
--
-- Computes each member's gap LIVE at run time (coins - (tx_log + attend_log
-- + decay_log) sums), rather than hardcoding the amounts found during
-- investigation, since bidding is live and balances keep moving. Adds one
-- "Balance Correction" tx_log entry per affected member for the exact gap
-- found at run time, WITHOUT touching `coins` itself. Idempotent: if a
-- member's gap is already 0 by the time this runs (e.g. already reconciled,
-- or the underlying bid finished normally), it's skipped.
--
-- Run this as ONE statement (the whole DO block) in the Supabase SQL Editor.

do $$
declare
  target record;
  v_coins numeric;
  tx_sum numeric;
  attend_sum numeric;
  decay_sum numeric;
  gap numeric;
  v_date text;
  v_ts bigint;
begin
  v_date := to_char(now(), 'FMMM/FMDD/YYYY');
  v_ts := (extract(epoch from now()) * 1000)::bigint;

  for target in
    select unnest(array[
      'Caliana','SCARLETT01','不要碧莲','Aishifishy','Aucifer',
      'ARIRANG','Dexxu','EKUPMANN','itsShupapi','XELLIN','Winø'
    ]) as name
  loop
    select
      m.coins,
      coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0),
      coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0),
      coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
    into v_coins, tx_sum, attend_sum, decay_sum
    from members m
    where m.name = target.name;

    if not found then
      raise notice 'skipping %: no matching member row', target.name;
      continue;
    end if;

    gap := v_coins - (tx_sum + attend_sum + decay_sum);

    if gap <> 0 then
      update members
      set tx_log = (
        coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'ts', v_ts,
            'date', v_date,
            'change', gap,
            'reason', 'Balance correction: reconciles Points History with your real coin balance after fixing a coin-sync bug in bid placement (a bid deduction or outbid refund could silently be missing from your history without ever affecting your actual coins).',
            'addedBy', 'System',
            'logType', 'Balance Correction'
          )
        )
      )::text
      where name = target.name;
    end if;
  end loop;
end $$;

-- ============================================================
-- VERIFY: every listed member's coins should now equal
-- (tx_log + attend_log + decay_log) sums, i.e. diff = 0.
-- ============================================================
with logs as (
  select
    m.name,
    m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
      + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0)
      as supposed_coins
  from members m
  where m.name in (
    'Caliana','SCARLETT01','不要碧莲','Aishifishy','Aucifer',
    'ARIRANG','Dexxu','EKUPMANN','itsShupapi','XELLIN','Winø'
  )
)
select name, current_coins, supposed_coins, current_coins - supposed_coins as diff
from logs
order by name;
