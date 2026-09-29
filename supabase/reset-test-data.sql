-- ⚠️  ERASES ALL DATA: plans, classes, members, attendance, payments, shop.
-- Use it ONCE, after testing and before loading Nadia's real data.
-- Settings (due day, months without fees, birthday message) and the
-- login accounts are kept.
--
-- Supabase → SQL Editor → paste → Run. There is no undo.

truncate payments, charges, absences, sessions, enrollments, members,
  group_slots, groups, plan_prices, plans, sales, products
  restart identity;
