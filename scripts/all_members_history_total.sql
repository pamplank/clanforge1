-- Same calculation as GinisangOtin's check, applied to everyone: current
-- coins vs. the sum of ONLY tx_log + attend_log + decay_log (no
-- bid_events, no active-bid escrow adjustment) - so we can compare
-- against the last full check and see what's changed.

with logs as (
  select
    m.name,
    m.coins as current_coins,
    coalesce((select sum((e->>'change')::numeric) from jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'coins')::numeric) from jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) e), 0)
    + coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) e), 0) as supposed_coins
  from members m
)
select
  name,
  current_coins,
  supposed_coins,
  current_coins - supposed_coins as diff
from logs
order by abs(current_coins - supposed_coins) desc;
