-- Full chronological "My Points History" for GinisangOtin: tx_log
-- (Admin Manual Add, bonuses, Auction Win) + attend_log + decay_log only.
-- Deliberately excludes bid_events / raw bidding activity — that was
-- never part of My Points History and mixing it in just adds noise.

with entries as (
  select
    'tx_log' as source, (elem->>'ts')::bigint as ts,
    (elem->>'change')::numeric as amount,
    coalesce(elem->>'logType','') as label,
    coalesce(elem->>'reason','') as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem
  where m.name = 'GinisangOtin'

  union all

  select
    'attend_log', (elem->>'ts')::bigint,
    (elem->>'coins')::numeric,
    'Attendance',
    coalesce(elem->>'event','') || ' (' || coalesce(elem->>'qualifier','') || ')'
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) elem
  where m.name = 'GinisangOtin'

  union all

  select
    'decay_log', (elem->>'ts')::bigint,
    (elem->>'amount')::numeric,
    'Weekly Decay', ''
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) elem
  where m.name = 'GinisangOtin'
)
select
  to_timestamp(ts/1000) as when_utc,
  source, label, amount,
  sum(amount) over (order by ts, source rows between unbounded preceding and current row) as running_total,
  detail
from entries
order by ts, source;
