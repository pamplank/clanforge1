-- Backfills "Bid Placed" / "Outbid Refund" points-history entries for every
-- CURRENTLY ACTIVE auction's existing bids array.
--
-- Why this is needed: the Bid Placed / Outbid Refund logging only exists in
-- the code as of this deploy. Every bid already sitting in an active
-- auction's `bids` array (jsonb, schema {bidder, amount, time} written by
-- place_bid_atomic) was placed under the OLD code and never got a matching
-- tx_log entry. auctions.bids is the authoritative record of what actually
-- happened, same as the earlier backfill_missing_bid_events.sql episode
-- used it to reconcile bid_events.
--
-- Deliberately scoped to status = 'active' only — ended/claimed auctions
-- already have their coin deduction accounted for by the older lump-sum
-- "Auction Win" entry, and backfilling "Bid Placed" there too would double
-- up the log against that same money. Active auctions are exactly what
-- members are bidding on right now.
--
-- Does NOT touch coins anywhere — the real balance was always correctly
-- adjusted by adjustMemberCoinsAtomic regardless of this logging gap. This
-- only adds the missing log entries. Idempotent: checks for an existing
-- matching entry (by auctionId + change + logType) before inserting, so
-- it's safe to run more than once.
--
-- Run this as ONE statement (the whole DO block) in the Supabase SQL Editor.

do $$
declare
  auc record;
  bids_arr jsonb;
  bid_elem jsonb;
  prev_bidder text;
  prev_amount numeric;
  cur_bidder text;
  cur_amount numeric;
  cur_time bigint;
  v_date text;
  v_exists boolean;
  idx int;
begin
  for auc in
    select id, name, bids
    from auctions
    where status = 'active'
      and bids is not null
      and jsonb_array_length(bids) > 0
  loop
    select jsonb_agg(elem order by (elem->>'time')::bigint)
      into bids_arr
      from jsonb_array_elements(auc.bids) elem;

    prev_bidder := null;
    prev_amount := null;

    for idx in 0 .. jsonb_array_length(bids_arr) - 1 loop
      bid_elem := bids_arr -> idx;
      cur_bidder := bid_elem->>'bidder';
      cur_amount := (bid_elem->>'amount')::numeric;
      cur_time := (bid_elem->>'time')::bigint;
      v_date := to_char(to_timestamp(cur_time / 1000.0), 'MM/DD/YYYY');

      -- Backfill cur_bidder's "Bid Placed" entry if missing
      select exists (
        select 1
        from members m, jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) e
        where m.name = cur_bidder
          and e->>'logType' = 'Bid Placed'
          and e->>'auctionId' = auc.id::text
          and (e->>'change')::numeric = -cur_amount
      ) into v_exists;

      if not v_exists then
        update members
        set tx_log = (
          coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'change', -cur_amount,
              'reason', 'Bid on ' || auc.name,
              'date', v_date,
              'ts', cur_time,
              'logType', 'Bid Placed',
              'addedBy', 'System',
              'auctionId', auc.id::text
            )
          )
        )::text
        where name = cur_bidder;
      end if;

      -- Backfill the previous bidder's "Outbid Refund" entry if missing
      if prev_bidder is not null and prev_bidder <> cur_bidder then
        select exists (
          select 1
          from members m, jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) e
          where m.name = prev_bidder
            and e->>'logType' = 'Outbid Refund'
            and e->>'auctionId' = auc.id::text
            and (e->>'change')::numeric = prev_amount
        ) into v_exists;

        if not v_exists then
          update members
          set tx_log = (
            coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(
              jsonb_build_object(
                'change', prev_amount,
                'reason', 'Outbid on ' || auc.name,
                'date', v_date,
                'ts', cur_time,
                'logType', 'Outbid Refund',
                'addedBy', 'System',
                'auctionId', auc.id::text
              )
            )
          )::text
          where name = prev_bidder;
        end if;
      end if;

      prev_bidder := cur_bidder;
      prev_amount := cur_amount;
    end loop;
  end loop;
end $$;
