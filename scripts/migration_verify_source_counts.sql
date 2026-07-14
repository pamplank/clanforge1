-- Run on the CURRENT project - compare these counts against Step 4 of
-- migration_recreate_and_copy.sql (run on the ORIGINAL project). Every
-- row should match exactly.

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
