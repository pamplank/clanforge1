-- Reverts the effects of a manual test bid placed during verification of the
-- new Bid Placed / Outbid Refund points-history logging (see App.jsx Auctions
-- bid handler). ThomasShelby bid 30 coins on "Grim Axe(Bound)" (auctionId
-- 1783888084672), outbidding EKUPMANN's existing 25-coin bid.
--
-- Run each statement below individually in the Supabase SQL Editor (some
-- editors error on multiple ;-separated statements pasted as one block).

-- 1. Restore the auction's bid state: back to EKUPMANN winning at 25,
--    with ThomasShelby's test bid removed from the bids array.
update auctions
set current_bid = 25,
    top_bidder = 'EKUPMANN',
    bids = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(bids) elem
      where not (elem->>'bidder' = 'ThomasShelby' and (elem->>'amount')::numeric = 30)
    )
where name = 'Grim Axe(Bound)';

-- NOTE: members.tx_log is stored as text (serialized JSON), not native
-- jsonb, unlike auctions.bids above — hence the ::jsonb / ::text casts here.

-- 2. Restore ThomasShelby's coins (+30) and remove the test "Bid Placed" entry.
update members
set coins = coins + 30,
    tx_log = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(tx_log::jsonb) elem
      where not (elem->>'logType' = 'Bid Placed'
                 and elem->>'reason' = 'Bid on Grim Axe(Bound)'
                 and (elem->>'change')::numeric = -30)
    )::text
where lower(name) = 'thomasshelby';

-- 3. Restore EKUPMANN's coins (-25) and remove the test "Outbid Refund" entry.
update members
set coins = coins - 25,
    tx_log = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(tx_log::jsonb) elem
      where not (elem->>'logType' = 'Outbid Refund'
                 and elem->>'reason' = 'Outbid on Grim Axe(Bound)'
                 and (elem->>'change')::numeric = 25)
    )::text
where lower(name) = 'ekupmann';

-- 4. Verify: auction back to current_bid=25/top_bidder=EKUPMANN, ThomasShelby's
--    coins +30 with no "Bid Placed" entry, EKUPMANN's coins -25 with no
--    "Outbid Refund" entry.
select id, name, current_bid, top_bidder, bids
from auctions
where name = 'Grim Axe(Bound)';

select id, name, coins, tx_log
from members
where lower(name) in ('thomasshelby', 'ekupmann');
