-- Only the gym's logins can see and change the gym's data.
--
-- Until now any logged-in user could do everything. The Heladera app
-- (../heladera) shares this Supabase project, and its logins must not see
-- chicas, pagos or the tienda. So the gym's logins go into a new table,
-- gym_users, and every rule changes from "logged in" to "in gym_users".
--
-- Every login that exists today (Nadia's and the author's) goes into
-- gym_users first, so nobody loses access. Run this BEFORE creating any
-- Heladera login. Undo: 2026-10-21-gym-users-rollback.sql.
--
-- Supabase → SQL Editor → paste → Run. If anything fails, nothing changes.

begin;

create table gym_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

insert into gym_users (user_id) select id from auth.users;

-- If this runs again after the rollback, Heladera logins exist too: they
-- must not become gym users.
do $$
begin
  if to_regclass('heladera.household_members') is not null then
    execute 'delete from gym_users where user_id in (select user_id from heladera.household_members)';
  end if;
end $$;

-- Each login can only see its own row, which is all the rules below need.
alter table gym_users enable row level security;
create policy "Users see their own row" on gym_users
  for select to authenticated using (user_id = (select auth.uid()));
grant select on gym_users to authenticated;

do $$
declare t text;
begin
  foreach t in array array['settings', 'plans', 'plan_prices', 'groups', 'group_slots', 'members',
    'slot_enrollments', 'enrollments','sessions', 'absences', 'charges', 'payments', 'products', 'sales', 'shop_moves', 'loan_moves']
  loop
    execute format('drop policy "Logged-in user has full access" on %I', t);
    execute format('create policy "Gym users have full access" on %I for all to authenticated
                    using (exists (select 1 from gym_users where user_id = (select auth.uid())))
                    with check (exists (select 1 from gym_users where user_id = (select auth.uid())))', t);
  end loop;
end $$;

commit;
