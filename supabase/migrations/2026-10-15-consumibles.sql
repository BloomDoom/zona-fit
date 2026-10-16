-- Products are either clothes (they hang on the rack, the perchero, and a
-- chica can take them to try) or consumables (agua, granola). Every
-- product that exists now starts as clothes: Nadia changes the Agua to
-- "Consumible" on its screen.
--
-- Run this BEFORE the app update that uses it.
-- Supabase → SQL Editor → paste → Run.

alter table products
  add column kind text not null default 'clothes' check (kind in ('clothes', 'consumable'));
