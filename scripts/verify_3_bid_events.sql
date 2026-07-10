-- Raw bid_events for AScott, Netanyahu, Ezel, to cross-check against
-- their tx_log "Auction Win" entries (already pulled) and confirm
-- whether each win is real (matches their own final bid) or fabricated.

select
  bidder as name,
  to_timestamp(ts/1000) as when_utc,
  amount as bid_amount,
  auction_name
from bid_events
where bidder in ('AScott','Netanyahu','Ezel')
order by bidder, ts;
