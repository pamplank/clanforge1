-- Backfills the real coin deductions/refunds that never landed while
-- rnvcvrbfcmddpdvdxhgt (the actual production project -- see
-- fix_place_bid_atomic_production_2026-07-18.sql) was running a
-- place_bid_atomic that claimed the auction row but never touched
-- members.coins/tx_log. Unlike every earlier backfill script in this
-- folder (fix_active_bidder_coin_sync_gap.sql, backfill_missing_bid_
-- history_active.sql), this one genuinely needs to move `coins` itself --
-- those earlier incidents left `coins` correct and only the log entry
-- missing; this one left the bid/refund never applied to either.
--
-- HOW THIS LIST WAS BUILT: every active/ended auction's `bids` array
-- (bidder/amount/time, written server-side by place_bid_atomic itself --
-- the authoritative record of what actually happened) was replayed in
-- chronological order against each bidder's real tx_log, for every bid
-- from 2026-07-16T21:00:00Z onward (the point recent history stops being
-- reliably logged -- see the investigation notes in
-- fix_place_bid_atomic_production_2026-07-18.sql). For every bid step
-- missing its "Bid Placed" entry, and every step where the person just
-- outbid is missing their matching "Outbid Refund" entry, one correction
-- row was generated below. Every ended auction's replayed chain was
-- verified to net out exactly to that auction's real final
-- top_bidder/current_bid, with every intermediate outbid party fully
-- refunded along the way -- see the chat transcript for the full
-- per-auction replay if you want to re-derive/audit this by hand.
--
-- Test/dev auctions (ZZ_* prefixed) are deliberately excluded. Bids
-- before the 2026-07-16T21:00 cutoff are deliberately NOT touched here --
-- some earlier isolated gaps exist (Artemisia, early Isabella/Aishifishy/
-- Karding/Valk0Freya/itsShupapi/AScott entries from 7/14-7/15) but predate
-- the production-project mixup this backfill targets and may already be
-- covered by earlier reconciliation; they need separate manual review,
-- not a guess bundled in here.
--
-- Two rows this replay would otherwise generate are DELIBERATELY OMITTED
-- below (see inline comments at each): itsShupapi's ~210 refund and
-- Isabella's ~405 refund each match, within rounding, a manual
-- "Admin Manual Add" credit ThomasShelby already applied by hand on 7/17
-- for the same auction. Including them here would double-pay both
-- members. Every other manually-patched member (Robin, Winø,
-- Valk0Freya, SCARLETT01) was cross-checked against this list and their
-- admin credits are for different auctions than anything below, so no
-- other overlap exists.
--
-- Idempotent: each row is only applied if a matching tx_log entry
-- (member + auctionId + change + logType) doesn't already exist, so it's
-- safe to re-run this if some rows apply and others don't the first time
-- (e.g. a member name typo, a concurrent live bid mid-run).
--
-- Run this as ONE statement (the whole DO block) in the Supabase SQL
-- Editor for rnvcvrbfcmddpdvdxhgt -- AFTER running
-- fix_place_bid_atomic_production_2026-07-18.sql, so new bids stop
-- adding to this gap while you're fixing the old ones.

 

-- ============================================================
-- VERIFY: sums only the exact 74 entries this script just wrote
-- (matched by their exact `ts`, which is unique per correction row
-- above -- the list below still contains each ts's original duplicate
-- count from the full 76-row replay, which is harmless for an IN-list
-- membership check), so this can't be thrown off by a member's other
-- unrelated history. Should show a net-per-member total matching:
-- Aucifer -2100, Vanessa -805, Robin -460, ARIRANG -455, Karding -325,
-- Valk0Freya -250, RFAcachi -230, Winø -105, Blessed -80, EKUPMANN -10,
-- SCARLETT01 +60, GinisangOtin +85, Aishifishy +195, enilekam +405,
-- Caliana/Biogesic net 0. itsShupapi and Isabella should show NO rows
-- here at all (their would-be entries were deliberately omitted above).
-- ============================================================
with expected_ts as (
  select unnest(array[
    1784305444834,1784303754523,1784343564320,1784343564320,1784304761059,1784332709548,
    1784305460966,1784367023227,1784367023227,1784304185039,1784304141746,1784303771429,
    1784305500609,1784305493225,1784303438341,1784305529494,1784303741734,1784367032054,
    1784367032054,1784305491144,1784289748732,1784289748732,1784292887797,1784292887797,
    1784294673507,1784294673507,1784294792970,1784294792970,1784294897441,1784294897441,
    1784297714004,1784297714004,1784293646733,1784293646733,1784293773402,1784293773402,
    1784289204221,1784289204221,1784289220291,1784289220291,1784289234924,1784289234924,
    1784289244987,1784289244987,1784289256476,1784289256476,1784289273498,1784289273498,
    1784289303204,1784289303204,1784289314577,1784289314577,1784289337818,1784289337818,
    1784289399758,1784289399758,1784289410176,1784289410176,1784288901654,1784288901654,
    1784288995155,1784288995155,1784289001220,1784289001220,1784289022806,1784289022806,
    1784239798579,1784239798579,1784278289584,1784278289584,1784285367046,1784285367046,
    1784239849698,1784239849698,1784281011398,1784281011398
  ]::bigint[]) as ts
)
select m.name, sum((e->>'change')::numeric) as backfill_net, count(*) as entries_found
from members m, jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e
where (e->>'ts')::bigint in (select ts from expected_ts)
  and e->>'addedBy' = 'System'
group by m.name
order by m.name;
