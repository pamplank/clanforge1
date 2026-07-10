-- Full "My Points History" (tx_log + attend_log + decay_log only, no
-- bid_events) for the members whose SUPPOSED_COINS itself is negative -
-- meaning their logged spending (auction wins, decay) exceeds their
-- logged income (attendance, bonuses). LadyLeti and eithan10 are already
-- resolved (floored at 0); included here for completeness alongside the
-- unresolved ones: AScott, ThomasShelby, Netanyahu, Ezel.

with entries as (
  select
    m.name, m.coins as current_coins,
    'tx_log' as source, (elem->>'ts')::bigint as ts,
    (elem->>'change')::numeric as amount,
    coalesce(elem->>'logType','') as label,
    coalesce(elem->>'reason','') as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem
  where m.name in ('LadyLeti','eithan10','AScott','ThomasShelby','Netanyahu','Ezel')

  union all

  select
    m.name, m.coins,
    'attend_log', (elem->>'ts')::bigint,
    (elem->>'coins')::numeric,
    'Attendance',
    coalesce(elem->>'event','') || ' (' || coalesce(elem->>'qualifier','') || ')'
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) elem
  where m.name in ('LadyLeti','eithan10','AScott','ThomasShelby','Netanyahu','Ezel')

  union all

  select
    m.name, m.coins,
    'decay_log', (elem->>'ts')::bigint,
    (elem->>'amount')::numeric,
    'Weekly Decay', ''
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) elem
  where m.name in ('LadyLeti','eithan10','AScott','ThomasShelby','Netanyahu','Ezel')
)
select
  name, current_coins,
  to_timestamp(ts/1000) as when_utc,
  source, label, amount,
  sum(amount) over (partition by name order by ts, source rows between unbounded preceding and current row) as running_total,
  detail
from entries
order by name, ts, source;
