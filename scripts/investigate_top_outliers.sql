-- Full ledger (tx_log + attend_log + decay_log, chronological, running
-- total) plus raw bid_events, for the 5 members with the largest
-- remaining unexplained drift after the decay and misattribution fixes:
-- GinisangOtin, LadyLeti, ikillyou, eithan10, ChiefRGB.
--
-- Goal: see whether their drift concentrates around the known bad window
-- (heavy MVP bidding wars, 2026-07-08 to 2026-07-09, before the
-- place_bid_atomic fix was deployed) or reveals something else.

with entries as (
  select
    m.name, m.coins as current_coins,
    'tx_log' as source, (elem->>'ts')::bigint as ts,
    (elem->>'change')::numeric as amount,
    coalesce(elem->>'logType','') as label,
    coalesce(elem->>'reason','') as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem
  where m.name in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')

  union all

  select
    m.name, m.coins,
    'attend_log', (elem->>'ts')::bigint,
    (elem->>'coins')::numeric,
    'Attendance',
    coalesce(elem->>'event','') || ' (' || coalesce(elem->>'qualifier','') || ')'
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) elem
  where m.name in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')

  union all

  select
    m.name, m.coins,
    'decay_log', (elem->>'ts')::bigint,
    (elem->>'amount')::numeric,
    'Weekly Decay', ''
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) elem
  where m.name in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')

  union all

  select
    be.bidder, m.coins,
    'bid_events', be.ts,
    -be.amount,
    'Bid Placed', be.auction_name
  from bid_events be
  join members m on m.name = be.bidder
  where be.bidder in ('GinisangOtin','LadyLeti','ikillyou','eithan10','ChiefRGB')
)
select
  name, current_coins,
  to_timestamp(ts/1000) as when_utc,
  source, label, amount,
  sum(case when source <> 'bid_events' then amount else 0 end)
    over (partition by name order by ts, source rows between unbounded preceding and current row) as history_running_total,
  detail
from entries
order by name, ts, source;
