-- ROOT CAUSE of "members not getting their coins back when outbid":
-- the app's ACTUAL production Supabase project is rnvcvrbfcmddpdvdxhgt
-- (confirmed by pulling the live production JS bundle from
-- peakyblindersdkp.vercel.app and finding this hostname baked into it,
-- and matching VITE_SUPABASE_URL in local .env). But every migration/fix
-- script from the 2026-07-16 "migrate off egress-throttled project"
-- episode (migrate_push_from_old_2026-07-16.sql, migrate_to_new_project_
-- 2026-07-16.sql, migration_recreate_and_copy.sql, and place_bid_atomic_v2.sql
-- itself) targeted a DIFFERENT project: ieyizwhfzdukndvsgsyt. That ref
-- never appears anywhere in this file's target project. The coin-safe
-- version of place_bid_atomic (and friends) was deployed to a project
-- nobody's traffic actually hits.
--
-- Confirmed live against production data (read-only queries, 2026-07-18):
-- of the last 66 bids placed since the migration, 45 (68%) updated the
-- auction's bids/current_bid/top_bidder columns but left the bidder
-- uncharged and the person they outbid unrefunded -- e.g. Aishifishy bid
-- 400 on "x100k gwemix", was outbid by ARIRANG's 450, and was never
-- refunded; the eventual winner Vanessa (805 coins) has zero tx_log
-- entries for that auction at all. An admin (ThomasShelby) had already
-- independently discovered this and was hand-patching balances via
-- "Admin Manual Add" entries labeled e.g. "x100 Gwemix Refund" as of
-- 2026-07-17 -- this script replaces that manual workaround.
--
-- NOTE: the failure wasn't 100% consistent -- some bids in the same
-- window DID log correctly. The client only has one bid code path
-- (placeBid -> placeBidAtomic -> rpc/place_bid_atomic, confirmed by
-- grepping src/App.jsx -- no second/legacy bid submission path exists),
-- so an intermittent, partially-working RPC on the SAME project points
-- at a stray duplicate function overload (different argument types)
-- rather than "the fix was never applied at all". Run the diagnostic
-- query below FIRST, before applying anything, to check for that.
--
-- ============================================================
-- STEP 0 -- DIAGNOSTIC: run this alone first and read the output.
-- ============================================================
-- If this returns more than one row, there are multiple overloads of
-- place_bid_atomic and PostgREST may be routing calls to whichever one
-- matches the JSON body's inferred argument types -- which would fully
-- explain why some bids worked and others didn't. Note which row(s)
-- lack the coin-adjustment logic (no `update members` touching `coins`)
-- before proceeding, so you know what STEP 1 needs to remove.
--
-- select pg_get_function_identity_arguments(p.oid) as args, p.prosrc
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'place_bid_atomic';

-- ============================================================
-- STEP 1 -- defensively drop any stray overloads with different argument
-- types before recreating the canonical one below. CREATE OR REPLACE only
-- replaces a function with the EXACT SAME argument types -- it cannot
-- remove a differently-typed duplicate, which is exactly the scenario
-- the diagnostic above is checking for. These DROPs are no-ops (IF
-- EXISTS) if no such overload exists.
-- ============================================================
drop function if exists public.place_bid_atomic(text, text, integer, integer);
drop function if exists public.place_bid_atomic(text, text, numeric, integer);
drop function if exists public.place_bid_atomic(text, text, integer, numeric);

-- ============================================================
-- STEP 2 -- the canonical, coin-safe place_bid_atomic (verbatim from
-- scripts/place_bid_atomic_v2.sql / the version confirmed pushed to
-- ieyizwhfzdukndvsgsyt in migrate_push_from_old_2026-07-16.sql). Claims
-- the auction row, deducts the bidder, and refunds whoever they just
-- outbid, all inside one locked transaction.
-- ============================================================
create or replace function public.place_bid_atomic(p_auction_id text, p_bidder text, p_amount numeric, p_min_increment numeric default 5)
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

-- ============================================================
-- STEP 3 -- the other atomic coin-touching functions this app depends on
-- (adjustMemberCoinsAtomic / adjustMemberCoinsAndLogAtomic / incrementAuctionWinAtomic
-- / recordAttendanceAndLogAtomic / revertAttendanceAndLogAtomic in
-- src/App.jsx). Reapplying these too on the same no-regret basis --
-- CREATE OR REPLACE is a no-op if the correct version is already there,
-- and closes the same class of gap for attendance/admin-coin/auction-win
-- paths if this project is missing their fixes as well.
-- ============================================================
create or replace function public.adjust_member_coins(member_name text, delta integer)
returns integer
language plpgsql
as $$
declare
  new_balance integer;
begin
  update members
  set coins = coins + delta
  where name = member_name
  returning coins into new_balance;

  return new_balance;
end;
$$;

create or replace function public.adjust_member_coins_and_log(
  p_member_name text,
  p_delta numeric,
  p_tx_entry jsonb
)
returns numeric
language plpgsql
as $$
declare
  new_coins numeric;
begin
  update members
  set
    coins = coins + p_delta,
    tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(p_tx_entry))::text
  where name = p_member_name
  returning coins into new_coins;

  return new_coins;
end;
$$;

create or replace function public.increment_auction_win(
  p_member_name text,
  p_tx_entry jsonb
)
returns int
language plpgsql
as $$
declare
  new_wins int;
begin
  update members
  set
    auction_wins = coalesce(auction_wins, 0) + 1,
    tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || jsonb_build_array(p_tx_entry))::text
  where name = p_member_name
  returning auction_wins into new_wins;

  return new_wins;
end;
$$;

create or replace function public.record_attendance_and_log(
  p_member_name text,
  p_coins_delta numeric,
  p_attendance_delta integer,
  p_attend_entry jsonb,
  p_bonus_tx_entries jsonb
) returns numeric
language plpgsql
as $$
declare
  new_coins numeric;
begin
  update members
  set
    coins = coins + p_coins_delta,
    attendance = attendance + p_attendance_delta,
    attend_log = (coalesce(attend_log::jsonb, '[]'::jsonb) || jsonb_build_array(p_attend_entry))::text,
    tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || p_bonus_tx_entries)::text
  where name = p_member_name
  returning coins into new_coins;

  return new_coins;
end;
$$;

create or replace function public.revert_attendance_and_log(
  p_member_name text,
  p_refund numeric,
  p_attendance_delta integer,
  p_attend_entry jsonb,
  p_entry_ts text
) returns numeric
language plpgsql
as $$
declare
  new_coins numeric;
begin
  update members
  set
    coins = coins - p_refund,
    attendance = greatest(0, attendance - p_attendance_delta),
    attend_log = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(coalesce(attend_log::jsonb, '[]'::jsonb)) elem
      where elem <> p_attend_entry
    )::text,
    tx_log = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(coalesce(tx_log::jsonb, '[]'::jsonb)) elem
      where not (elem->>'addedBy' = 'System' and p_entry_ts is not null and elem->>'ts' = p_entry_ts)
    )::text
  where name = p_member_name
  returning coins into new_coins;

  return new_coins;
end;
$$;

-- ============================================================
-- VERIFY: re-run the STEP 0 diagnostic query -- should now return
-- exactly one row for place_bid_atomic, with prosrc containing
-- "v_new_bidder_coins" (confirms the coin-safe version, and only that
-- version, is live).
-- ============================================================
