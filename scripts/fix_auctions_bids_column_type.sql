-- ROOT CAUSE of "Someone just bid higher. Please try again." firing on
-- EVERY bid attempt, even with zero competing bidders (place_bid_atomic
-- returning HTTP 400: "COALESCE types text and jsonb cannot be matched",
-- Postgres error 42804):
--
-- auctions.bids is supposed to be a jsonb column -- place_bid_atomic does
-- `coalesce(bids, '[]'::jsonb) || jsonb_build_array(...)`, which requires
-- a real jsonb column to type-check. A recent database migration/copy
-- (see scripts/migration_recreate_and_copy.sql and friends) re-created
-- this table with `bids` typed as plain text instead. Its stored values
-- are still genuinely valid JSON text (e.g.
-- '[{"bidder":"X","amount":100,"time":...}]'), just held as a text
-- scalar rather than a real jsonb array -- confirmed via the REST API
-- returning `"bids":"[...]"` (a quoted string) instead of `"bids":[...]`
-- (a real array) for every auction row.
--
-- Only the DECLARED TYPE changes here -- every existing row's bid history
-- survives the cast unchanged, since the text already is valid JSON.
--
-- Run this once in the Supabase SQL Editor for this project.
--
-- Three separate steps, not one combined ALTER: the column's existing
-- default (a plain text '[]') isn't automatically castable to jsonb, so
-- Postgres rejects a single `TYPE ... USING ...` that also tries to carry
-- the old default forward. Dropping it first sidesteps that entirely --
-- it gets replaced with a proper jsonb default in the last step anyway.

alter table auctions alter column bids drop default;
alter table auctions alter column bids type jsonb using bids::jsonb;
alter table auctions alter column bids set default '[]'::jsonb;
