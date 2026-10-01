-- Tienda: clothes can be on the rack (perchero) or with a chica.
-- Nadia gives clothes to the chicas to try; later each one is bought or
-- given back (e.g. Aye takes 3, buys 2 and returns 1).
-- Run once: Supabase → SQL Editor → New query → paste → Run.
-- (schema.sql already includes all of this for new projects.)

-- Who bought it, for sales of clothes a chica had taken (empty otherwise).
alter table sales add column member_id bigint references members(id);

-- What each chica took and how it ended:
--   lent     = she took qty from the rack
--   returned = she gave qty back to the rack
--   sold     = she bought qty of what she had (sale_id = that sale)
-- What she still has = lent − returned − sold. products.stock counts only
-- what's on the rack, so lending takes it off and returning puts it back.
create table loan_moves (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('lent', 'returned', 'sold')),
  product_id bigint not null references products(id),
  member_id  bigint not null references members(id),
  qty        int not null check (qty > 0),
  sale_id    bigint references sales(id),
  moved_on   date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- How many of a product a chica has right now.
create function loan_qty(p_product bigint, p_member bigint)
returns int language sql stable as $$
  select coalesce(sum(case when kind = 'lent' then qty else -qty end), 0)::int
  from loan_moves
  where product_id = p_product and member_id = p_member and deleted_at is null
$$;

-- Everything that's with a chica now, one row per chica + product.
-- since = the first day she took it.
create function open_loans()
returns table (member_id bigint, member_name text, product_id bigint, product_name text,
               price int, qty int, since date)
language sql stable as $$
  select l.member_id, m.name, l.product_id, p.name, p.price,
         sum(case when l.kind = 'lent' then l.qty else -l.qty end)::int,
         min(l.moved_on) filter (where l.kind = 'lent')
  from loan_moves l
  join members m on m.id = l.member_id
  join products p on p.id = l.product_id
  where l.deleted_at is null
  group by l.member_id, m.name, l.product_id, p.name, p.price
  having sum(case when l.kind = 'lent' then l.qty else -l.qty end) > 0
  order by m.name, p.name
$$;

-- A chica takes p_qty from the rack. Returns the move id (for Undo).
create function lend_product(p_product bigint, p_member bigint, p_qty int)
returns bigint language plpgsql as $$
declare new_id bigint;
begin
  update products set stock = stock - p_qty where id = p_product;
  if not found then
    raise exception 'product % not found', p_product;
  end if;
  insert into loan_moves (kind, product_id, member_id, qty)
  values ('lent', p_product, p_member, p_qty)
  returning id into new_id;
  return new_id;
end $$;

-- She gives p_qty back: they go back on the rack. Returns the move id.
create function return_loan(p_product bigint, p_member bigint, p_qty int)
returns bigint language plpgsql as $$
declare new_id bigint;
begin
  if p_qty > loan_qty(p_product, p_member) then
    raise exception 'she only has % of product %', loan_qty(p_product, p_member), p_product;
  end if;
  update products set stock = stock + p_qty where id = p_product;
  insert into loan_moves (kind, product_id, member_id, qty)
  values ('returned', p_product, p_member, p_qty)
  returning id into new_id;
  return new_id;
end $$;

-- She buys p_qty of what she has, at today's price. The stock doesn't
-- change (it already left the rack). Returns the sale id (undo with undo_sale).
create function sell_loan(p_product bigint, p_member bigint, p_qty int, p_method text)
returns bigint language plpgsql as $$
declare new_id bigint;
begin
  if p_qty > loan_qty(p_product, p_member) then
    raise exception 'she only has % of product %', loan_qty(p_product, p_member), p_product;
  end if;
  insert into sales (product_id, qty, unit_price, method, member_id)
  select id, p_qty, price, p_method, p_member from products where id = p_product
  returning id into new_id;
  insert into loan_moves (kind, product_id, member_id, qty, sale_id)
  values ('sold', p_product, p_member, p_qty, new_id);
  return new_id;
end $$;

-- Undo a "took" or "gave back" (a "bought" is undone with undo_sale).
create function undo_loan_move(p_move bigint)
returns void language plpgsql as $$
declare l record;
begin
  update loan_moves set deleted_at = now()
  where id = p_move and kind in ('lent', 'returned') and deleted_at is null
  returning kind, product_id, member_id, qty into l;
  if not found then
    return;
  end if;
  if loan_qty(l.product_id, l.member_id) < 0 then
    raise exception 'she already bought or returned some of it';
  end if;
  update products
  set stock = stock + case when l.kind = 'lent' then l.qty else -l.qty end
  where id = l.product_id;
end $$;

-- Undo / remove a sale: marked as removed, and the stock goes back. If
-- the sale was of clothes a chica had, they go back to her instead.
create or replace function undo_sale(p_sale bigint)
returns void language plpgsql as $$
declare s record;
begin
  update sales set deleted_at = now()
  where id = p_sale and deleted_at is null
  returning product_id, qty into s;
  if found then
    update loan_moves set deleted_at = now() where sale_id = p_sale and deleted_at is null;
    if not found then
      update products set stock = stock + s.qty where id = s.product_id;
    end if;
  end if;
end $$;

revoke execute on function loan_qty(bigint, bigint), open_loans(), lend_product(bigint, bigint, int),
  return_loan(bigint, bigint, int), sell_loan(bigint, bigint, int, text), undo_loan_move(bigint) from public, anon;
grant execute on function loan_qty(bigint, bigint), open_loans(), lend_product(bigint, bigint, int),
  return_loan(bigint, bigint, int), sell_loan(bigint, bigint, int, text), undo_loan_move(bigint) to authenticated;

alter table loan_moves enable row level security;
create policy "Logged-in user has full access" on loan_moves
  for all to authenticated using (true) with check (true);
grant select, insert, update on loan_moves to authenticated;
