-- "Mark as Distributed" feature (Auction History view): lets admins track
-- whether a won item has actually been handed to its winner outside the app
-- (Discord, in-game trade, etc.) — previously untracked, so admins could
-- lose track of which won items still owed to a winner.
--
-- distributed     -- has this won item actually been handed out. Defaults
--                     false so every existing ended auction starts as
--                     "pending distribution" rather than silently marked done.
-- distributed_at  -- timestamptz of when an admin marked it. Null until then.
-- distributed_by  -- the marking admin's display name (same convention as
--                     top_bidder/coin_requests.requested_by — a name string,
--                     not a members.id foreign key). Null until marked.
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor. No grant
-- changes needed — anon already has the same read/write access to these new
-- columns as the rest of the `auctions` table (unlike `members.coins`/
-- `tx_log`, which are locked down — see lock_down_coins_columns_v2.sql. This
-- feature is gated client-side only, same as every other admin action here.)

alter table auctions
  add column if not exists distributed boolean not null default false,
  add column if not exists distributed_at timestamptz,
  add column if not exists distributed_by text;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFY: run individually after the block above.
-- ============================================================

-- 1. New columns exist and default distributed to false for existing rows.
-- select id, name, status, top_bidder, distributed, distributed_at, distributed_by
-- from auctions limit 5;
