-- Backfills missing "Auction Win" tx_log entries for 4 members whose real
-- coin balance no longer matched their logged Points History (found via a
-- clan-wide audit comparing each member's current coins against the sum of
-- their tx_log + attend_log + decay_log). In every one of these cases the
-- gap was traced to specific auctions where this member was confirmed the
-- final top_bidder (status='ended' in the auctions table, the authoritative
-- record of what really happened) but no matching "Auction Win" entry ever
-- made it into their tx_log -- same root cause as the OTHER already-
-- backfilled entries already visible in these same members' history
-- ("claim silently failed at the time"), just a few auctions that the
-- original backfill pass missed.
--
-- IMPORTANT: this does NOT touch `coins` for any of these 4 members. Their
-- real coin balance has been correct all along -- the deduction happens at
-- bid time (a separate, unaffected code path), independent of whether the
-- win got logged afterward. This only restores the missing history entries
-- and corrects `auction_wins` to the true count of their real wins (the
-- auctions table), so both the log and the win counter finally match
-- reality.
--
-- Verified per member (missing amount sums to exactly the member's
-- unexplained coin gap from the audit):
--   GinisangOtin: 256+235+165+130 = 786
--   Robin:        55+115           = 170
--   RFAcachi:     255+255          = 510
--   Karding:      165              = 165
--
-- Run this once in the Supabase SQL Editor for this project.

-- GinisangOtin: current auction_wins=1, true total=9
update members
set
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-256,'reason','Won auction: x60 Lucky Totem (tradable) (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783597760629'),
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-235,'reason','Won auction: x5 Vargreif Sovereign Norn''s Treasure (bound) (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783597401301'),
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-165,'reason','Won auction: x20 R Treasure island Norn''s Treasure (bound) (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783598097646'),
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-130,'reason','Won auction: x9 seal of victory (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783610203489')
  ))::text,
  auction_wins = 9
where name = 'GinisangOtin';

-- Robin: current auction_wins=0, true total=2
update members
set
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-55,'reason','Won auction: swamp trap common (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783631740854'),
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-115,'reason','Won auction: Swamp Trap (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783632072547')
  ))::text,
  auction_wins = 2
where name = 'Robin';

-- RFAcachi: current auction_wins=3, true total=7
update members
set
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-255,'reason','Won auction: x5 R promotion stone selection chest (bound) (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783597882324'),
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-255,'reason','Won auction: x5 R promotion stone selection chest (bound) (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783597946375')
  ))::text,
  auction_wins = 7
where name = 'RFAcachi';

-- Karding: current auction_wins=5, true total=7
update members
set
  tx_log = (coalesce(tx_log::jsonb,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('ts',1783895861559,'date','7/13/2026','change',-165,'reason','Won auction: x20 R Treasure island Norn''s Treasure (bound) (backfilled - claim silently failed at the time, coins were already correctly deducted at bid time; this only restores the missing history entry and win counter)','addedBy','System','logType','Auction Win','auctionId','1783598060210')
  ))::text,
  auction_wins = 7
where name = 'Karding';

-- ============================================================
-- VERIFY
-- ============================================================
select name, coins, auction_wins from members
where name in ('GinisangOtin','Robin','RFAcachi','Karding');
