-- Migrates the historical misattributed "clan-wide decay" entries (found
-- so far in EKUPMANN's and SDZAO's personal tx_log — e.g. "-6647 ... 20%
-- weekly coin decay applied to all 50 members") into app_state under key
-- "decay_announcements", matching where api/check-weekly-decay.js now
-- writes these going forward (see its ROOT CAUSE comment).
--
-- SAFE: this never touches any member's `coins` column. These entries
-- never corresponded to a real deduction from that member's own balance —
-- their own personal decay for the week was already applied separately,
-- via their own decay_log entry in the same run. This only relocates a
-- phantom log line out of an individual's personal history into the
-- genuine clan-wide log it always should have been in.
--
-- Run each step separately in the Supabase SQL Editor.


-- ============================================================
-- STEP 1 — PREVIEW (run first, confirm this only shows the
-- misattributed clan-wide entries, not anyone's real personal decay).
-- ============================================================
select
  m.name,
  elem->>'reason' as reason,
  (elem->>'change')::numeric as amount,
  to_timestamp((elem->>'ts')::bigint / 1000) as when_utc
from members m,
     jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
where elem->>'logType' = 'Weekly Decay'
  and elem->>'reason' ilike '%applied to all%';


-- ============================================================
-- STEP 2 — merge those entries into app_state.decay_announcements.
-- ============================================================
with misattributed as (
  select
    (elem->>'change')::numeric as amount,
    (elem->>'ts')::bigint as ts,
    elem->>'date' as entry_date,
    (regexp_match(elem->>'reason', '^([\d.]+)% weekly coin decay applied to all (\d+) members'))[1]::numeric as rate_pct,
    (regexp_match(elem->>'reason', '^([\d.]+)% weekly coin decay applied to all (\d+) members'))[2]::int as member_count
  from members m,
       jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
  where elem->>'logType' = 'Weekly Decay'
    and elem->>'reason' ilike '%applied to all%'
),
new_announcements as (
  select jsonb_agg(
    jsonb_build_object(
      'date', entry_date, 'ts', ts, 'ratePct', rate_pct,
      'memberCount', member_count, 'totalDecayed', -amount
    ) order by ts
  ) as arr
  from misattributed
)
insert into app_state (key, value, updated_at)
select
  'decay_announcements',
  (coalesce((select value::jsonb from app_state where key = 'decay_announcements'), '[]'::jsonb)
    || (select arr from new_announcements))::text,
  (extract(epoch from now()) * 1000)::bigint
where exists (select 1 from new_announcements where arr is not null)
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;


-- ============================================================
-- STEP 3 — remove the migrated entries from each member's personal
-- tx_log now that they live in app_state instead.
-- ============================================================
update members m
set tx_log = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)::text
  from jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
  where not (elem->>'logType' = 'Weekly Decay' and elem->>'reason' ilike '%applied to all%')
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) e2
  where e2->>'logType' = 'Weekly Decay' and e2->>'reason' ilike '%applied to all%'
);


-- ============================================================
-- STEP 4 — verify: should return zero rows.
-- ============================================================
select m.name
from members m,
     jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
where elem->>'logType' = 'Weekly Decay'
  and elem->>'reason' ilike '%applied to all%';
