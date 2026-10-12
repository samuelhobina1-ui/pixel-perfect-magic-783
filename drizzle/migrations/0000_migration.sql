
create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.handle_admin_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(new.email) = 'samuelhobina1@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.handle_admin_signup();

create table public.categories (id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, image_url text, status text not null default 'active', sort_order int not null default 100, created_at timestamptz not null default now());
grant select on public.categories to anon, authenticated; grant insert, update, delete on public.categories to authenticated; grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public read active cats" on public.categories for select using (status='active' or public.has_role(auth.uid(),'admin'));
create policy "admin write cats" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.products (id uuid primary key default gen_random_uuid(), name text not null, category_id uuid references public.categories(id) on delete restrict not null, price_naira numeric not null check (price_naira >= 0), cost_price numeric not null default 0, image_url text, description text, how_to_use text, status text not null default 'active', deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select on public.products to anon, authenticated; grant insert, update, delete on public.products to authenticated; grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read active products" on public.products for select using ((status='active' and deleted_at is null) or public.has_role(auth.uid(),'admin'));
create policy "admin write products" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- hide cost from public
revoke select (cost_price) on public.products from anon;

create table public.pins_stock (id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id) on delete cascade not null, pin_code text not null, is_used boolean not null default false, used_at timestamptz, created_at timestamptz not null default now());
grant select, insert, update, delete on public.pins_stock to authenticated; grant all on public.pins_stock to service_role;
alter table public.pins_stock enable row level security;
create policy "admin pins" on public.pins_stock for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.orders (id uuid primary key default gen_random_uuid(), order_code text not null unique, product_id uuid references public.products(id) on delete set null, product_name text not null, category text not null, price numeric not null, cost_price numeric not null default 0, player_id text not null, customer_whatsapp text not null, receipt_image_url text not null, receipt_hash text, transaction_id text not null, status text not null default 'pending', pin_delivered text, delivery_mode text, auto_checks jsonb, reject_reason text, created_at timestamptz not null default now(), delivered_at timestamptz);
grant select, update, delete on public.orders to authenticated; grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin orders" on public.orders for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.price_change_log (id uuid primary key default gen_random_uuid(), product_id uuid, product_name text, old_price numeric, new_price numeric, changed_by text, created_at timestamptz not null default now());
grant select, insert on public.price_change_log to authenticated; grant all on public.price_change_log to service_role;
alter table public.price_change_log enable row level security;
create policy "admin log" on public.price_change_log for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.settings (id int primary key default 1 check (id=1), auto_mode boolean not null default false, opay_number text not null default '9045001199', opay_name text not null default 'Samuel Kingsley', whatsapp_number text not null default '218942368392', whatsapp_template text not null default E'✅ ZENTRA GAMING HUB ORDER APPROVED\nOrder ID: {order}\nProduct: {product}\nPIN: {pin}\nHow to recharge: *121*{pin}#\nSupport: +218942368392', low_stock_threshold int not null default 5);
insert into public.settings(id) values (1);
grant select on public.settings to anon, authenticated; grant update on public.settings to authenticated; grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "read settings" on public.settings for select using (true);
create policy "admin settings" on public.settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.products_touch() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at = now();
  if new.price_naira is distinct from old.price_naira then
    insert into public.price_change_log(product_id, product_name, old_price, new_price, changed_by)
    values (new.id, new.name, old.price_naira, new.price_naira, coalesce((select email from auth.users where id=auth.uid()),'system'));
  end if;
  return new;
end $$;
create trigger products_touch before update on public.products for each row execute function public.products_touch();

create view public.product_stock with (security_invoker=off) as
  select p.id as product_id, count(s.id) filter (where not s.is_used)::int as stock_count from public.products p left join public.pins_stock s on s.product_id=p.id group by p.id;
grant select on public.product_stock to anon, authenticated;

create or replace function public.place_order(_product_id uuid, _player_id text, _whatsapp text, _receipt_url text, _receipt_hash text, _transaction_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p record; s record; cat text; code text; checks jsonb; pass boolean; pin record; st text := 'pending'; mode text := null; pin_txt text := null;
begin
  if length(coalesce(_player_id,''))<3 or length(coalesce(_whatsapp,''))<6 or length(coalesce(_transaction_id,''))<4 or coalesce(_receipt_url,'')='' then raise exception 'Missing required fields'; end if;
  select * into p from products where id=_product_id and status='active' and deleted_at is null;
  if not found then raise exception 'Product unavailable'; end if;
  select name into cat from categories where id=p.category_id;
  select * into s from settings where id=1;
  code := 'ZGH-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8));
  checks := jsonb_build_object(
    'unique_transaction', not exists(select 1 from orders where lower(transaction_id)=lower(_transaction_id)),
    'unique_receipt', _receipt_hash is null or not exists(select 1 from orders where receipt_hash=_receipt_hash),
    'in_stock', exists(select 1 from pins_stock where product_id=p.id and not is_used),
    'today', true);
  pass := (checks->>'unique_transaction')::boolean and (checks->>'unique_receipt')::boolean and (checks->>'in_stock')::boolean;
  if s.auto_mode and pass then
    select * into pin from pins_stock where product_id=p.id and not is_used order by created_at limit 1 for update skip locked;
    if found then
      update pins_stock set is_used=true, used_at=now() where id=pin.id;
      st := 'auto_approved'; mode := 'auto'; pin_txt := pin.pin_code;
    end if;
  end if;
  insert into orders(order_code, product_id, product_name, category, price, cost_price, player_id, customer_whatsapp, receipt_image_url, receipt_hash, transaction_id, status, pin_delivered, delivery_mode, auto_checks, delivered_at)
  values (code, p.id, p.name, coalesce(cat,''), p.price_naira, p.cost_price, _player_id, _whatsapp, _receipt_url, _receipt_hash, _transaction_id, st, pin_txt, mode, checks, case when pin_txt is not null then now() end);
  return jsonb_build_object('order_code', code, 'status', st, 'pin', pin_txt, 'checks', checks);
end $$;
grant execute on function public.place_order(uuid,text,text,text,text,text) to anon, authenticated;

create or replace function public.track_order(_code text, _whatsapp text)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object('order_code',order_code,'product_name',product_name,'price',price,'status',status,'pin',pin_delivered,'delivery_mode',delivery_mode,'created_at',created_at,'reject_reason',reject_reason)
  from orders where upper(order_code)=upper(trim(_code)) and regexp_replace(customer_whatsapp,'\D','','g') like '%' || right(regexp_replace(_whatsapp,'\D','','g'),8) limit 1
$$;
grant execute on function public.track_order(text,text) to anon, authenticated;

create or replace function public.approve_order(_order_id uuid) returns text language plpgsql security definer set search_path=public as $$
declare o record; pin record;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  select * into o from orders where id=_order_id for update;
  if o.pin_delivered is not null then return o.pin_delivered; end if;
  select * into pin from pins_stock where product_id=o.product_id and not is_used order by created_at limit 1 for update skip locked;
  if not found then raise exception 'No PINs in stock for this product'; end if;
  update pins_stock set is_used=true, used_at=now() where id=pin.id;
  update orders set status='approved', pin_delivered=pin.pin_code, delivery_mode='manual', delivered_at=now() where id=_order_id;
  return pin.pin_code;
end $$;
grant execute on function public.approve_order(uuid) to authenticated;

insert into public.categories(name, slug, sort_order) values ('Libyana','libyana',1),('Almadar','almadar',2),('LTT','ltt',3),('CODM','codm',4),('PUBG','pubg',5),('Free Fire','freefire',6),('TikTok','tiktok',7);
insert into public.products(name, category_id, price_naira, how_to_use)
select v.name, c.id, v.price, v.how from (values
 ('Libyana 5','libyana',900,'Dial *121*PIN# to recharge.'),('Libyana 10','libyana',1800,'Dial *121*PIN# to recharge.'),('Libyana 15','libyana',2700,'Dial *121*PIN# to recharge.'),('Libyana 20','libyana',3600,'Dial *121*PIN# to recharge.'),('Libyana 30','libyana',5400,'Dial *121*PIN# to recharge.'),('Libyana 50','libyana',9000,'Dial *121*PIN# to recharge.'),
 ('Almadar 10','almadar',1800,'Dial *110*PIN# to recharge.'),('Almadar 20','almadar',3600,'Dial *110*PIN# to recharge.'),('Almadar 30','almadar',5400,'Dial *110*PIN# to recharge.'),
 ('LTT 10GB','ltt',5500,'Activate the code in your LTT account.'),('LTT 20GB','ltt',9500,'Activate the code in your LTT account.'),('LTT 50GB','ltt',18000,'Activate the code in your LTT account.'),
 ('CODM 80 CP','codm',2800,'Delivered to your Player ID.'),('CODM 400 CP','codm',8500,'Delivered to your Player ID.'),('CODM 800 CP','codm',16000,'Delivered to your Player ID.'),('CODM 2000 CP','codm',35000,'Delivered to your Player ID.'),
 ('PUBG 60 UC','pubg',2500,'Delivered to your Player ID.'),('PUBG 325 UC','pubg',8000,'Delivered to your Player ID.'),('PUBG 660 UC','pubg',13000,'Delivered to your Player ID.'),('PUBG 1800 UC','pubg',28000,'Delivered to your Player ID.'),
 ('Free Fire 100 Diamonds','freefire',2500,'Delivered to your Player ID.'),('Free Fire 310 Diamonds','freefire',6500,'Delivered to your Player ID.'),('Free Fire 520 Diamonds','freefire',10000,'Delivered to your Player ID.'),
 ('TikTok 70 Coins','tiktok',2000,'Delivered to your TikTok account.'),('TikTok 350 Coins','tiktok',8000,'Delivered to your TikTok account.'),('TikTok 700 Coins','tiktok',15000,'Delivered to your TikTok account.')
) as v(name, slug, price, how) join public.categories c on c.slug=v.slug;

create policy "anyone upload receipts" on storage.objects for insert to anon, authenticated with check (bucket_id='receipts');
create policy "admin read receipts" on storage.objects for select to authenticated using (bucket_id='receipts' and public.has_role(auth.uid(),'admin'));
create policy "public read product images" on storage.objects for select using (bucket_id='product-images');
create policy "admin write product images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and public.has_role(auth.uid(),'admin'));
