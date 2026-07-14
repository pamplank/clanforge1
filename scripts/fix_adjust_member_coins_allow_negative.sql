-- adjust_member_coins backs adjustMemberCoinsAtomic, which placeBid() uses
-- for both the bid-amount deduction and the outbid refund. It still floors
-- with greatest(0, coins + delta) - the same clamp-at-0 behavior removed
-- everywhere else today (see reset_coins_allow_negative.sql and the
-- App.jsx Math.max(0, ...) removals). The client already blocks a bid
-- whose amount exceeds the browser's cached balance (me.coins<amount in
-- placeBid), but that cache can be stale under concurrent bids/admin
-- corrections - if a deduction ever did land against too-low a balance,
-- this floor would silently hide the resulting debt instead of showing it
-- like every other code path now does. Removing it for consistency.

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
$function$
