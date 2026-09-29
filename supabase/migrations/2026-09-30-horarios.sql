-- Chicas are signed up to TIMES (a day + hour of a class), not to whole
-- classes. Run once on a database created with the older schema.sql:
-- Supabase → SQL Editor → New query → paste → Run.
-- (schema.sql already includes all of this for new projects.)
-- Nothing existing is changed or deleted.

-- How many classes a week a plan includes ("3 veces por semana" = 3).
-- Only used to warn when a member's chosen times don't match her plan.
alter table plans add column times_per_week int check (times_per_week between 1 and 7);

-- Which weekly times (group_slots: one day + hour of a class) a member
-- goes to. Leaving a time sets end_date, so the history is kept.
-- The old `enrollments` (whole classes) are left as they are: a member
-- who still has one is shown as "Falta elegir horarios" until her times
-- are chosen, and meanwhile stays on every list of that class.
create table slot_enrollments (
  id         bigint generated always as identity primary key,
  member_id  bigint not null references members(id),
  slot_id    bigint not null references group_slots(id),
  start_date date not null default current_date,
  end_date   date
);

alter table slot_enrollments enable row level security;
create policy "Logged-in user has full access" on slot_enrollments
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on slot_enrollments to authenticated;
