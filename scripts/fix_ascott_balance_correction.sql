-- Backfills AScott's unexplained +315 coin gap found during the clan-wide
-- Points History audit. Unlike GinisangOtin/Robin/RFAcachi/Karding (missing
-- Auction Win entries for real, verified wins), AScott's case is different:
-- all 12 of her real auction wins are already correctly logged, and her two
-- manual "Admin Manual Add" deductions (-155 "Kari Bottom - Auction", -190
-- "Clan Annihilation MVP Bid - 20:00 SERVER TIME 3rd Round") were confirmed
-- legitimate, not mistakes. That means her real coin balance (42) being
-- +315 higher than her complete logged history (-273) implies a credit
-- that happened at some point but was never logged anywhere -- untraceable
-- from the log alone, so this is recorded honestly as an unexplained
-- correction rather than invented as a specific fake event. Amount and
-- wording confirmed with the clan owner before running.
--
-- Also corrects her auction_wins counter (10 -> 12) to match her true
-- number of real wins in the auctions table -- same kind of counter drift
-- as the other 4 members, independent of this coin gap (all her wins were
-- already logged, just the counter itself had fallen behind).
--
-- Run this once in the Supabase SQL Editor for this project.

update members
set
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('ts',1783896371157,'date','7/13/2026','change',315,'reason','Balance correction: +315 to reconcile actual coin total with logged history. Both of this member''s manual deductions (Kari Bottom - Auction; Clan Annihilation MVP Bid 20:00 3rd Round) were confirmed legitimate, so the gap traces to an unlogged credit somewhere that could not be identified from the log alone.','addedBy','System','logType','Balance Correction')
  ))::text,
  auction_wins = 12
where name = 'AScott';

-- ============================================================
-- VERIFY
-- ============================================================
select name, coins, auction_wins from members where name = 'AScott';
