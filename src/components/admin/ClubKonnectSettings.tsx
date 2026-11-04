import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { testClubConnection, deliverClubOrder } from '@/lib/clubkonnect.functions';
import { naira } from '@/lib/store';

export function ClubKonnectSettings() {
  const test = useServerFn(testClubConnection);
  const deliver = useServerFn(deliverClubOrder);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const { data: orders = [] } = useQuery({ queryKey: ['club-orders'], queryFn: async () => {
    const { data, error } = await supabase.from('orders').select('id,order_code,product_name,player_id,status,clubkonnect_status,clubkonnect_request_id,clubkonnect_order_id,clubkonnect_log,refund_status').is('deleted_at', null).or('status.eq.paid_waiting_manual,clubkonnect_request_id.not.is.null').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  } });
  async function check() {
    setBusy(true);
    try { const result = await test(); setMessage(result.message); setBalance(result.balance); qc.setQueryData(['club-plans'], result.plans); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Connection check failed'); }
    finally { setBusy(false); }
  }
  async function send(id: string, reconcile: boolean, phone: string) {
    if (!reconcile && !confirm(`Confirm you reviewed bank payment, data plan and recipient ${phone}. Send data now? This spends your ClubKonnect wallet balance.`)) return;
    setBusy(true);
    try {
      const result = await deliver({ data: { orderId: id, reconcile } });
      toast[result.state === 'failed' ? 'error' : 'success'](result.state === 'completed' ? 'Data delivered' : result.state === 'failed' ? 'Delivery failed — refund pending manual processing' : 'Delivery not confirmed yet. Use Check delivery; do not resend.');
      await Promise.all(['club-orders', 'orders', 'admin-orders'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      setBalance(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Delivery failed'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-border pt-6 lg:col-span-2">
    <h2 className="text-lg font-bold">ClubKonnect</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor="club-user">ClubKonnect UserID</Label><Input id="club-user" readOnly value="Stored securely" /></div>
      <div><Label htmlFor="club-key">ClubKonnect API Key</Label><Input id="club-key" type="password" readOnly value="stored-securely" /></div>
    </div>
    <Button onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Test Connection'}</Button>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}{balance != null ? ` · Wallet balance: ${naira(balance)}` : ''}</p>}
    <p className="text-sm text-warning">Automatic data delivery is paused pending receipt safety checks. Admin approval required. Refunds are manual.</p>
    <h3 className="font-semibold">Data delivery & transaction history</h3>
    <div className="overflow-x-auto border border-border rounded-md"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground">{['Order','Product / Mobile','Delivery','Action'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>
      {orders.map((order) => <tr key={order.id} className="border-t border-border"><td className="p-3">{order.order_code}</td><td className="p-3">{order.product_name}<p className="text-muted-foreground">{order.player_id}</p></td><td className="p-3">{order.clubkonnect_status ?? 'Not submitted'}{order.refund_status === 'pending_manual' && <p className="text-destructive">Refund pending — manual</p>}{order.clubkonnect_request_id && <details className="mt-2"><summary className="cursor-pointer">Transaction history</summary><p className="break-all text-xs">Request: {order.clubkonnect_request_id} · Provider: {order.clubkonnect_order_id ?? 'Not confirmed'}</p><pre className="max-w-sm overflow-x-auto text-xs">{JSON.stringify(order.clubkonnect_log, null, 2)}</pre></details>}</td><td className="p-3">{!order.clubkonnect_request_id ? <Button size="sm" disabled={busy} onClick={() => send(order.id,false,order.player_id)}>Review & send data</Button> : !['completed','failed'].includes(order.clubkonnect_status ?? '') ? <Button size="sm" variant="outline" disabled={busy} onClick={() => send(order.id,true,order.player_id)}>Check delivery</Button> : '—'}</td></tr>)}
      {!orders.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No paid data orders or ClubKonnect transactions yet.</td></tr>}
    </tbody></table></div>
  </section>;
}