-- Follow-up to audit_coin_drift.sql: dumps the raw, timestamp-sorted
-- history for specific flagged members so the individual entries behind
-- a diff can be inspected directly, rather than just the totals.
--
-- Edit the names in the `targets` array below to whichever members you
-- want to inspect (defaults to the negative-diff members plus the two
-- largest positive-diff members from the last audit run).

with targets as (
  select unnest(array[
    'SCARLETT01','Ezel','Aishifishy','Dexxu','Winø','Valk0Freya','ARIRANG',
    'EKUPMANN','SDZAO'
  ]) as name
),
entries as (
  select
    m.name,
    'tx_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'change')::numeric as amount,
    coalesce(elem->>'logType','') as label,
    coalesce(elem->>'reason','') as detail
  from members m
  join targets t on t.name = m.name
  cross join lateral jsonb_array_elements(coalesce(m.tx_log::jsonb,'[]'::jsonb)) elem

  union all

  select
    m.name,
    'attend_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'coins')::numeric as amount,
    'Attendance' as label,
    coalesce(elem->>'event','') || ' (' || coalesce(elem->>'qualifier','') || ')' as detail
  from members m
  join targets t on t.name = m.name
  cross join lateral jsonb_array_elements(coalesce(m.attend_log::jsonb,'[]'::jsonb)) elem

  union all

  select
    m.name,
    'decay_log' as source,
    (elem->>'ts')::bigint as ts,
    (elem->>'amount')::numeric as amount,
    'Weekly Decay' as label,
    '' as detail
  from members m
  join targets t on t.name = m.name
  cross join lateral jsonb_array_elements(coalesce(m.decay_log::jsonb,'[]'::jsonb)) elem
)
select
  name,
  to_timestamp(ts/1000) as when_utc,
  source,
  label,
  amount,
  sum(amount) over (partition by name order by ts rows between unbounded preceding and current row) as running_total,
  detail
from entries
order by name, ts;
