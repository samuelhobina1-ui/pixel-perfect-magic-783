CREATE TABLE public.order_review_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, tracking_id text NOT NULL, action text NOT NULL, reason text NOT NULL, admin_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.order_review_history TO authenticated;
GRANT ALL ON public.order_review_history TO service_role;
ALTER TABLE public.order_review_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin review history read" ON public.order_review_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
ALTER TABLE public.orders ADD COLUMN refund_status text, ADD COLUMN deleted_at timestamptz;
CREATE OR REPLACE FUNCTION public.admin_review_order(_order_id uuid, _action text, _reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; p public.pins_stock%ROWTYPE; ft text;
BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
IF _action NOT IN ('approve','reject_refund','delete_test') THEN RAISE EXCEPTION 'Invalid review action'; END IF;
IF length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'A review reason is required'; END IF;
SELECT * INTO o FROM public.orders WHERE id=_order_id AND deleted_at IS NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
IF o.status IN ('approved','auto_approved') OR o.pin_delivered IS NOT NULL THEN RAISE EXCEPTION 'Delivered orders cannot be changed here'; END IF;
IF _action='approve' THEN
 SELECT fulfillment_type INTO ft FROM public.products WHERE id=o.product_id;
 IF ft='auto_pin' THEN
  SELECT * INTO p FROM public.pins_stock WHERE product_id=o.product_id AND NOT is_used ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'No PINs in stock; restock before approving'; END IF;
  UPDATE public.pins_stock SET is_used=true,used_at=now(),order_id=o.id WHERE id=p.id;
  UPDATE public.orders SET status='approved',pin_delivered=p.pin_code,delivery_mode='manual_override',delivered_at=now() WHERE id=o.id;
 ELSE
  UPDATE public.orders SET status='paid_waiting_manual',delivery_mode='manual_override' WHERE id=o.id;
 END IF;
ELSIF _action='reject_refund' THEN
 UPDATE public.orders SET status='rejected',reject_reason=trim(_reason),refund_status='pending_manual' WHERE id=o.id;
ELSE
 IF o.status NOT IN ('rejected','needs_manual_review','manual_review','pending') OR o.verified_txn_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.used_transaction_ids WHERE order_id=o.id) OR EXISTS(SELECT 1 FROM public.pins_stock WHERE order_id=o.id AND is_used) THEN RAISE EXCEPTION 'Only unpaid, undelivered test orders may be removed'; END IF;
 UPDATE public.orders SET deleted_at=now(),status='rejected',reject_reason='Test order removed: '||trim(_reason) WHERE id=o.id;
END IF;
INSERT INTO public.order_review_history(order_id,tracking_id,action,reason,admin_user_id) VALUES(o.id,coalesce(o.tracking_id,o.order_code),_action,trim(_reason),auth.uid());
RETURN jsonb_build_object('action',_action,'pin',CASE WHEN _action='approve' AND ft='auto_pin' THEN p.pin_code ELSE NULL END,'refund_status',CASE WHEN _action='reject_refund' THEN 'pending_manual' ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.admin_review_order(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_order(uuid,text,text) TO authenticated;
COMMENT ON COLUMN public.orders.deleted_at IS 'Admin test-order removal preserves order and payment history; removed orders are rejected to prevent automatic matching.';
COMMENT ON COLUMN public.orders.refund_status IS 'Refunds are performed manually outside Zentra; pending_manual does not mean money has been returned.';