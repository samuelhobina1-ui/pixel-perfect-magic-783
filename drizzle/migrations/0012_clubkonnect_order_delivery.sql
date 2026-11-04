ALTER TABLE public.products ADD COLUMN clubkonnect_network text, ADD COLUMN clubkonnect_plan_code text, ADD COLUMN clubkonnect_plan_name text;
ALTER TABLE public.products ADD CONSTRAINT clubkonnect_network_valid CHECK (clubkonnect_network IS NULL OR clubkonnect_network IN ('01','02','03','04'));
ALTER TABLE public.orders ADD COLUMN clubkonnect_request_id text, ADD COLUMN clubkonnect_order_id text, ADD COLUMN clubkonnect_status text, ADD COLUMN clubkonnect_log jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN clubkonnect_network text, ADD COLUMN clubkonnect_plan_code text;
CREATE UNIQUE INDEX clubkonnect_request_unique ON public.orders(clubkonnect_request_id) WHERE clubkonnect_request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.claim_clubkonnect_order(_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; p public.products%ROWTYPE;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.clubkonnect_request_id IS NOT NULL THEN RETURN jsonb_build_object('claimed',false,'request_id',o.clubkonnect_request_id); END IF;
 IF o.status <> 'paid_waiting_manual' OR o.delivery_mode='manual_override' OR o.verified_txn_id IS NULL OR o.verified_amount IS NULL OR round(o.verified_amount*100) <> round(coalesce(o.order_naira_amount,o.price)*100) OR NOT EXISTS(SELECT 1 FROM public.used_transaction_ids u WHERE u.order_id=o.id AND u.txn_id=o.verified_txn_id) THEN RAISE EXCEPTION 'Bank-confirmed payment is required'; END IF;
 SELECT * INTO p FROM public.products WHERE id=o.product_id;
 IF p.fulfillment_type <> 'manual' OR p.clubkonnect_network IS NULL OR coalesce(p.clubkonnect_plan_code,'')='' THEN RAISE EXCEPTION 'Select a data plan for this product first'; END IF;
 IF o.player_id !~ '^0[789][0-9]{9}$' THEN RAISE EXCEPTION 'A valid 11-digit Nigerian mobile number is required'; END IF;
 UPDATE public.orders SET clubkonnect_request_id='ZENTRA-'||o.id::text,clubkonnect_status='submitting',clubkonnect_network=p.clubkonnect_network,clubkonnect_plan_code=p.clubkonnect_plan_code,clubkonnect_log=clubkonnect_log||jsonb_build_array(jsonb_build_object('event','admin_reviewed_submission','time',now(),'admin',auth.uid())) WHERE id=o.id;
 RETURN jsonb_build_object('claimed',true,'request_id','ZENTRA-'||o.id::text,'network',p.clubkonnect_network,'plan',p.clubkonnect_plan_code,'phone',o.player_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_clubkonnect_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_clubkonnect_order(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.finish_clubkonnect_order(_order_id uuid,_request_id text,_provider_id text,_state text,_event jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _state NOT IN ('pending','unknown','completed','failed') THEN RAISE EXCEPTION 'Invalid delivery state'; END IF;
 UPDATE public.orders SET clubkonnect_order_id=coalesce(nullif(_provider_id,''),clubkonnect_order_id),clubkonnect_status=_state,clubkonnect_log=clubkonnect_log||jsonb_build_array(_event),status=CASE WHEN _state='completed' THEN 'approved' WHEN _state='failed' THEN 'rejected' ELSE status END,delivery_mode=CASE WHEN _state='completed' THEN 'clubkonnect' ELSE delivery_mode END,delivered_at=CASE WHEN _state='completed' THEN now() ELSE delivered_at END,refund_status=CASE WHEN _state='failed' THEN 'pending_manual' ELSE refund_status END,reject_reason=CASE WHEN _state='failed' THEN 'ClubKonnect delivery failed; refund pending manual processing' ELSE reject_reason END WHERE id=_order_id AND clubkonnect_request_id=_request_id AND coalesce(clubkonnect_status,'') NOT IN ('completed','failed');
END $$;
REVOKE ALL ON FUNCTION public.finish_clubkonnect_order(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_clubkonnect_order(uuid,text,text,text,jsonb) TO service_role;
COMMENT ON COLUMN public.orders.clubkonnect_log IS 'Sanitized provider status events only, never credentials or request URLs. Unknown deliveries are reconciled, never retried or refunded automatically.';