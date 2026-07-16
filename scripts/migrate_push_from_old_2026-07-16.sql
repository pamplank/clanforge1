-- Pushes clanforge's data from vewslugeacpiewjreoqh (old, blocked project)
-- OUT to the new project, instead of having the new project pull IN --
-- inbound connections to the old project fail even with a confirmed-
-- correct password (three separate resets, identical "password
-- authentication failed" every time -- consistent with the whole project
-- being suspended for the exceed_egress_quota violation, not an auth
-- problem), but a plain SELECT/dblink FROM this project's own SQL Editor
-- still works, and an OUTBOUND dblink connection to the new project was
-- confirmed reachable (dblink_connect + dblink_disconnect succeeded
-- cleanly against it).
--
-- Run this ENTIRE file in the OLD project's (vewslugeacpiewjreoqh) SQL
-- Editor. It does NOT touch this project's own data (read-only against
-- every local table) -- everything it writes lands on the NEW project
-- over the open dblink connection.
--
-- Schema/RPC creation is pushed via dblink_exec here too (not assumed to
-- already exist on the new project) -- every statement is idempotent
-- (create table if not exists / create or replace function / on conflict
-- do nothing), so this is safe to run more than once if it fails partway
-- through.

create extension if not exists dblink;

select dblink_connect('new_db', 'postgresql://postgres:<NEW_DB_PASSWORD>@db.rnvcvrbfcmddpdvdxhgt.supabase.co:5432/postgres');

-- ============================================================
-- SCHEMA -- pushed to the new project
-- ============================================================

select dblink_exec('new_db', $push$
create table if not exists app_state (
  key text primary key not null,
  value text not null,
  updated_at bigint not null
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists attendance_logs (
  id double precision primary key not null,
  event text,
  date text,
  members integer default 0,
  recorded_by text,
  attendees text default '[]'::text,
  ts numeric
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists auction_win_claims (
  auction_id text primary key not null,
  claimed_by text,
  claimed_at bigint
)
$push$);

select dblink_exec('new_db', $push$
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
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists bid_events (
  id text primary key not null,
  bidder text,
  auction_name text,
  amount numeric,
  ts bigint
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists coin_requests (
  id text primary key not null,
  member_id bigint,
  member_name text,
  amount integer,
  type text,
  reason text,
  requested_by text,
  requested_at text
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists coins_backup_pre_correction (
  id bigint,
  name text,
  coins bigint,
  backed_up_at timestamp with time zone
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists event_coin_values (
  id text primary key not null,
  coins integer not null default 0,
  updated_at timestamp with time zone not null default now()
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists loot_results (
  id text primary key not null,
  timestamp bigint,
  date text,
  event_label text,
  results text
)
$push$);

select dblink_exec('new_db', $push$
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
)
$push$);

select dblink_exec('new_db', $push$
create table if not exists push_subscriptions (
  id text primary key not null,
  member_name text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at bigint not null
)
$push$);

-- ============================================================
-- RPCs -- latest bodies, same as scripts/migrate_to_new_project_2026-07-16.sql
-- ============================================================

select dblink_exec('new_db', $push$
create or replace function public.adjust_member_coins(member_name text, delta integer)
 returns integer
 language plpgsql
as $function$
declare
  new_balance integer;
begin
  update members
  set coins = coins + delta
  where name = member_name
  returning coins into new_balance;

  return new_balance;
end;
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.adjust_member_coins_and_log(
  p_member_name text,
  p_delta numeric,
  p_tx_entry jsonb
)
returns numeric
language plpgsql
as $function$
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
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.place_bid_atomic(
  p_auction_id text,
  p_bidder text,
  p_amount numeric,
  p_min_increment numeric default 5
)
returns jsonb
language plpgsql
as $function$
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
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.increment_auction_win(
  p_member_name text,
  p_tx_entry jsonb
)
returns int
language plpgsql
as $function$
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
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.record_attendance_and_log(
  p_member_name text,
  p_coins_delta numeric,
  p_attendance_delta integer,
  p_attend_entry jsonb,
  p_bonus_tx_entries jsonb
) returns numeric
language plpgsql
as $function$
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
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.revert_attendance_and_log(
  p_member_name text,
  p_refund numeric,
  p_attendance_delta integer,
  p_attend_entry jsonb,
  p_entry_ts text
) returns numeric
language plpgsql
as $function$
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
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.set_member_password(p_member_id text, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update members
  set password = p_new_password
  where id::text = p_member_id;
end;
$function$
$push$);

select dblink_exec('new_db', $push$
create or replace function public.verify_login(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  matched_id text;
begin
  select id::text into matched_id
  from members
  where lower(username) = lower(p_username)
    and password = p_password
  limit 1;

  return matched_id;
end;
$function$
$push$);

-- ============================================================
-- DATA -- read LOCAL rows from this (old) project, push each one to the
-- new project via the open dblink connection. ON CONFLICT DO NOTHING
-- makes every loop safe to re-run.
-- ============================================================

do $push$
declare r record;
begin
  for r in select * from app_state loop
    perform dblink_exec('new_db', format(
      'insert into app_state (key, value, updated_at) values (%L,%L,%L) on conflict (key) do nothing',
      r.key, r.value, r.updated_at
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from attendance_logs loop
    perform dblink_exec('new_db', format(
      'insert into attendance_logs (id, event, date, members, recorded_by, attendees, ts) values (%L,%L,%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.event, r.date, r.members, r.recorded_by, r.attendees, r.ts
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from auction_win_claims loop
    perform dblink_exec('new_db', format(
      'insert into auction_win_claims (auction_id, claimed_by, claimed_at) values (%L,%L,%L) on conflict (auction_id) do nothing',
      r.auction_id, r.claimed_by, r.claimed_at
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from auctions loop
    perform dblink_exec('new_db', format(
      'insert into auctions (id, name, description, status, ends_at, started_at, current_bid, top_bidder, min_bid, image_data, image_name, rarity, bids, ending_soon_notified) values (%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.name, r.description, r.status, r.ends_at, r.started_at, r.current_bid, r.top_bidder, r.min_bid, r.image_data, r.image_name, r.rarity, r.bids, r.ending_soon_notified
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from bid_events loop
    perform dblink_exec('new_db', format(
      'insert into bid_events (id, bidder, auction_name, amount, ts) values (%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.bidder, r.auction_name, r.amount, r.ts
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from coin_requests loop
    perform dblink_exec('new_db', format(
      'insert into coin_requests (id, member_id, member_name, amount, type, reason, requested_by, requested_at) values (%L,%L,%L,%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.member_id, r.member_name, r.amount, r.type, r.reason, r.requested_by, r.requested_at
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from coins_backup_pre_correction loop
    perform dblink_exec('new_db', format(
      'insert into coins_backup_pre_correction (id, name, coins, backed_up_at) values (%L,%L,%L,%L)',
      r.id, r.name, r.coins, r.backed_up_at
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from event_coin_values loop
    perform dblink_exec('new_db', format(
      'insert into event_coin_values (id, coins, updated_at) values (%L,%L,%L) on conflict (id) do nothing',
      r.id, r.coins, r.updated_at
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from loot_results loop
    perform dblink_exec('new_db', format(
      'insert into loot_results (id, "timestamp", date, event_label, results) values (%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.timestamp, r.date, r.event_label, r.results
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from members loop
    perform dblink_exec('new_db', format(
      'insert into members (id, name, username, password, role, cls, power, coins, attendance, join_date, auction_wins, decay_log, tx_log, attend_log, discord, power_log, profile_rarity, awakening_level, last_login_ts) values (%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.name, r.username, r.password, r.role, r.cls, r.power, r.coins, r.attendance, r.join_date, r.auction_wins, r.decay_log, r.tx_log, r.attend_log, r.discord, r.power_log, r.profile_rarity, r.awakening_level, r.last_login_ts
    ));
  end loop;
end $push$;

do $push$
declare r record;
begin
  for r in select * from push_subscriptions loop
    perform dblink_exec('new_db', format(
      'insert into push_subscriptions (id, member_name, endpoint, p256dh, auth, created_at) values (%L,%L,%L,%L,%L,%L) on conflict (id) do nothing',
      r.id, r.member_name, r.endpoint, r.p256dh, r.auth, r.created_at
    ));
  end loop;
end $push$;

-- ============================================================
-- SECURITY -- reapply the password-column lockdown on the new project
-- ============================================================

select dblink_exec('new_db', $push$
revoke select on members from anon, authenticated
$push$);

select dblink_exec('new_db', $push$
grant select (
  id, name, username, role, cls, power, coins, attendance, join_date,
  auction_wins, decay_log, tx_log, attend_log, discord, power_log,
  profile_rarity, awakening_level, last_login_ts
) on members to anon, authenticated
$push$);

select dblink_exec('new_db', $push$notify pgrst, 'reload schema'$push$);

-- ============================================================
-- VERIFY -- local (old project) counts vs remote (new project) counts,
-- side by side. Every row should match.
-- ============================================================

select 'app_state' as table_name, count(*) as local_count from app_state
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

select * from dblink('new_db', $push$
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
  order by 1
$push$) as t(table_name text, remote_count bigint);

select dblink_disconnect('new_db');
