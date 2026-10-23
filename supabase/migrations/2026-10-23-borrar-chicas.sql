-- Chicas can be deleted ("Borrar"). Like everything else, nothing is really
-- erased: she gets a deleted_at date (and active = false) and the app hides
-- her everywhere. Her past payments and sales still count in the totals.
--
-- Supabase → SQL Editor → paste → Run.

alter table members add column deleted_at timestamptz;
