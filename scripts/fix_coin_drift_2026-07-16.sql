-- Clan-wide coin-drift audit (2026-07-16, see scripts/audit_coin_drift.sql)
-- found 10 members whose live `coins` no longer matches the sum of their
-- tx_log + attend_log + decay_log. Two different fixes below, matching the
-- established convention in this file's siblings (fix_ascott_balance_
-- correction.sql, fix_active_bidder_coin_sync_gap.sql): `coins` only ever
-- changes via an atomic RPC (place_bid_atomic / adjust_member_coins_and_log
-- / increment_auction_win), so it's treated as ground truth and corrections
-- normally backfill the LOG to match it -- UNLESS there's direct proof of
-- an actual erroneous double-payment, in which case coins itself is wrong
-- and gets clawed back.
--
-- ISABELLA is the one case with that proof: her tx_log has two identical
-- "Outbid Refund" entries (+405 each, 13s apart, same auctionId
-- 1784036989356, reason "Outbid on x200k gwemix") even though that
-- auction's own `bids` array only records ONE competing bid (itsShupapi at
-- 415) -- she was paid twice for one real outbid event. Root cause not yet
-- confirmed (this happened after the same-day place_bid_atomic fix went
-- live; see chat investigation) -- tracked separately, not blocking this
-- correction. Confirmed with the clan owner: claw back the full 815
-- (405 confirmed duplicate + 410 separate unexplained gap), as two
-- distinct, individually-documented entries rather than one lump sum.
--
-- The other 8 members below have NO identified duplicate/bug evidence,
-- just an unexplained gap (same category as fix_ascott_balance_
-- correction.sql) -- coins is left untouched and the log is backfilled
-- with a single Balance Correction entry equal to the diff, so Points
-- History reconciles with the real balance without touching anyone's
-- actual coins.
--
-- IKILLYOU is deliberately EXCLUDED from this script: her tx_log shows
-- "Won auction: x1 Clan Annihilation MVP" logged FOUR times (155 each,
-- all within ~1 minute on 6/25) plus a duplicated "Clan MVP Refund"
-- (+155 twice, 8s apart) -- the same class of proven-duplicate bug as
-- Isabella's, not a plain unexplained gap. Needs the same kind of
-- real-vs-phantom investigation Isabella got before deciding what (if
-- anything) to claw back; do not backfill her with a blind Balance
-- Correction until that's done.
--
-- Already run live (via adjust_member_coins_and_log, the anon-key RPC the
-- app itself uses -- no service-role key was available this session), not
-- pasted into the SQL Editor as one block. Recorded here for history,
-- matching the pattern already used for earlier one-off audit/fix
-- scripts. The statements below are the SQL-equivalent of the RPC calls
-- actually made, safe to re-run (each is a fresh append, not idempotent
-- against re-running twice, so don't re-run against this same data).
--
-- Isabella's correction needed two passes: the first attempt clawed back
-- 405 (duplicate refund) + 410 (unexplained gap) from `coins` AND logged
-- a matching -410 entry for the second part -- but that double-counted,
-- since reducing coins by an amount that was never in the log to begin
-- with already reconciles it on its own; logging it too pushed the log
-- 410 too low. Caught immediately via re-audit and corrected with a
-- third, log-only +410 entry (delta 0) that cancels the erroneous -410
-- line. Net result across all three statements: coins -815, tx_log net
-- change -405 (just the duplicate-refund reversal, as intended).

-- ============================================================
-- ISABELLA -- confirmed duplicate refund + unexplained gap
-- ============================================================
update members
set
  coins = coins - 405,
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('date','7/16/2026','change',-405,'reason','Balance correction: reversing duplicate Outbid Refund on x200k gwemix (auctionId 1784036989356) -- paid twice, 13s apart, for a single real outbid event; the auction''s own bid history shows only one competing bid.','addedBy','System','logType','Balance Correction')
  ))::text
where name = 'Isabella';

update members
set
  coins = coins - 410,
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('date','7/16/2026','change',-410,'reason','Balance correction: -410 to reconcile actual coin total with logged history. Gap traced to an unlogged/duplicated credit that could not be further identified from the log alone.','addedBy','System','logType','Balance Correction')
  ))::text
where name = 'Isabella';

-- Correction for the double-count above: coins already reconciled once
-- the -410 was clawed back (that 410 was never in the log to begin with),
-- so the -410 log line just added was one too many. Cancel it, coins
-- untouched (delta 0).
update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',410,'reason','Correcting my own bookkeeping error in the previous entry: reducing coins by 410 for the unexplained gap already reconciles against the log on its own (that 410 was never logged in the first place), so logging an additional -410 double-counted it. This +410 entry cancels that duplicate log line; net effect on coins is zero.','addedBy','System','logType','Balance Correction')
))::text
where name = 'Isabella';

-- ============================================================
-- 8 members with an unexplained gap only -- log backfilled to match
-- existing coins, coins NOT touched
-- ============================================================
update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',-570,'reason','Balance correction: -570 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'MiaKhalifa';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',-300,'reason','Balance correction: -300 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'Aishifishy';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',275,'reason','Balance correction: +275 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'Robin';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',-210,'reason','Balance correction: -210 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'AScott';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',-206,'reason','Balance correction: -206 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'XELLIN';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',135,'reason','Balance correction: +135 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'ThomasShelby';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',-110,'reason','Balance correction: -110 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'Artemisia';

update members
set tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('date','7/16/2026','change',-110,'reason','Balance correction: -110 to reconcile logged history with actual coin total (unexplained gap, no cause identified).','addedBy','System','logType','Balance Correction')
))::text
where name = 'Blessed';

-- ============================================================
-- VERIFY -- diff should be 0 for all 9 corrected members;
-- ikillyou intentionally still shows its pre-existing diff (480)
-- ============================================================
with logs as (
  select
    m.name,
    m.coins as current_coins,
    coalesce((select sum((elem->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem), 0)
      + coalesce((select sum((elem->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) elem), 0)
      + coalesce((select sum((elem->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) elem), 0) as supposed_coins
  from members m
  where m.name in ('Isabella','MiaKhalifa','ikillyou','Aishifishy','Robin','AScott','XELLIN','ThomasShelby','Artemisia','Blessed')
)
select name, current_coins, supposed_coins, current_coins - supposed_coins as diff from logs order by name;
