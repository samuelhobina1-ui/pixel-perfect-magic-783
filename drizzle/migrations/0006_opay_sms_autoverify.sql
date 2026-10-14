ALTER TABLE public.products ADD COLUMN fulfillment_type text NOT NULL DEFAULT 'manual' CHECK (fulfillment_type IN ('auto_pin','manual'));
UPDATE public.products p SET fulfillment_type='auto_pin' FROM public.categories c WHERE c.id=p.category_id AND c.name IN ('Libyana','Almadar','LTT');
ALTER TABLE public.pins_stock ADD COLUMN order_id uuid;
ALTER TABLE public.orders ADD COLUMN verified_txn_id text, ADD COLUMN verified_amount numeric;
ALTER TABLE public.settings ADD COLUMN sms_webhook_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24),'hex');

CREATE TABLE public.opay_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  sender_name text,
  raw_full_sms text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  is_processed boolean NOT NULL DEFAULT false
);
GRANT SELECT, UPDATE, DELETE ON public.opay_sms_log TO authenticated;
GRANT ALL ON public.opay_sms_log TO service_role;
ALTER TABLE public.opay_sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin sms" ON public.opay_sms_log FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.used_transaction_ids (
  txn_id text PRIMARY KEY,
  order_id uuid,
  used_at timestamptz NOT NULL DEFAULT now(),
  customer_whatsapp text
);
GRANT SELECT ON public.used_transaction_ids TO authenticated;
GRANT ALL ON public.used_transaction_ids TO service_role;
ALTER TABLE public.used_transaction_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin used txn" ON public.used_transaction_ids FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.verify_order(_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o record; s record; ft text; pin record; t text;
begin
  select * into o from orders where id=_order_id and status='pending' for update;
  if not found then return; end if;
  t := lower(trim(o.transaction_id));
  if exists(select 1 from used_transaction_ids where lower(txn_id)=t) then
    update orders set status='rejected', reject_reason='FRAUD: transaction ID already used' where id=o.id; return;
  end if;
  select * into s from opay_sms_log where lower(txn_id)=t for update;
  if not found then return; end if;
  if s.amount <> o.price then
    update orders set status='rejected', reject_reason=format('Amount mismatch: Paid NGN %s but order is NGN %s', s.amount, o.price) where id=o.id;
    return;
  end if;
  select fulfillment_type into ft from products where id=o.product_id;
  if coalesce(ft,'manual')='auto_pin' then
    select * into pin from pins_stock where product_id=o.product_id and not is_used order by created_at limit 1 for update skip locked;
    if not found then return; end if; -- verified but no stock: stays pending for admin
    update pins_stock set is_used=true, used_at=now(), order_id=o.id where id=pin.id;
    update orders set status='auto_approved', pin_delivered=pin.pin_code, delivery_mode='sms_auto', delivered_at=now(), verified_txn_id=s.txn_id, verified_amount=s.amount where id=o.id;
  else
    update orders set status='paid_waiting_manual', verified_txn_id=s.txn_id, verified_amount=s.amount where id=o.id;
  end if;
  update opay_sms_log set is_processed=true where id=s.id;
  insert into used_transaction_ids(txn_id, order_id, customer_whatsapp) values (s.txn_id, o.id, o.customer_whatsapp) on conflict do nothing;
end $$;
REVOKE ALL ON FUNCTION public.verify_order(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ingest_opay_sms(_token text, _message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare amt numeric; txn text; sender text; oid uuid;
begin
  if _token is null or _token <> (select sms_webhook_token from settings where id=1) then raise exception 'unauthorized'; end if;
  if length(coalesce(_message,'')) > 2000 then raise exception 'too long'; end if;
  amt := replace((regexp_match(_message, 'NGN\s*([0-9,]+\.?\d*)'))[1], ',', '')::numeric;
  txn := (regexp_match(_message, 'TxnID[:\s]*([0-9]{10,20})', 'i'))[1];
  sender := trim((regexp_match(_message, 'from\s+([A-Za-z ]+)', 'i'))[1]);
  if amt is null or txn is null then return jsonb_build_object('success', false, 'error', 'Could not read amount or TxnID'); end if;
  insert into opay_sms_log(txn_id, amount, sender_name, raw_full_sms) values (txn, amt, sender, _message) on conflict (txn_id) do nothing;
  for oid in select id from orders where status='pending' and lower(trim(transaction_id))=lower(txn) order by created_at loop
    perform verify_order(oid);
  end loop;
  return jsonb_build_object('success', true, 'parsed', jsonb_build_object('txn_id', txn, 'amount', amt));
end $$;
REVOKE ALL ON FUNCTION public.ingest_opay_sms(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_opay_sms(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _player_id text, _whatsapp text, _receipt_url text, _receipt_hash text, _transaction_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare p record; cat text; code text; checks jsonb; oid uuid; r record;
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
  values (code, code, p.id, p.name, coalesce(cat,''), p.price_naira, p.cost_price, _player_id, _whatsapp, _receipt_url, _receipt_hash, trim(_transaction_id), 'pending', checks)
  returning id into oid;
  perform verify_order(oid);
  select status, pin_delivered, reject_reason into r from orders where id=oid;
  return jsonb_build_object('order_code', code, 'tracking_id', code, 'status', r.status, 'pin', r.pin_delivered, 'reject_reason', r.reject_reason);
end $function$;

CREATE OR REPLACE FUNCTION public.track_order(_code text, _whatsapp text)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select jsonb_build_object('order_code',order_code,'product_name',product_name,'price',price,'status',status,'pin',pin_delivered,'delivery_mode',delivery_mode,'created_at',created_at,'reject_reason',reject_reason,'verified_txn_id',verified_txn_id,'verified_amount',verified_amount)
  from orders where upper(order_code)=upper(trim(_code)) and regexp_replace(customer_whatsapp,'\D','','g') like '%' || right(regexp_replace(_whatsapp,'\D','','g'),8) limit 1
$function$;