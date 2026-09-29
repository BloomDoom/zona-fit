-- Tienda: its own wallet and a low-stock minimum per product.
-- Run once on a database created with the older schema.sql:
-- Supabase → SQL Editor → New query → paste → Run.
-- (schema.sql already includes all of this for new projects.)

-- Warn when a product has this many or fewer. Each product has its own.
alter table products add column min_stock int not null default 3 check (min_stock >= 0);

-- Money that goes in or out of the shop, apart from sales:
--   purchase   = paid for stock that arrived (product_id + qty)
--   withdrawal = money taken out of the shop (e.g. to the gym's pocket)
--   deposit    = money put in (e.g. the cash the shop starts with)
-- Wallet balance = sales + deposits − purchases − withdrawals.
create table shop_moves (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('purchase', 'withdrawal', 'deposit')),
  amount     int not null check (amount >= 0),
  product_id bigint references products(id),
  qty        int,
  note       text,
  moved_on   date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Stock arrived and was paid for: adds the stock and the purchase together.
-- Returns the purchase id (the app keeps it for the Undo button).
create function restock(p_product bigint, p_qty int, p_cost int)
returns bigint language plpgsql as $$
declare new_id bigint;
begin
  update products set stock = stock + p_qty where id = p_product;
  if not found then
    raise exception 'product % not found', p_product;
  end if;
  insert into shop_moves (kind, amount, product_id, qty)
  values ('purchase', p_cost, p_product, p_qty)
  returning id into new_id;
  return new_id;
end $$;

-- Undo / remove a purchase: marked as removed, and its stock is taken back.
create function undo_restock(p_move bigint)
returns void language plpgsql as $$
declare m record;
begin
  update shop_moves set deleted_at = now()
  where id = p_move and kind = 'purchase' and deleted_at is null
  returning product_id, qty into m;
  if found then
    update products set stock = stock - m.qty where id = m.product_id;
  end if;
end $$;

-- What's in the shop's wallet right now.
create function shop_balance()
returns int language sql stable as $$
  select (coalesce((select sum(qty * unit_price) from sales where deleted_at is null), 0)
        + coalesce((select sum(case when kind = 'deposit' then amount else -amount end)
                    from shop_moves where deleted_at is null), 0))::int
$$;

revoke execute on function restock(bigint, int, int), undo_restock(bigint), shop_balance() from public, anon;
grant execute on function restock(bigint, int, int), undo_restock(bigint), shop_balance() to authenticated;

alter table shop_moves enable row level security;
create policy "Logged-in user has full access" on shop_moves
  for all to authenticated using (true) with check (true);
grant select, insert, update on shop_moves to authenticated;
