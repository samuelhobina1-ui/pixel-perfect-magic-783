ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_id text UNIQUE;

CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _player_id text, _whatsapp text, _receipt_url text, _receipt_hash text, _transaction_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare p record; cat text; code text; checks jsonb;
begin
  if length(coalesce(_player_id,''))<3 or length(coalesce(_whatsapp,''))<6 or length(coalesce(_transaction_id,''))<4 or coalesce(_receipt_url,'')='' then raise exception 'Missing required fields'; end if;
  if _whatsapp !~ '^\+(218\d{9}|234\d{10})$' then raise exception 'Invalid WhatsApp number'; end if;
  select * into p from products where id=_product_id and status='active' and deleted_at is null;
  if not found then raise exception 'Product unavailable'; end if;
  select name into cat from categories where id=p.category_id;
  loop
    code := 'ZENTRA' || lpad((floor(random()*1000000))::int::text, 6, '0');
    exit when not exists(select 1 from orders where order_code=code or tracking_id=code);
  end loop;
  checks := jsonb_build_object(
    'unique_transaction', not exists(select 1 from orders where lower(transaction_id)=lower(_transaction_id)),
    'unique_receipt', _receipt_hash is null or not exists(select 1 from orders where receipt_hash=_receipt_hash),
    'in_stock', exists(select 1 from pins_stock where product_id=p.id and not is_used),
    'today', true);
  insert into orders(order_code, tracking_id, product_id, product_name, category, price, cost_price, player_id, customer_whatsapp, receipt_image_url, receipt_hash, transaction_id, status, auto_checks)
  values (code, code, p.id, p.name, coalesce(cat,''), p.price_naira, p.cost_price, _player_id, _whatsapp, _receipt_url, _receipt_hash, _transaction_id, 'pending', checks);
  return jsonb_build_object('order_code', code, 'tracking_id', code, 'status', 'pending', 'pin', null);
end $function$;

-- Status only (no PIN) by tracking ID; PIN still requires matching WhatsApp via track_order.
CREATE OR REPLACE FUNCTION public.get_order_by_tracking_id(_tracking_id text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if upper(trim(_tracking_id)) !~ '^ZENTRA\d{6}$' then raise exception 'Invalid tracking ID'; end if;
  return (select jsonb_build_object('order_code',order_code,'product_name',product_name,'price',price,'status',status,'created_at',created_at,'reject_reason',reject_reason)
    from orders where tracking_id=upper(trim(_tracking_id)) limit 1);
end $function$;

-- Orders by WhatsApp number, no PINs.
CREATE OR REPLACE FUNCTION public.get_orders_by_whatsapp(_whatsapp text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if _whatsapp !~ '^\+(218\d{9}|234\d{10})$' then raise exception 'Invalid WhatsApp number'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('order_code',order_code,'product_name',product_name,'price',price,'status',status,'created_at',created_at,'reject_reason',reject_reason) order by created_at desc)
    from (select * from orders where customer_whatsapp=_whatsapp order by created_at desc limit 20) o), '[]'::jsonb);
end $function$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_by_whatsapp(text) TO anon, authenticated;