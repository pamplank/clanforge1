-- Migrates clanforge OFF vewslugeacpiewjreoqh (current live project, blocked
-- with HTTP 402 "exceed_egress_quota" as of 2026-07-16) onto a brand-new
-- Supabase project. This is the SECOND time this has happened -- see
-- scripts/migration_recreate_and_copy.sql for the first round (that one
-- moved off a project nicknamed "RedTed" and onto vewslugeacpiewjreoqh,
-- which has now also run out of quota). That script is NOT reusable as-is:
-- it embeds RPC bodies from before several since-fixed bugs (place_bid_atomic
-- without the atomic coin deduction / prev-bidder capture, no
-- adjust_member_coins_and_log, adjust_member_coins still floors at 0). This
-- script rebuilds everything against the CURRENT, correct definitions,
-- pulled directly from the individual fix scripts already in this
-- directory (adjust_member_coins_and_log.sql, place_bid_atomic_v2.sql,
-- increment_auction_win.sql, record_attendance_and_log.sql,
-- revert_attendance_and_log.sql, set_member_password.sql, verify_login.sql,
-- lock_down_password_column_v2.sql, fix_adjust_member_coins_allow_negative.sql).
--
-- WHY THIS KEEPS HAPPENING: the violation is "exceed_egress_quota" both
-- times. The app polls auctions + members every 3s per active browser tab
-- (see the poll effect in src/App.jsx) -- that's almost certainly the real
-- driver, not one-off large transfers. Migrating again without addressing
-- that (longer poll interval, narrower `select=` columns, or realtime
-- subscriptions instead of polling) very likely just delays the next
-- outage. Worth a follow-up once the site is back up.
--
-- ============================================================
-- HOW TO RUN THIS
-- ============================================================
-- 1. Create a brand-new Supabase project in the dashboard. Note its
--    project ref, DB password (set at creation), and (once created)
--    Settings -> API -> anon public key and Project URL.
-- 2. Open the NEW project's SQL Editor and run this entire file as one
--    script. Fill in <SOURCE_DB_PASSWORD> below with vewslugeacpiewjreoqh's
--    Postgres password (Settings -> Database -> Connection string, on the
--    OLD/current project's dashboard -- note the dashboard UI for the
--    CURRENT project may itself be sluggish/blocked since it's the same
--    api.supabase.com path the egress block affects, but the password
--    itself is static config, not a live API call, so it should still be
--    visible there; if not, use the DB password you already have saved
--    from when that project was created).
-- 3. After this script finishes, run the two VERIFY blocks at the bottom
--    and confirm every row count matches between old and new.
-- 4. Migrate storage buckets separately (SQL can't do this) -- see the end
--    of this file for the command.
-- 5. Update .env: swap VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to the
--    new project's values, `npm run build`, redeploy.

-- ============================================================
-- STEP 0 -- enable dblink (lets this new project pull rows directly from
-- the old project's Postgres over the network -- this bypasses the
-- api.supabase.com egress block entirely, since that block only applies
-- to the REST/dashboard gateway, not raw port-5432 Postgres connections;
-- confirmed reachable this way during the first migration too, see
-- scripts/migration_verify_source_counts_via_dblink.sql)
-- ============================================================
create extension if not exists dblink;

-- ============================================================
-- STEP 1 -- recreate schema (types confirmed against the live fixes
-- applied since the last dump -- notably auctions.bids IS jsonb here,
-- avoiding the text/jsonb mismatch bug fixed in
-- fix_auctions_bids_column_type.sql by declaring it correctly from the
-- start)
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
-- STEP 2 -- recreate every RPC the app currently calls, using the LATEST
-- body of each (not the stale ones embedded in the first migration
-- script). Source: the individual fix scripts in this directory, cross-
-- checked against every `/rpc/...` call in src/App.jsx.
-- ============================================================

-- adjust_member_coins: latest = no floor-at-0 clamp (negative balances
-- allowed), see fix_adjust_member_coins_allow_negative.sql
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
$function$;

-- adjust_member_coins_and_log: atomic coins delta + tx_log append in one
-- statement, see scripts/adjust_member_coins_and_log.sql
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

-- place_bid_atomic: latest = auction claim + bidder deduction + outbid
-- refund + both log entries + insufficient-funds check, ALL in one
-- transaction, see scripts/place_bid_atomic_v2.sql (supersedes the older
-- fix_place_bid_atomic_refund_target.sql, which only fixed the
-- prev_bidder/prev_amount capture without the coin-deduction atomicity)
create or replace function public.place_bid_atomic(
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

-- increment_auction_win: latest = tx_log cast to jsonb explicitly (fixes
-- the COALESCE text/jsonb type error), see scripts/increment_auction_win.sql
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

-- record_attendance_and_log: atomic coins/attendance delta + attend_log +
-- bonus tx_log entries, see scripts/record_attendance_and_log.sql
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

-- revert_attendance_and_log: atomic coins refund + attend_log/tx_log entry
-- removal, see scripts/revert_attendance_and_log.sql
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

-- set_member_password / verify_login: SECURITY DEFINER, see
-- scripts/set_member_password.sql and scripts/verify_login.sql. Created
-- BEFORE the column-level lockdown below so anon never has a window where
-- it can read members.password directly.
create or replace function public.set_member_password(p_member_id text, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update members
  set password = p_new_password
  where id::text = p_member_id;
end;
$$;

create or replace function public.verify_login(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- ============================================================
-- STEP 3 -- copy every row from the OLD project (vewslugeacpiewjreoqh) via
-- dblink, bypassing its blocked REST API entirely. FILL IN THE PASSWORD
-- BELOW before running -- do not commit this file back to git with a real
-- password in it (see scripts/migration_recreate_and_copy.sql's own
-- REDACTED_ROTATE_ME markers; the same discipline applies here).
-- ============================================================

insert into app_state
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select key, value, updated_at from app_state')
  as t(key text, value text, updated_at bigint);

insert into attendance_logs
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, event, date, members, recorded_by, attendees, ts from attendance_logs')
  as t(id double precision, event text, date text, members integer, recorded_by text, attendees text, ts numeric);

insert into auction_win_claims
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select auction_id, claimed_by, claimed_at from auction_win_claims')
  as t(auction_id text, claimed_by text, claimed_at bigint);

insert into auctions
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, name, description, status, ends_at, started_at, current_bid, top_bidder, min_bid, image_data, image_name, rarity, bids, ending_soon_notified from auctions')
  as t(id text, name text, description text, status text, ends_at bigint, started_at bigint, current_bid bigint, top_bidder text, min_bid bigint, image_data text, image_name text, rarity text, bids jsonb, ending_soon_notified boolean);

insert into bid_events
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, bidder, auction_name, amount, ts from bid_events')
  as t(id text, bidder text, auction_name text, amount numeric, ts bigint);

insert into coin_requests
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, member_id, member_name, amount, type, reason, requested_by, requested_at from coin_requests')
  as t(id text, member_id bigint, member_name text, amount integer, type text, reason text, requested_by text, requested_at text);

insert into coins_backup_pre_correction
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, name, coins, backed_up_at from coins_backup_pre_correction')
  as t(id bigint, name text, coins bigint, backed_up_at timestamp with time zone);

insert into event_coin_values
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, coins, updated_at from event_coin_values')
  as t(id text, coins integer, updated_at timestamp with time zone);

insert into loot_results
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, "timestamp", date, event_label, results from loot_results')
  as t(id text, "timestamp" bigint, date text, event_label text, results text);

insert into members
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, name, username, password, role, cls, power, coins, attendance, join_date, auction_wins, decay_log, tx_log, attend_log, discord, power_log, profile_rarity, awakening_level, last_login_ts from members')
  as t(id bigint, name text, username text, password text, role text, cls text, power bigint, coins bigint, attendance integer, join_date text, auction_wins integer, decay_log text, tx_log text, attend_log text, discord text, power_log text, profile_rarity text, awakening_level integer, last_login_ts bigint);

insert into push_subscriptions
select * from dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres',
  'select id, member_name, endpoint, p256dh, auth, created_at from push_subscriptions')
  as t(id text, member_name text, endpoint text, p256dh text, auth text, created_at bigint);

-- ============================================================
-- STEP 4 -- reapply the password-column lockdown (see
-- scripts/lock_down_password_column_v2.sql for the full incident history
-- of why this is a two-part revoke+grant, not a simple column revoke)
-- ============================================================

revoke select on members from anon, authenticated;

grant select (
  id, name, username, role, cls, power, coins, attendance, join_date,
  auction_wins, decay_log, tx_log, attend_log, discord, power_log,
  profile_rarity, awakening_level, last_login_ts
) on members to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFY -- row counts, should match STEP 5 (run against the OLD project
-- for comparison, via dblink since its own dashboard/API may still be
-- blocked)
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

-- Compare against the OLD project's true counts, sidestepping its blocked
-- dashboard the same way as the copy above:
select * from public.dblink('postgresql://postgres:<SOURCE_DB_PASSWORD>@db.vewslugeacpiewjreoqh.supabase.co:5432/postgres', '
  select ''app_state'' as table_name, count(*) from app_state
  union all select ''attendance_logs'', count(*) from attendance_logs
  union all select ''auction_win_claims'', count(*) from auction_win_claims
  union all select ''auctions'', count(*) from auctions
  union all select ''bid_events'', count(*) from bid_events
  union all select ''coin_requests'', count(*) from coin_requests
  union all select ''coins_backup_pre_correction'', count(*) from coins_backup_pre_correction
  union all select ''event_coin_values'', count(*) from event_coin_values
  union all select ''loot_results'', count(*) from loot_results
  union all select ''members'', count(*) from members
  union all select ''push_subscriptions'', count(*) from push_subscriptions
  order by 1
') as t(table_name text, count bigint);

-- Also spot-check verify_login and set_member_password work before
-- treating the new project as ready:
-- select verify_login('someusername', 'theirrealpassword');  -- should return an id
-- select verify_login('someusername', 'definitely-wrong');   -- should return null
-- select * from members limit 1;  -- should NOT include a password column in the result

-- ============================================================
-- STEP 5 (outside SQL, run from a terminal in the repo) -- storage
-- buckets can't be copied via SQL; reuse the migration script already
-- built for exactly this (scripts/migrate-auction-images-bucket.js /
-- `npm run migrate:auction-images`). Needs SERVICE ROLE keys (not anon)
-- for both projects, set as env vars, run once per bucket:
--
--   SOURCE_SUPABASE_URL=https://vewslugeacpiewjreoqh.supabase.co \
--   SOURCE_SUPABASE_SERVICE_ROLE_KEY=<old project's service_role key> \
--   TARGET_SUPABASE_URL=<new project URL> \
--   TARGET_SUPABASE_SERVICE_ROLE_KEY=<new project's service_role key> \
--   BUCKET_NAME=auction-images \
--   npm run migrate:auction-images
--
--   (repeat with BUCKET_NAME=profile-card-assets)
--
-- Create both buckets (public read) in the new project's Storage tab
-- first if they don't already exist there.
