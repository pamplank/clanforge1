-- Item Buyout feature: adds the columns needed to offer a fixed "Buy Now"
-- price alongside normal bidding, scoped by rarity and time-windowed (see
-- src/auctionBuyout.js for the rarity -> window/multiplier table this
-- feature is built around).
--
-- buyout_price      -- the fixed coin price a buyer pays to win instantly.
--                       Null for rarities that don't offer buyout (Legendary)
--                       and for any auction created before this feature shipped.
-- buyout_expires_at -- epoch-ms timestamp after which "Buy Now" is no longer
--                       offered, even with zero bids (see spec: buyout must
--                       never be available past its window, full stop). Null
--                       alongside buyout_price for buyout-ineligible listings.
-- closed_reason     -- how an ended auction actually closed: 'buyout',
--                       'bid_won', or 'expired' (no bids). Null for auctions
--                       that ended before this feature shipped, and for any
--                       still-active auction. Kept distinct from `status` so
--                       analytics can tell a buyout apart from a normal win
--                       without re-deriving it from bids/top_bidder.
--
-- Run this ENTIRE file as one statement in the Supabase SQL Editor. No grant
-- changes needed — anon already has the same read/write access to these new
-- columns as the rest of the `auctions` table (unlike `members.coins`/
-- `tx_log`, which are locked down and only writable through a SECURITY
-- DEFINER RPC — see lock_down_coins_columns_v2.sql. buyout_auction_atomic.sql
-- follows that same RPC pattern for the coin side of a buyout.)

alter table auctions
  add column if not exists buyout_price numeric,
  add column if not exists buyout_expires_at bigint,
  add column if not exists closed_reason text;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFY: run individually after the block above.
-- ============================================================

-- 1. New columns exist and default to null for existing rows.
-- select id, name, rarity, status, buyout_price, buyout_expires_at, closed_reason
-- from auctions limit 5;

-- 2. (Optional) Backfill closed_reason for already-ended historical auctions,
--    so old rows aren't just blank in analytics going forward. Anything with
--    a top_bidder is assumed to have closed by a normal bid win (buyouts
--    didn't exist yet, so none of these are buyouts); anything without one
--    closed with zero bids.
-- update auctions
--   set closed_reason = case when top_bidder is not null then 'bid_won' else 'expired' end
--   where status = 'ended' and closed_reason is null;
