-- Item Buyout: lets a buyer pay auctions.buyout_price to win a listing
-- instantly, skipping bidding. Same atomicity pattern as place_bid_atomic
-- (see scripts/place_bid_atomic_v2.sql) and the same reason it's needed:
-- "first valid buyout request wins" has to be enforced by ONE locked
-- database transaction, not by a check-then-write across two separate
-- client round trips, or two buyers racing the same instant could both
-- read the auction as still active and both believe they'd won it.
--
-- `select ... for update` locks the auctions row for the rest of this
-- transaction -- a second concurrent call for the same auction_id blocks
-- until this one commits (status already flipped to 'ended' by then) or
-- rolls back, so it can never also pass the status/window checks below.
-- Whichever call actually gets the lock first wins; every later caller sees
-- status <> 'active' and is rejected, no matter how close together the
-- requests were.
--
-- SECURITY DEFINER (like place_bid_atomic/increment_auction_win/
-- set_member_password/apply_member_decay_atomic) -- required because this
-- writes members.coins/tx_log directly, and anon/authenticated have had
-- table-level UPDATE on those columns revoked (see
-- lock_down_coins_columns_v2.sql); only a small set of trusted RPCs may
-- touch them at all.
--
-- The buyout window itself is enforced HERE, not just client-side: even if
-- a stale client UI still shows a "Buy Now" button past its window (e.g. a
-- tab that's been open and hasn't re-rendered), the write is rejected
-- server-side with 'window_closed'. Per spec, buyout is unavailable once
-- the window has closed even with zero bids placed -- there is deliberately
-- no separate "no bids yet" exception here.
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor, AFTER
-- scripts/add_auction_buyout_columns.sql.
create or replace function buyout_auction_atomic(p_auction_id text, p_buyer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_current_bid numeric;
  v_top_bidder text;
  v_auction_name text;
  v_buyout_price numeric;
  v_buyout_expires_at bigint;
  v_buyer_coins numeric;
  v_new_buyer_coins numeric;
  v_new_prev_bidder_coins numeric;
  v_ts bigint := (extract(epoch from now()) * 1000)::bigint;
  v_date text := to_char(now(), 'MM/DD/YYYY');
  v_buyout_entry jsonb;
  v_refund_entry jsonb;
begin
  select status, current_bid, top_bidder, name, buyout_price, buyout_expires_at
    into v_status, v_current_bid, v_top_bidder, v_auction_name, v_buyout_price, v_buyout_expires_at
    from auctions
    where id = p_auction_id
    for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if v_status <> 'active' then
    return jsonb_build_object('success', false, 'reason', 'ended');
  end if;

  -- Ineligible rarity (e.g. Legendary) never had buyout_price set at all.
  if v_buyout_price is null then
    return jsonb_build_object('success', false, 'reason', 'not_buyout_eligible');
  end if;

  if v_buyout_expires_at is null or v_ts >= v_buyout_expires_at then
    return jsonb_build_object('success', false, 'reason', 'window_closed');
  end if;

  -- Lock and re-verify the buyer's balance server-side, exactly like
  -- place_bid_atomic -- the client's own check is only a courtesy against
  -- its possibly-stale local cache.
  select coins into v_buyer_coins from members where name = p_buyer for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'buyer_not_found');
  end if;
  if v_buyer_coins < v_buyout_price then
    return jsonb_build_object('success', false, 'reason', 'insufficient_funds', 'coins', v_buyer_coins);
  end if;

  update auctions
    set status = 'ended',
        current_bid = v_buyout_price,
        top_bidder = p_buyer,
        closed_reason = 'buyout',
        bids = coalesce(bids, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('bidder', p_buyer, 'amount', v_buyout_price, 'time', v_ts, 'type', 'buyout')
        )
    where id = p_auction_id;

  v_buyout_entry := jsonb_build_object('change', -v_buyout_price, 'reason', 'Bought out ' || coalesce(v_auction_name, ''), 'date', v_date, 'ts', v_ts, 'logType', 'Buyout', 'addedBy', 'System', 'auctionId', p_auction_id);
  update members
    set coins = coins - v_buyout_price,
        tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(v_buyout_entry))::text
    where name = p_buyer
    returning coins into v_new_buyer_coins;

  -- Buyout supersedes any existing bid -- whoever was previously winning
  -- gets refunded exactly like a normal outbid, since the item was sold out
  -- from under them rather than them losing to a higher bid.
  if v_top_bidder is not null and coalesce(v_current_bid, 0) > 0 then
    v_refund_entry := jsonb_build_object('change', v_current_bid, 'reason', 'Outbid (item bought out) on ' || coalesce(v_auction_name, ''), 'date', v_date, 'ts', v_ts, 'logType', 'Outbid Refund', 'addedBy', 'System', 'auctionId', p_auction_id);
    update members
      set coins = coins + v_current_bid,
          tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(v_refund_entry))::text
      where name = v_top_bidder
      returning coins into v_new_prev_bidder_coins;
  end if;

  return jsonb_build_object(
    'success', true,
    'buyout_price', v_buyout_price,
    'prev_bidder', v_top_bidder,
    'prev_amount', v_current_bid,
    'new_buyer_coins', v_new_buyer_coins,
    'new_prev_bidder_coins', v_new_prev_bidder_coins,
    'ts', v_ts
  );
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFY: run individually after the block above, with real IDs/names.
-- ============================================================

-- 1. Should succeed once (returns success:true) for an active, in-window,
--    buyout-eligible auction and a buyer with enough coins.
-- select buyout_auction_atomic('put a real active auction id here', 'put a real member name here');

-- 2. Immediately calling it again for the SAME auction id should now return
--    {"success": false, "reason": "ended"} -- the row is already closed.
-- select buyout_auction_atomic('the same auction id', 'a different member name');
