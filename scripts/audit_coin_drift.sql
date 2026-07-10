-- Audits every member's live `coins` balance against the balance implied by
-- their full history (tx_log + attend_log + decay_log). These three logs
-- are non-overlapping (attendance base pay only ever lands in attend_log,
-- bonuses/auctions/manual adjustments only in tx_log, decay only in
-- decay_log), so summing them should always reproduce `coins` exactly.
-- A non-zero diff means some code path mutated `coins` without writing a
-- matching log entry (or vice versa) — i.e. exactly the class of bug fixed
-- in increment_auction_win.sql and the coin-deduction RPC.
--
-- diff > 0  -> member has MORE coins than their history justifies (overpaid)
-- diff < 0  -> member has FEWER coins than their history justifies (shorted)
--
-- Note: some write paths clamp coins at a floor of 0 (Math.max(0, coins+change)
-- in the client for elder requests / manual adjustments), so a small diff for
-- members who hit 0 balance at some point may be expected rather than a bug.

with logs as (
  select
    m.id,
    m.name,
    m.coins as current_coins,
    coalesce((
      select sum((elem->>'change')::numeric)
      from jsonb_array_elements(coalesce(m.tx_log::jsonb, '[]'::jsonb)) elem
    ), 0) as tx_log_total,
    coalesce((
      select sum((elem->>'coins')::numeric)
      from jsonb_array_elements(coalesce(m.attend_log::jsonb, '[]'::jsonb)) elem
    ), 0) as attend_log_total,
    coalesce((
      select sum((elem->>'amount')::numeric)
      from jsonb_array_elements(coalesce(m.decay_log::jsonb, '[]'::jsonb)) elem
    ), 0) as decay_log_total
  from members m
)
select
  name,
  current_coins,
  (tx_log_total + attend_log_total + decay_log_total) as supposed_coins,
  current_coins - (tx_log_total + attend_log_total + decay_log_total) as diff,
  tx_log_total,
  attend_log_total,
  decay_log_total
from logs
where current_coins - (tx_log_total + attend_log_total + decay_log_total) <> 0
order by diff desc;
