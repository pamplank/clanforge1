-- Removes a duplicate "Admin Manual Add" entry from GinisangOtin's tx_log.
-- A single admin coin-add click produced two identical history entries
-- (same reason, same +705 amount, same minute) -- but her actual `coins`
-- value only reflects the credit ONCE (confirmed manually), so this is a
-- pure logging duplicate, not a real double-payment. Likely cause: the
-- app wraps a real network write (dbUpsert) inside a React state updater
-- function (setMembers), which React's StrictMode intentionally
-- double-invokes in development to catch impure code like this -- this
-- almost certainly only happens when testing against the dev server
-- (npm run dev), not on the deployed production site members actually
-- use, since StrictMode's double-invoke behavior is stripped from
-- production builds entirely.
--
-- This removes exactly ONE occurrence of the duplicate (matching on
-- amount/type/reason/addedBy, not the exact millisecond timestamp, in
-- case the two entries' `ts` differ slightly) -- coins is NOT touched.
--
-- Run STEP 1 first to confirm there are exactly 2 matching entries before
-- running STEP 2.

-- ============================================================
-- STEP 1 — PREVIEW (should show exactly 2 rows)
-- ============================================================
select elem, ord
from members m,
     lateral jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) with ordinality as t(elem, ord)
where m.name = 'GinisangOtin'
  and elem->>'logType' = 'Admin Manual Add'
  and elem->>'change' = '705'
  and elem->>'reason' ilike '%Clan Annihilation MVP%Refund%';

-- ============================================================
-- STEP 2 — APPLY (removes only the 2nd+ occurrence of the exact
-- duplicate group; every other entry is preserved in original order)
-- ============================================================
with expanded as (
  select m.id, elem, ord
  from members m,
       lateral jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) with ordinality as t(elem, ord)
  where m.name = 'GinisangOtin'
),
ranked as (
  select
    id, elem, ord,
    row_number() over (
      partition by (elem->>'change'), (elem->>'logType'), (elem->>'reason'), (elem->>'addedBy')
      order by ord
    ) as rn
  from expanded
),
deduped as (
  select id, jsonb_agg(elem order by ord) as new_tx_log
  from ranked
  where not (
    rn > 1
    and elem->>'logType' = 'Admin Manual Add'
    and elem->>'change' = '705'
    and elem->>'reason' ilike '%Clan Annihilation MVP%Refund%'
  )
  group by id
)
update members m
set tx_log = d.new_tx_log::text
from deduped d
where m.id = d.id;

-- ============================================================
-- STEP 3 — VERIFY (coins should be unchanged; only 1 matching entry left)
-- ============================================================
select
  name, coins,
  (select count(*) from jsonb_array_elements(tx_log::jsonb) e
   where e->>'logType' = 'Admin Manual Add' and e->>'change' = '705'
     and e->>'reason' ilike '%Clan Annihilation MVP%Refund%') as matching_entries_remaining
from members where name = 'GinisangOtin';
