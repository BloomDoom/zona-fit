-- A plan is now just how many times a week it includes; its name is made
-- from that number ("3 veces por semana"). This fills the number in for
-- plans typed by hand ("3 veces x semana" → 3) and renames them to match.
-- Run once: Supabase → SQL Editor → New query → paste → Run.
-- Plans, prices, members and fees stay the same; only these two columns change.

update plans
set times_per_week = substring(name from '\d+')::int
where times_per_week is null
  and substring(name from '\d+')::int between 1 and 7;

update plans
set name = case when times_per_week = 1 then '1 vez por semana'
                else times_per_week || ' veces por semana' end
where times_per_week is not null;

-- To check: every plan should have a number now.
select id, name, times_per_week, active from plans order by id;
