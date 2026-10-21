-- Undoes 2026-10-21-gym-users.sql: any logged-in user can do everything
-- again, as before, and the gym_users table is removed.
--
-- ⚠️ If Heladera logins exist, they will see the gym's data again.
--
-- Supabase → SQL Editor → paste → Run. If anything fails, nothing changes.

begin;

do $$
declare t text;
begin
  foreach t in array array['settings', 'plans', 'plan_prices', 'groups', 'group_slots', 'members',
    'slot_enrollments', 'enrollments','sessions', 'absences', 'charges', 'payments', 'products', 'sales', 'shop_moves', 'loan_moves']
  loop
    execute format('drop policy "Gym users have full access" on %I', t);
    execute format('create policy "Logged-in user has full access" on %I
                    for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop table gym_users;

commit;
