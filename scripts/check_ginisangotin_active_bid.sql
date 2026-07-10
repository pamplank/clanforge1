-- Checks GinisangOtin's currently active auction(s) - is this a real,
-- normally-progressing auction, or a stuck one that never closed when
-- it should have?

select
  id,
  name,
  status,
  to_timestamp(ends_at/1000) as ends_at_utc,
  to_timestamp(started_at/1000) as started_at_utc,
  current_bid,
  top_bidder,
  now() as current_time_check
from auctions
where status = 'active' and top_bidder = 'GinisangOtin';
