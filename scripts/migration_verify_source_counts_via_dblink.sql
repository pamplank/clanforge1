-- The current (RedTed) project's dashboard/SQL Editor goes through
-- api.supabase.com, which the exceeded-usage-limit block affects - but the
-- raw Postgres database itself is still reachable directly (that's how
-- migration_recreate_and_copy.sql just pulled every row over dblink).
-- This counts the SOURCE rows the same way, sidestepping the broken
-- dashboard entirely. Run in the ORIGINAL project's SQL Editor (dblink is
-- already enabled there from the migration script).

select * from public.dblink('postgresql://postgres:REDACTED_ROTATE_ME@db.ieyizwhfzdukndvsgsyt.supabase.co:5432/postgres', '
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
