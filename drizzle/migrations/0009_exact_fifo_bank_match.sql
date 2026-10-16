ALTER TABLE public.settings ALTER COLUMN opay_number SET DEFAULT '5339964934';
ALTER TABLE public.settings ALTER COLUMN opay_name SET DEFAULT 'HOBINA KINGSLEY SAMUEL';
CREATE UNIQUE INDEX IF NOT EXISTS orders_verified_txn_uniq ON public.orders(verified_txn_id) WHERE verified_txn_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.ingest_bank_alert(_ref text, _amount numeric, _sender text, _message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare o record; ft text; pin record; lid uuid;
begin
  if _ref is null or _amount is null or _amount <= 0 then return jsonb_build_object('success', false, 'error', 'missing amount'); end if;
  insert into opay_sms_log(txn_id, amount, sender_name, raw_full_sms, source) values (_ref, _amount, _sender, left(coalesce(_message,''),2000), 'moniepoint')
    on conflict (txn_id) do nothing returning id into lid;
  if lid is null then return jsonb_build_object('success', true, 'duplicate', true); end if;
  -- exact amount only (in kobo), oldest pending order first; skip rows another worker holds
  select * into o from orders
    where status='pending' and verified_txn_id is null and created_at > now() - interval '48 hours'
      and round(price*100) = round(_amount*100)
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