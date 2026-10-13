create or replace function public.handle_admin_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(new.email) = 'samuelhobina1@gmail.com' and new.email_confirmed_at is not null then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed_admin on auth.users;
create trigger on_auth_user_confirmed_admin after update of email_confirmed_at on auth.users for each row execute function public.handle_admin_signup();
delete from public.user_roles r using auth.users u where r.user_id=u.id and r.role='admin' and u.email_confirmed_at is null;

CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _player_id text, _whatsapp text, _receipt_url text, _receipt_hash text, _transaction_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare p record; cat text; code text; checks jsonb;
begin
  if length(coalesce(_player_id,''))<3 or length(coalesce(_whatsapp,''))<6 or length(coalesce(_transaction_id,''))<4 or coalesce(_receipt_url,'')='' then raise exception 'Missing required fields'; end if;
  select * into p from products where id=_product_id and status='active' and deleted_at is null;
  if not found then raise exception 'Product unavailable'; end if;
  select name into cat from categories where id=p.category_id;
  code := 'ZGH-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8));
  checks := jsonb_build_object(
    'unique_transaction', not exists(select 1 from orders where lower(transaction_id)=lower(_transaction_id)),
    'unique_receipt', _receipt_hash is null or not exists(select 1 from orders where receipt_hash=_receipt_hash),
    'in_stock', exists(select 1 from pins_stock where product_id=p.id and not is_used),
    'today', true);
  insert into orders(order_code, product_id, product_name, category, price, cost_price, player_id, customer_whatsapp, receipt_image_url, receipt_hash, transaction_id, status, auto_checks)
  values (code, p.id, p.name, coalesce(cat,''), p.price_naira, p.cost_price, _player_id, _whatsapp, _receipt_url, _receipt_hash, _transaction_id, 'pending', checks);
  return jsonb_build_object('order_code', code, 'status', 'pending', 'pin', null, 'checks', checks);
end $function$;