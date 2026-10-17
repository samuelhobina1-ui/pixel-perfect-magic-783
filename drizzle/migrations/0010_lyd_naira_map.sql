CREATE TABLE public.lyd_naira_map (lyd_amount integer PRIMARY KEY, naira_amount numeric NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lyd_naira_map TO authenticated;
GRANT ALL ON public.lyd_naira_map TO service_role;
ALTER TABLE public.lyd_naira_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin lyd map" ON public.lyd_naira_map FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.lyd_naira_map VALUES (5,900),(10,1800),(15,2700),(20,3600),(30,5400) ON CONFLICT DO NOTHING;

ALTER TABLE public.orders ADD COLUMN order_lyd_amount integer, ADD COLUMN order_naira_amount numeric;
ALTER TABLE public.settings ADD COLUMN last_gmail_poll_at timestamptz, ADD COLUMN last_gmail_found integer NOT NULL DEFAULT 0, ADD COLUMN last_gmail_note text;

CREATE OR REPLACE FUNCTION public.orders_fill_amounts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.order_lyd_amount is null and new.product_name ~* '(libyana|almadar|libya)' then
    new.order_lyd_amount := nullif(substring(new.product_name from '(\d+)\s*(?:LYD|dinar|dinner)?'), '')::int;
  end if;
  if new.order_naira_amount is null then new.order_naira_amount := new.price; end if;
  return new;
end $$;
CREATE TRIGGER orders_fill_amounts BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_fill_amounts();
UPDATE public.orders SET order_naira_amount = price,
  order_lyd_amount = CASE WHEN product_name ~* '(libyana|almadar|libya)' THEN substring(product_name from '(\d+)')::int END;

CREATE OR REPLACE FUNCTION public.ingest_bank_alert(_ref text, _amount numeric, _sender text, _message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare o record; ft text; pin record; lid uuid;
begin
  if _ref is null or _amount is null or _amount <= 0 then return jsonb_build_object('success', false, 'error', 'missing amount'); end if;
  insert into opay_sms_log(txn_id, amount, sender_name, raw_full_sms, source) values (_ref, _amount, _sender, left(coalesce(_message,''),2000), 'moniepoint')
    on conflict (txn_id) do nothing returning id into lid;
  if lid is null then
    select id into lid from opay_sms_log where txn_id=_ref and not is_processed;
    if lid is null then return jsonb_build_object('success', true, 'duplicate', true); end if;
  end if;
  select * into o from orders
    where status='pending' and verified_txn_id is null and created_at > now() - interval '48 hours'
      and round(coalesce(order_naira_amount, price)*100) = round(_amount*100)
    order by created_at, id limit 1 for update skip locked;
  if not found then return jsonb_build_object('success', true, 'matched', false); end if;
  select fulfillment_type into ft from products where id=o.product_id;
  if coalesce(ft,'manual')='auto_pin' then
    select * into pin from pins_stock where product_id=o.product_id and not is_used order by created_at limit 1 for update skip locked;
    if found then
      update pins_stock set is_used=true, used_at=now(), order_id=o.id where id=pin.id;
      update orders set status='auto_approved', pin_delivered=pin.pin_code, delivery_mode='gmail_auto', delivered_at=now(), verified_txn_id=_ref, verified_amount=_amount where id=o.id;
    else
      update orders set status='paid_waiting_manual', verified_txn_id=_ref, verified_amount=_amount where id=o.id;
    end if;
  else
    update orders set status='paid_waiting_manual', verified_txn_id=_ref, verified_amount=_amount where id=o.id;
  end if;
  update opay_sms_log set is_processed=true where id=lid;
  insert into used_transaction_ids(txn_id, order_id, customer_whatsapp) values (_ref, o.id, o.customer_whatsapp) on conflict do nothing;
  return jsonb_build_object('success', true, 'matched', true, 'order', o.order_code);
end $$;
REVOKE EXECUTE ON FUNCTION public.ingest_bank_alert(text, numeric, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_bank_alert(text, numeric, text, text) TO service_role;