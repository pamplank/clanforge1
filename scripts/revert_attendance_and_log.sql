-- ROOT CAUSE of the same coin/history drift bug recurring: DeleteAttendanceModal
-- built a full new row for every affected member (coins refund + attendLog/
-- txLog entry removal) from this browser's local state, then wrote all of
-- them at once via setMembers's racy upsert -- same lost-update race already
-- found and fixed for bidding, admin coin adjustments, and attendance
-- recording, just never applied to attendance *deletion*.
--
-- One atomic UPDATE per member: coins refund, attendance delta, and removing
-- the matching attendLog entry + any bonus txLog entries stamped with the
-- same ts, all in one indivisible statement.
--
-- attend_log removal is by deep JSONB equality against the exact entry
-- object the client matched (jsonb `<>` compares structurally, independent
-- of key order/whitespace) -- this removes every element deeply equal to
-- it, not just one. The old client code removed only one object by
-- reference identity; if truly duplicate attendLog entries exist (itself a
-- symptom of an earlier version of this exact bug class), removing all of
-- them together is the safer outcome, not a mystery leftover twin.
create or replace function revert_attendance_and_log(
  p_member_name text,
  p_refund numeric,
  p_attendance_delta integer,
  p_attend_entry jsonb,
  p_entry_ts text
) returns numeric
language plpgsql
as $$
declare
  new_coins numeric;
begin
  update members
  set
    coins = coins - p_refund,
    attendance = greatest(0, attendance - p_attendance_delta),
    attend_log = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(coalesce(attend_log::jsonb, '[]'::jsonb)) elem
      where elem <> p_attend_entry
    )::text,
    tx_log = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(coalesce(tx_log::jsonb, '[]'::jsonb)) elem
      where not (elem->>'addedBy' = 'System' and p_entry_ts is not null and elem->>'ts' = p_entry_ts)
    )::text
  where name = p_member_name
  returning coins into new_coins;

  return new_coins;
end;
$$;
