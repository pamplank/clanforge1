-- Full "My Points History" for every member — exactly what the app shows
-- them under My Points History (Attendance, bonuses, admin adjustments,
-- Auction Win, Weekly Decay). Deliberately excludes bid_events / any raw
-- bidding activity, since that was never part of My Points History in
-- the first place (see t("myPointsHistoryDesc") in src/App.jsx) and
-- comparing against it was the source of earlier confusion.
--
-- Each row's running_total should end at that member's actual `coins`
-- value. Where it doesn't, that's a genuine, unexplained discrepancy
-- worth fixing — not bidding noise.

with entries as (
  select
    m.name,
    m.coins as current_coins,
    'tx_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'change')::numeric as amount,
    coalesce(elem->>'logType', '') as label,
    coalesce(elem->>'reason', '') as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem

  union all

  select
    m.name,
    m.coins,
    'attend_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'coins')::numeric as amount,
    'Attendance' as label,
    coalesce(elem->>'event', '') || ' (' || coalesce(elem->>'qualifier', '') || ')' as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.attend_log::jsonb, '[]'::jsonb)) elem

  union all

  select
    m.name,
    m.coins,
    'decay_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'amount')::numeric as amount,
    'Weekly Decay' as label,
    '' as detail
  from members m
  cross join lateral jsonb_array_elements(coalesce(m.decay_log::jsonb, '[]'::jsonb)) elem
)
select
  name,
  current_coins,
  to_timestamp(ts/1000) as when_utc,
  source,
  label,
  amount,
  sum(amount) over (partition by name order by ts, source rows between unbounded preceding and current row) as running_total,
  detail
from entries
order by name, ts, source;
