-- ROOT CAUSE of members' coins increasing "for no reason" around bidding
-- activity: place_bid_atomic's response never told the client who the
-- real previous bidder was, so the client (src/App.jsx placeBid) fell
-- back to refunding whoever ITS OWN locally cached auction state still
-- thought was winning — a snapshot up to 3s stale (the poll interval).
--
-- Failure sequence:
--   1. Player A is the top bidder on an auction at 100 coins.
--   2. Player B bids 150 and genuinely wins the row (place_bid_atomic
--      validates and writes this correctly — no bug here).
--   3. Player C's browser hasn't polled yet and still shows Player A as
--      top bidder at 100. Player C bids 200, which legitimately beats
--      the REAL current bid of 150.
--   4. Player C's browser refunds "Player A" 100 coins (from its stale
--      cache) instead of the real previous bidder, Player B, who paid
--      150 and never gets refunded. Player A gets coins credited they
--      were never entitled to, with no log trail — looks exactly like
--      "coins increasing for no reason" tied to bidding activity.
--
-- FIX: this function now captures top_bidder/current_bid from the row
-- BEFORE overwriting them, inside the same `for update`-locked
-- transaction, and returns them as prev_bidder/prev_amount. The client
-- fix (already applied in src/App.jsx placeBid) uses these authoritative
-- values instead of its local cache, so the refund always targets
-- whoever the database says was really outbid, regardless of how stale
-- this browser's last poll was.
--
-- Run this once in the Supabase SQL Editor for this project.

create or replace function place_bid_atomic(
  p_auction_id text,
  p_bidder text,
  p_amount numeric,
  p_min_increment numeric default 5
)
returns jsonb
language plpgsql
as $$
declare
  v_status text;
  v_current_bid numeric;
  v_top_bidder text;
begin
  select status, current_bid, top_bidder
    into v_status, v_current_bid, v_top_bidder
    from auctions
    where id = p_auction_id
    for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if v_status <> 'active' then
    return jsonb_build_object('success', false, 'reason', 'ended');
  end if;

  if p_amount < coalesce(v_current_bid, 0) + p_min_increment then
    return jsonb_build_object('success', false, 'reason', 'outbid', 'current_bid', v_current_bid);
  end if;

  update auctions
    set current_bid = p_amount,
        top_bidder = p_bidder,
        bids = coalesce(bids, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('bidder', p_bidder, 'amount', p_amount, 'time', (extract(epoch from now()) * 1000)::bigint)
        )
    where id = p_auction_id;

  return jsonb_build_object(
    'success', true,
    'current_bid', p_amount,
    'prev_bidder', v_top_bidder,
    'prev_amount', v_current_bid
  );
end;
$$;
