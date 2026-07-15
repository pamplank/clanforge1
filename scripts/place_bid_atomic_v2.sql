-- ROOT CAUSE of "I bid but wasn't deducted coins": placing a bid claimed
-- the auction row (this function) and deducted the bidder's coins
-- (a separate adjust_member_coins_and_log call from the client) as TWO
-- independent atomic operations with a real gap between them. If the coin
-- deduction failed after the bid claim already succeeded -- a network
-- blip, a transient DB error, anything -- the bidder was recorded as the
-- new top bidder with nothing ever actually taken from their balance, and
-- the client showed a normal "Bid placed!" success toast regardless,
-- since it only checked the auction-claim step's result before proceeding
-- to the rest of the bid-success UI.
--
-- Now the auction claim, the bidder's coin deduction + Bid Placed log
-- entry, and the previous top bidder's refund + Outbid Refund log entry
-- all happen inside this ONE function, which Postgres runs as a single
-- transaction -- either everything lands, or (on any failure, including
-- insufficient funds discovered here) nothing does.
create or replace function place_bid_atomic(p_auction_id text, p_bidder text, p_amount numeric, p_min_increment numeric default 5)
returns jsonb
language plpgsql
as $$
declare
  v_status text;
  v_current_bid numeric;
  v_top_bidder text;
  v_auction_name text;
  v_bidder_coins numeric;
  v_new_bidder_coins numeric;
  v_new_prev_bidder_coins numeric;
  v_ts bigint := (extract(epoch from now()) * 1000)::bigint;
  v_date text := to_char(now(), 'MM/DD/YYYY');
  v_bid_entry jsonb;
  v_refund_entry jsonb;
begin
  select status, current_bid, top_bidder, name
    into v_status, v_current_bid, v_top_bidder, v_auction_name
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

  -- Lock and re-verify the bidder's balance server-side -- the client's
  -- own check is only a courtesy against its possibly-stale local cache.
  select coins into v_bidder_coins from members where name = p_bidder for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'bidder_not_found');
  end if;
  if v_bidder_coins < p_amount then
    return jsonb_build_object('success', false, 'reason', 'insufficient_funds', 'coins', v_bidder_coins);
  end if;

  update auctions
    set current_bid = p_amount,
        top_bidder = p_bidder,
        bids = coalesce(bids, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object('bidder', p_bidder, 'amount', p_amount, 'time', v_ts)
        )
    where id = p_auction_id;

  v_bid_entry := jsonb_build_object('change', -p_amount, 'reason', 'Bid on ' || coalesce(v_auction_name, ''), 'date', v_date, 'ts', v_ts, 'logType', 'Bid Placed', 'addedBy', 'System', 'auctionId', p_auction_id);
  update members
    set coins = coins - p_amount,
        tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(v_bid_entry))::text
    where name = p_bidder
    returning coins into v_new_bidder_coins;

  if v_top_bidder is not null and coalesce(v_current_bid, 0) > 0 then
    v_refund_entry := jsonb_build_object('change', v_current_bid, 'reason', 'Outbid on ' || coalesce(v_auction_name, ''), 'date', v_date, 'ts', v_ts, 'logType', 'Outbid Refund', 'addedBy', 'System', 'auctionId', p_auction_id);
    update members
      set coins = coins + v_current_bid,
          tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(v_refund_entry))::text
      where name = v_top_bidder
      returning coins into v_new_prev_bidder_coins;
  end if;

  return jsonb_build_object(
    'success', true,
    'current_bid', p_amount,
    'prev_bidder', v_top_bidder,
    'prev_amount', v_current_bid,
    'new_bidder_coins', v_new_bidder_coins,
    'new_prev_bidder_coins', v_new_prev_bidder_coins,
    'bid_ts', v_ts
  );
end;
$$;
