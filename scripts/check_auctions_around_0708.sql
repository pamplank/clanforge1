-- Looks at the actual auctions table for anything ending around 07-08,
-- especially the recurring "Match" MVP auctions, to check for a stuck or
-- misprocessed auction that might explain GinisangOtin's mismatched
-- "13:00 Match 2" / "20:00 Match 1" entries, rather than them being
-- purely fabricated log entries.

select
  id,
  name,
  status,
  to_timestamp(ends_at/1000) as ends_at_utc,
  to_timestamp(started_at/1000) as started_at_utc,
  current_bid,
  top_bidder,
  min_bid,
  jsonb_array_length(coalesce(bids, '[]'::jsonb)) as num_bids
from auctions
where name ilike '%Clan Annihilation MVP%'
   or name ilike '%MVP Clan Annihilation%'
order by ends_at;


-- ============================================================
-- Full bid history (from the auctions.bids column itself, not
-- bid_events) for each of those auctions, so we can see who the
-- auctions table itself thinks the real top bidder/winner was.
-- ============================================================
select
  a.id,
  a.name,
  a.status,
  b->>'bidder' as bidder,
  (b->>'amount')::numeric as bid_amount,
  to_timestamp(((b->>'time')::bigint)/1000) as bid_time
from auctions a
cross join lateral jsonb_array_elements(coalesce(a.bids, '[]'::jsonb)) b
where a.name ilike '%Clan Annihilation MVP%'
   or a.name ilike '%MVP Clan Annihilation%'
order by a.id, bid_time;
