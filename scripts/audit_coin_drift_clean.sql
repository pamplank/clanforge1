-- Clean balance check for all members: current `coins` vs. the balance
-- implied by ONLY the logged history (tx_log + attend_log + decay_log).
--
-- Deliberately excludes bid_events / "Bid Placed" entirely — those are
-- raw escrow activity (money temporarily held while a bid is live, mostly
-- refunded when outbid) and were never part of this calculation. Only
-- confirmed, permanent events belong here:
--   - attend_log: attendance rewards actually credited
--   - tx_log: bonuses, admin adjustments, and "Auction Win" (the final,
--     permanent charge for winning an auction)
--   - decay_log: weekly coin decay actually applied
--
-- If current_coins doesn't equal supposed_coins here, it means the coins
-- column and the logged history have genuinely diverged — NOT that
-- someone has an open/losing bid sitting in escrow (that was the
-- confusion the mixed timeline caused).

with logs as (
  select
    m.name,
    m.coins as current_coins,
    coalesce((
      select sum((elem->>'change')::numeric)
      from jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
    ), 0) as tx_log_total,
    coalesce((
      select sum((elem->>'coins')::numeric)
      from jsonb_array_elements(coalesce(m.attend_log::jsonb, '[]'::jsonb)) elem
    ), 0) as attend_log_total,
    coalesce((
      select sum((elem->>'amount')::numeric)
      from jsonb_array_elements(coalesce(m.decay_log::jsonb, '[]'::jsonb)) elem
    ), 0) as decay_log_total
  from members m
)
select
  name,
  current_coins,
  (tx_log_total + attend_log_total + decay_log_total) as supposed_coins,
  current_coins - (tx_log_total + attend_log_total + decay_log_total) as diff,
  tx_log_total,
  attend_log_total,
  decay_log_total
from logs
order by diff desc;
