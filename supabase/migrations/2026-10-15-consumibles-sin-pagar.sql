-- A chica can take a consumable (agua) and pay later. It's saved like
-- clothes she took (loan_moves: "lent", then "sold" when she pays), so
-- open_loans now also says what kind each product is: the app shows
-- "sin pagar" and only a "Pagó" button for consumables.
--
-- Safe with the app before or after this update.
-- Supabase → SQL Editor → paste → Run.

drop function open_loans();

create function open_loans()
returns table (member_id bigint, member_name text, product_id bigint, product_name text,
               price int, qty int, since date, kind text)
language sql stable as $$
  select l.member_id, m.name, l.product_id, p.name, p.price,
         sum(case when l.kind = 'lent' then l.qty else -l.qty end)::int,
         min(l.moved_on) filter (where l.kind = 'lent'),
         p.kind
  from loan_moves l
  join members m on m.id = l.member_id
  join products p on p.id = l.product_id
  where l.deleted_at is null
  group by l.member_id, m.name, l.product_id, p.name, p.price, p.kind
  having sum(case when l.kind = 'lent' then l.qty else -l.qty end) > 0
  order by m.name, p.name
$$;

revoke execute on function open_loans() from public, anon;
grant execute on function open_loans() to authenticated;
