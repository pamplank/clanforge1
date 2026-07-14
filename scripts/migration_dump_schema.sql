-- Step 1 of the Supabase-to-Supabase migration: dump the CURRENT project's
-- exact schema (column names, types, defaults) so the original project's
-- tables can be recreated identically instead of guessed at - we already
-- learned the hard way this session that tx_log is TEXT, not JSONB, and a
-- wrong guess there caused a real production bug (increment_auction_win's
-- COALESCE type mismatch). Run in the CURRENT project's SQL Editor.

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- ============================================================
-- Primary keys / unique constraints (needed for auction_win_claims'
-- one-insert-wins protection, and every table's real PK)
-- ============================================================
select
  tc.table_name,
  tc.constraint_type,
  kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type;


-- ============================================================
-- The 3 atomic RPC functions the app depends on for bidding/coins/wins -
-- their exact bodies need to be recreated verbatim on the original project,
-- not rewritten from memory.
-- ============================================================
select proname, pg_get_functiondef(oid) as definition
from pg_proc
where proname in ('adjust_member_coins', 'place_bid_atomic', 'increment_auction_win')
  and pronamespace = 'public'::regnamespace;

