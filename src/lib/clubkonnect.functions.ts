import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const testClubConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: admin, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || !admin) throw new Error('Admins only');
  const userId = process.env['CLUBKONNECT_USERID'];
  const apiKey = process.env['CLUBKONNECT_APIKEY'];
  if (!userId || !apiKey) return { configured: false, balance: null, plans: [], message: 'ClubKonnect credentials are not configured' };
  const { clubRequest, clubPlans } = await import('./clubkonnect.server');
  const result = await clubRequest('/APIBalance.asp', { userId, apiKey });
  const rawBalance = result['balance'] ?? result['Balance'] ?? result['BALANCE'];
  const balance = rawBalance != null && /^\d+(\.\d+)?$/.test(String(rawBalance)) ? Number(rawBalance) : null;
  if (balance == null) return { configured: true, balance: null, plans: [], message: 'Connection not verified. Check ClubKonnect credentials, wallet and API access.' };
  const plans = await clubPlans({ userId, apiKey });
  return { configured: true, balance, plans, message: 'Connection verified' };
});

export const deliverClubOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orderId: z.string().uuid(), reconcile: z.boolean().default(false) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleError || !admin) throw new Error('Admins only');
    const userId = process.env['CLUBKONNECT_USERID'];
    const apiKey = process.env['CLUBKONNECT_APIKEY'];
    if (!userId || !apiKey) throw new Error('ClubKonnect credentials are missing');
    const { clubRequest, sanitizedClubEvent } = await import('./clubkonnect.server');
    const { clubState } = await import('./clubkonnect');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let params: Record<string, string>;
    let requestId: string;
    if (data.reconcile) {
      const { data: order, error } = await context.supabase.from('orders').select('clubkonnect_request_id,clubkonnect_status').eq('id', data['orderId']).single();
      if (error || !order?.clubkonnect_request_id) throw new Error('No submitted delivery to check');
      if (order.clubkonnect_status === 'completed' || order.clubkonnect_status === 'failed') return { state: order.clubkonnect_status };
      requestId = order.clubkonnect_request_id;
      params = { RequestID: requestId };
    } else {
      const { data: claim, error } = await context.supabase.rpc('claim_clubkonnect_order', { _order_id: data['orderId'] });
      if (error) throw new Error(error.message);
      const value = claim as { claimed?: boolean; request_id?: string; network?: string; plan?: string; phone?: string };
      if (!value.claimed || !value.request_id || !value.network || !value.plan || !value.phone) throw new Error('Already submitted. Use Check delivery instead.');
      requestId = value.request_id;
      params = { MobileNetwork: value.network, DataPlan: value.plan, MobileNumber: value.phone, RequestID: requestId };
    }
    let state: 'pending' | 'completed' | 'failed' | 'unknown' = 'unknown';
    let providerId = '';
    let event: ReturnType<typeof sanitizedClubEvent> = { event: 'unconfirmed_response', time: new Date().toISOString(), state, code: null };
    try {
      const result = await clubRequest(data.reconcile ? '/APIQueryV1.asp' : '/APIDatabundleV1.asp', { userId, apiKey }, params);
      state = clubState(result);
      const rawId = String(result['orderid'] ?? result['orderId'] ?? '');
      if (/^\d{1,30}$/.test(rawId)) providerId = rawId;
      event = sanitizedClubEvent(result, data.reconcile ? 'query' : 'submit');
    } catch { /* Unknown is deliberate: a timeout may occur after the provider accepts payment. */ }
    const { error } = await supabaseAdmin.rpc('finish_clubkonnect_order', { _order_id: data['orderId'], _request_id: requestId, _provider_id: providerId, _state: state, _event: event });
    if (error) throw new Error('Delivery result could not be saved. Check delivery before any further action.');
    return { state };
  });