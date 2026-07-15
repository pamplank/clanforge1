-- ROOT CAUSE of the same coin/history drift bug recurring: RecordAttendancePanel
-- and AddMissingAttendanceModal both built a full new row for every present
-- member (coins + attendance + attendLog + txLog) from this browser's local
-- state, then wrote all of them at once via setMembers's racy upsert -- the
-- exact same lost-update race already found and fixed for bidding and admin
-- coin adjustments, just never applied here. A concurrent write to any one of
-- those members (another bid closing, another admin action) around the same
-- moment could silently lose either side of the change.
--
-- One atomic UPDATE per member: coins delta, attendance delta, one new
-- attend_log entry, and zero-or-more bonus tx_log entries, all in the same
-- indivisible statement -- same pattern as adjust_member_coins_and_log.
create or replace function record_attendance_and_log(
  p_member_name text,
  p_coins_delta numeric,
  p_attendance_delta integer,
  p_attend_entry jsonb,
  p_bonus_tx_entries jsonb
) returns numeric
language plpgsql
as $$
declare
  new_coins numeric;
begin
  update members
  set
    coins = coins + p_coins_delta,
    attendance = attendance + p_attendance_delta,
    attend_log = (coalesce(attend_log::jsonb, '[]'::jsonb) || jsonb_build_array(p_attend_entry))::text,
    tx_log = (coalesce(tx_log::jsonb, '[]'::jsonb) || p_bonus_tx_entries)::text
  where name = p_member_name
  returning coins into new_coins;

  return new_coins;
end;
$$;
