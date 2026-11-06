import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';

type ClubCredentials = { userId: string; apiKey: string };

// Saved credentials (admin-entered, service-role-only table) win; env secrets are the fallback.
async function getClubCredentials(): Promise<ClubCredentials | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.from('clubkonnect_credentials').select('user_id,api_key').eq('id', 1).maybeSingle();
  if (data?.user_id && data?.api_key) return { userId: data.user_id, apiKey: data.api_key };
  const userId = process.env['CLUBKONNECT_USERID'];
  const apiKey = process.env['CLUBKONNECT_APIKEY'];
  return userId && apiKey ? { userId, apiKey } : null;
}

async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: admin, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || !admin) throw new Error('Admins only');
}

export const saveClubCredentials = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().trim().min(3).max(100), apiKey: z.string().trim().min(8).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('clubkonnect_credentials').upsert({ id: 1, user_id: data.userId, api_key: data.apiKey, updated_at: new Date().toISOString() });
    if (error) throw new Error('Could not save credentials');
    return { saved: true };
  });

export const testClubConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const creds = await getClubCredentials();
  if (!creds) return { configured: false, balance: null, plans: [], message: 'ClubKonnect credentials are not configured' };
  const { clubRequest, clubPlans } = await import('./clubkonnect.server');
  const result = await clubRequest('/APIWalletBalanceV1.asp', creds);
  const rawBalance = result['balance'] ?? result['Balance'] ?? result['BALANCE'] ?? result['wallet_balance'];
  const balance = rawBalance != null && /^\d+(\.\d+)?$/.test(String(rawBalance)) ? Number(rawBalance) : null;
  if (balance == null) return { configured: true, balance: null, plans: [], message: `Connected, but balance not readable. Provider status: ${String(result['status'] ?? 'none')}` };
  const plans = await clubPlans(creds);
  return { configured: true, balance, plans, message: 'Connection verified' };
});

export const deliverClubOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orderId: z.string().uuid(), reconcile: z.boolean().default(false) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const creds = await getClubCredentials();
    if (!creds) throw new Error('ClubKonnect credentials are missing');
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
      const result = await clubRequest(data.reconcile ? '/APIQueryV1.asp' : '/APIDatabundleV1.asp', creds, params);
      state = clubState(result);
      const rawId = String(result['orderid'] ?? result['orderId'] ?? '');
      if (/^\d{1,30}$/.test(rawId)) providerId = rawId;
      event = sanitizedClubEvent(result, data.reconcile ? 'query' : 'submit');
    } catch { /* Unknown is deliberate: a timeout may occur after the provider accepts payment. */ }
    const { error } = await supabaseAdmin.rpc('finish_clubkonnect_order', { _order_id: data['orderId'], _request_id: requestId, _provider_id: providerId, _state: state, _event: event });
    if (error) throw new Error('Delivery result could not be saved. Check delivery before any further action.');
    return { state };
  });
