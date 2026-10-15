CREATE OR REPLACE FUNCTION public.ingest_bank_alert(_ref text, _amount numeric, _sender text, _message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare n int; o record; ft text; pin record; lid uuid;
begin
  if _ref is null or _amount is null or _amount <= 0 then return jsonb_build_object('success', false, 'error', 'missing amount'); end if;
  insert into opay_sms_log(txn_id, amount, sender_name, raw_full_sms, source) values (_ref, _amount, _sender, left(coalesce(_message,''),2000), 'moniepoint')
    on conflict (txn_id) do nothing returning id into lid;
  if lid is null then return jsonb_build_object('success', true, 'duplicate', true); end if;
  -- match pending orders from the last 6h within NGN 10; only auto-confirm when exactly one fits
  select count(*) into n from orders where status='pending' and created_at > now() - interval '6 hours' and abs(price - _amount) <= 10;
  if n <> 1 then return jsonb_build_object('success', true, 'matched', false, 'candidates', n); end if;
  select * into o from orders where status='pending' and created_at > now() - interval '6 hours' and abs(price - _amount) <= 10 for update;
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
REVOKE ALL ON FUNCTION public.ingest_bank_alert(text, numeric, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_bank_alert(text, numeric, text, text) TO service_role;