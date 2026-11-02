import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { naira } from "@/lib/store";
import { reviewReasons } from "@/lib/admin-stock";

type Order = Tables<"orders">;
export function OrderReview({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const evidence = useQuery({
    queryKey: ["review-evidence", selected?.id], enabled: !!selected,
    queryFn: async () => {
      if (!selected) return { alerts: [], history: [] };
      // Only linked or exact reference matches are evidence, never same-amount guesses.
      const refs = [selected.transaction_id, selected.verified_txn_id].filter((ref): ref is string => !!ref);
      const [{ data: alerts, error }, { data: history, error: historyError }] = await Promise.all([
        supabase.from("opay_sms_log").select("*").in("txn_id", refs),
        supabase.from("order_review_history").select("*").eq("order_id", selected.id).order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (historyError) throw historyError;
      return { alerts: alerts ?? [], history: history ?? [] };
    },
  });
  async function act(action: "approve" | "reject_refund" | "delete_test") {
    if (!selected || reason.trim().length < 3) { toast.error("Enter a reason first."); return; }
    const warning = action === "approve" ? "Approve without a linked bank confirmation? This can deliver a PIN."
      : action === "reject_refund" ? "Reject this order and queue a MANUAL refund? No money will be sent automatically."
      : "Remove this unpaid test order from the order lists? Its history will be kept.";
    if (!confirm(warning)) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_review_order", { _order_id: selected.id, _action: action, _reason: reason.trim() });
      if (error) throw error;
      await Promise.all(["admin-orders", "admin-products", "admin-stock-low", "products", "review-evidence"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(action === "reject_refund" ? "Rejected — refund must be sent manually." : action === "delete_test" ? "Test order removed." : "Admin approval recorded.");
      setSelected(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Review failed"); }
    finally { setBusy(false); }
  }
  return <>
    <div className="overflow-x-auto rounded-lg border border-destructive/40">
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground">{["Order", "Product", "Amount", "Current status", "Reason", "Action"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{orders.map((order) => <tr key={order.id} className="border-t border-border">
          <td className="p-3 font-mono">{order.tracking_id ?? order.order_code}</td><td className="p-3">{order.product_name}</td>
          <td className="p-3 whitespace-nowrap">{naira(order.order_naira_amount ?? order.price)}</td>
          <td className="p-3">{order.status === "rejected" ? "Rejected" : "Needs review"}{order.refund_status && <p className="text-warning">Refund pending — manual</p>}</td>
          <td className="min-w-64 p-3"><ul className="space-y-1">{reviewReasons(order).map((text) => <li key={text}>{text}</li>)}</ul></td>
          <td className="p-3"><Button size="sm" variant="outline" onClick={() => { setSelected(order); setReason(""); }}>View Details</Button></td>
        </tr>)}</tbody></table>
      {!orders.length && <p className="p-6 text-center text-muted-foreground">No orders need review.</p>}
    </div>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Order details — {selected?.tracking_id ?? selected?.order_code}</DialogTitle><DialogDescription>Bank evidence and admin decision</DialogDescription></DialogHeader>
        {selected && <>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Order amount</dt><dd className="font-bold">{naira(selected.order_naira_amount ?? selected.price)}</dd></div>
            <div><dt className="text-muted-foreground">Linked bank amount</dt><dd>{selected.verified_amount == null ? "No linked bank alert" : naira(selected.verified_amount)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Customer TxnID</dt><dd className="break-all font-mono">{selected.transaction_id}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Bank message reference</dt><dd className="break-all font-mono">{selected.verified_txn_id ?? "Not linked"}</dd></div>
          </dl>
          <ul className="space-y-1 text-sm text-warning">{reviewReasons(selected).map((text) => <li key={text}>{text}</li>)}</ul>
          <h3 className="font-semibold">Moniepoint email</h3>
          {evidence.isPending && <p>Loading evidence…</p>}
          {evidence.error && <p role="alert" className="text-destructive">Could not load bank evidence: {evidence.error.message}</p>}
          {evidence.data?.alerts.map((alert) => <div key={alert.id} className="space-y-2 border-t border-border pt-3"><p className="text-sm">Bank amount: {naira(alert.amount)} · Source: {alert.source}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words bg-muted p-3 text-xs">{alert.raw_full_sms}</pre></div>)}
          {evidence.data && !evidence.data.alerts.length && <p className="text-sm text-muted-foreground">No stored bank email matches this order’s references. Other emails with the same amount are not proof for this order.</p>}
          <label className="text-sm font-semibold" htmlFor="review-reason">Admin reason *</label>
          <Textarea id="review-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you taking this action?" />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || reason.trim().length < 3} onClick={() => act("approve")}>Approve Anyway</Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => act("reject_refund")}>Reject & Refund</Button>
            <Button variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => act("delete_test")}>Delete Test Order</Button>
          </div>
          <p className="text-xs text-warning">Refunds must be paid manually. Test removal keeps the history and does not remove paid orders.</p>
          {!!evidence.data?.history.length && <section><h3 className="mb-2 font-semibold">Decision history</h3>{evidence.data.history.map((item) => <p key={item.id} className="border-t border-border py-2 text-xs">{new Date(item.created_at).toLocaleString()} · {item.action} · {item.reason}</p>)}</section>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}