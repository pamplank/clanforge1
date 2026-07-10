-- Backfills bid_events from the authoritative source: auctions.bids.
-- We discovered bid_events has gaps - real bids that landed correctly
-- on the auction (and were used to determine the real winner) never
-- got written to bid_events, which made earlier "does this Auction Win
-- entry match a real bid?" checks against bid_events unreliable (see
-- GinisangOtin's two wins that were wrongly flagged as fabricated).
--
-- This inserts any bid present in auctions.bids that has no matching
-- row in bid_events (matched on bidder + auction_name + amount, since
-- that combination is effectively unique per bid in practice). Uses the
-- same id format the app itself uses (`${auctionId}_${time}`) for
-- consistency with dbUpsert's own bid_events writes.
--
-- Guards against malformed bid entries (some auctions.bids elements are
-- missing bidder/amount/time entirely - stray/corrupt data) by requiring
-- all three fields to actually be present before considering a bid.

-- ============================================================
-- STEP 1 — PREVIEW: how many bids are actually missing
-- ============================================================
select count(*) as missing_count
from auctions a
cross join lateral jsonb_array_elements(coalesce(a.bids, '[]'::jsonb)) b
where b->>'bidder' is not null
  and b->>'amount' is not null
  and b->>'time' is not null
  and not exists (
    select 1 from bid_events be
    where be.bidder = b->>'bidder'
      and be.auction_name = a.name
      and be.amount = (b->>'amount')::numeric
  );


-- ============================================================
-- STEP 2 — APPLY: insert the missing bids
-- ============================================================
insert into bid_events (id, bidder, auction_name, amount, ts)
select
  a.id || '_' || (b->>'time'),
  b->>'bidder',
  a.name,
  (b->>'amount')::numeric,
  (b->>'time')::bigint
from auctions a
cross join lateral jsonb_array_elements(coalesce(a.bids, '[]'::jsonb)) b
where b->>'bidder' is not null
  and b->>'amount' is not null
  and b->>'time' is not null
  and not exists (
    select 1 from bid_events be
    where be.bidder = b->>'bidder'
      and be.auction_name = a.name
      and be.amount = (b->>'amount')::numeric
  )
on conflict (id) do nothing;


-- ============================================================
-- STEP 3 — VERIFY: should return 0 now (ignoring malformed entries,
-- which can never be backfilled since they're missing data entirely)
-- ============================================================
select count(*) as still_missing
from auctions a
cross join lateral jsonb_array_elements(coalesce(a.bids, '[]'::jsonb)) b
where b->>'bidder' is not null
  and b->>'amount' is not null
  and b->>'time' is not null
  and not exists (
    select 1 from bid_events be
    where be.bidder = b->>'bidder'
      and be.auction_name = a.name
      and be.amount = (b->>'amount')::numeric
  );
