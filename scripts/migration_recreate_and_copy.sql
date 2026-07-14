-- Migrates clanforge from the current Supabase project (RedTed, the one
-- that hit its usage limit) to the original project, preserving ALL
-- current data (nothing reverts to the old stale state). Run this entire
-- script in the ORIGINAL project's SQL Editor.
--
-- This is idempotent for the schema (CREATE TABLE IF NOT EXISTS) but the
-- data step TRUNCATEs each table first, since the original project's data
-- is confirmed stale - it's fully replaced with the current project's
-- data, not merged with it.

-- ============================================================
-- STEP 0 - enable dblink (lets this project pull rows directly from the
-- current project over the network, entirely within this SQL Editor)
-- ============================================================
create extension if not exists dblink;


-- ============================================================
-- STEP 1 - recreate schema (exact column types/defaults, dumped from the
-- current project via information_schema)
-- ============================================================

create table if not exists app_state (
  key text primary key not null,
  value text not null,
  updated_at bigint not null
);

create table if not exists attendance_logs (
  id double precision primary key not null,
  event text,
  date text,
  members integer default 0,
  recorded_by text,
  attendees text default '[]'::text,
  ts numeric
);

create table if not exists auction_win_claims (
  auction_id text primary key not null,
  claimed_by text,
  claimed_at bigint
);

create table if not exists auctions (
  id text primary key not null,
  name text,
  description text,
  status text,
  ends_at bigint,
  started_at bigint,
  current_bid bigint default 0,
  top_bidder text,
  min_bid bigint default 0,
  image_data text,
  image_name text,
  rarity text default 'epic'::text,
  bids jsonb default '[]'::jsonb,
  ending_soon_notified boolean not null default false
);

create table if not exists bid_events (
  id text primary key not null,
  bidder text,
  auction_name text,
  amount numeric,
  ts bigint
);

create table if not exists coin_requests (
  id text primary key not null,
  member_id bigint,
  member_name text,
  amount integer,
  type text,
  reason text,
  requested_by text,
  requested_at text
);

create table if not exists coins_backup_pre_correction (
  id bigint,
  name text,
  coins bigint,
  backed_up_at timestamp with time zone
);

create table if not exists event_coin_values (
  id text primary key not null,
  coins integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create table if not exists loot_results (
  id text primary key not null,
  timestamp bigint,
  date text,
  event_label text,
  results text
);

create table if not exists members (
  id bigint primary key not null,
  name text,
  username text,
  password text,
  role text,
  cls text,
  power bigint default 0,
  coins bigint default 0,
  attendance integer default 0,
  join_date text,
  auction_wins integer default 0,
  decay_log text default '[]'::text,
  tx_log text default '[]'::text,
  attend_log text default '[]'::text,
  discord text default ''::text,
  power_log text default '[]'::text,
  profile_rarity text default 'uncommon'::text,
  awakening_level integer default 0,
  last_login_ts bigint default 0
);

create table if not exists push_subscriptions (
  id text primary key not null,
  member_name text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at bigint not null
);


-- ============================================================
-- STEP 2 - recreate the 3 atomic RPC functions the app depends on
-- (adjust_member_coins here already has the floor-at-0 clamp removed,
-- matching the fix just applied on the current project)
-- ============================================================

CREATE OR REPLACE FUNCTION public.adjust_member_coins(member_name text, delta integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  new_balance integer;
begin
  update members
  set coins = coins + delta
  where name = member_name
  returning coins into new_balance;

  return new_balance;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_auction_win(p_member_name text, p_tx_entry jsonb)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.place_bid_atomic(p_auction_id text, p_bidder text, p_amount numeric, p_min_increment numeric DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$;


-- ============================================================
-- STEP 3 - wipe stale data, then copy every row from the current project
-- over dblink. Order matters only for readability here (no FK constraints
-- exist between these tables in the source schema, so any order is safe).
-- ============================================================

truncate table app_state, attendance_logs, auction_win_claims, auctions,
  bid_events, coin_requests, coins_backup_pre_correction, event_coin_values,
  loot_results, members, push_subscriptions;

insert into app_state
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select key, value, updated_at from app_state')
  as t(key text, value text, updated_at bigint);

insert into attendance_logs
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, event, date, members, recorded_by, attendees, ts from attendance_logs')
  as t(id double precision, event text, date text, members integer, recorded_by text, attendees text, ts numeric);

insert into auction_win_claims
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select auction_id, claimed_by, claimed_at from auction_win_claims')
  as t(auction_id text, claimed_by text, claimed_at bigint);

insert into auctions
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, name, description, status, ends_at, started_at, current_bid, top_bidder, min_bid, image_data, image_name, rarity, bids, ending_soon_notified from auctions')
  as t(id text, name text, description text, status text, ends_at bigint, started_at bigint, current_bid bigint, top_bidder text, min_bid bigint, image_data text, image_name text, rarity text, bids jsonb, ending_soon_notified boolean);

insert into bid_events
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, bidder, auction_name, amount, ts from bid_events')
  as t(id text, bidder text, auction_name text, amount numeric, ts bigint);

insert into coin_requests
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, member_id, member_name, amount, type, reason, requested_by, requested_at from coin_requests')
  as t(id text, member_id bigint, member_name text, amount integer, type text, reason text, requested_by text, requested_at text);

insert into coins_backup_pre_correction
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, name, coins, backed_up_at from coins_backup_pre_correction')
  as t(id bigint, name text, coins bigint, backed_up_at timestamp with time zone);

insert into event_coin_values
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, coins, updated_at from event_coin_values')
  as t(id text, coins integer, updated_at timestamp with time zone);

insert into loot_results
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, "timestamp", date, event_label, results from loot_results')
  as t(id text, "timestamp" bigint, date text, event_label text, results text);

insert into members
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, name, username, password, role, cls, power, coins, attendance, join_date, auction_wins, decay_log, tx_log, attend_log, discord, power_log, profile_rarity, awakening_level, last_login_ts from members')
  as t(id bigint, name text, username text, password text, role text, cls text, power bigint, coins bigint, attendance integer, join_date text, auction_wins integer, decay_log text, tx_log text, attend_log text, discord text, power_log text, profile_rarity text, awakening_level integer, last_login_ts bigint);

insert into push_subscriptions
select * from dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres',
  'select id, member_name, endpoint, p256dh, auth, created_at from push_subscriptions')
  as t(id text, member_name text, endpoint text, p256dh text, auth text, created_at bigint);


-- ============================================================
-- STEP 4 - VERIFY: row counts on both sides should match exactly
-- ============================================================
select 'app_state' as table_name, count(*) from app_state
union all select 'attendance_logs', count(*) from attendance_logs
union all select 'auction_win_claims', count(*) from auction_win_claims
union all select 'auctions', count(*) from auctions
union all select 'bid_events', count(*) from bid_events
union all select 'coin_requests', count(*) from coin_requests
union all select 'coins_backup_pre_correction', count(*) from coins_backup_pre_correction
union all select 'event_coin_values', count(*) from event_coin_values
union all select 'loot_results', count(*) from loot_results
union all select 'members', count(*) from members
union all select 'push_subscriptions', count(*) from push_subscriptions
order by 1;
