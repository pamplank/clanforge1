-- Final balance check, escrow-aware: current coins vs logged history,
-- netting out coins currently held by an active auction bid so live
-- bidding activity isn't mistaken for drift.

with escrow as (
  select top_bidder as name, sum(current_bid) as escrowed
  from auctions
  where status = 'active' and top_bidder is not null
  group by top_bidder
),
logs as (
  select
    m.id,
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
    ), 0) as decay_log_total,
    coalesce(e.escrowed, 0) as active_bid_escrow
  from members m
  left join escrow e on e.name = m.name
)
select
  name,
  current_coins,
  (tx_log_total + attend_log_total + decay_log_total - active_bid_escrow) as supposed_coins,
  current_coins - (tx_log_total + attend_log_total + decay_log_total - active_bid_escrow) as diff,
  active_bid_escrow
from logs
order by abs(current_coins - (tx_log_total + attend_log_total + decay_log_total - active_bid_escrow)) desc;
