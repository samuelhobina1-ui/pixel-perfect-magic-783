import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Copy, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fillTemplate, naira, settingsQuery, waLink } from "@/lib/store";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

type Order = Tables<"orders">;

function Dashboard() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const { data: orders = [], refetch, isFetching } = useQuery({
    queryKey: ["admin-orders"], refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error; return data;
    },
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["admin-stock-low"],
    queryFn: async () => (await supabase.from("product_stock").select("*")).data ?? [],
  });
  const [q, setQ] = useState("");
  const filt = (o: Order) => !q || [o.order_code, o.product_name, o.customer_whatsapp, o.player_id, o.transaction_id, o.category].join(" ").toLowerCase().includes(q.toLowerCase());
  const pending = orders.filter((o) => o.status === "pending").filter(filt);
  const sold = orders.filter((o) => o.status === "approved" || o.status === "auto_approved").filter(filt);
  const rejected = orders.filter((o) => o.status === "rejected").filter(filt);
  const today = new Date().toDateString();
  const soldToday = sold.filter((o) => o.delivered_at && new Date(o.delivered_at).toDateString() === today);
  const profitToday = soldToday.reduce((s, o) => s + Number(o.price) - Number(o.cost_price), 0);
  const low = stock.filter((s) => (s.stock_count ?? 0) <= (settings?.low_stock_threshold ?? 5)).length;
  const reload = () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-stock-low"] }); };

  const sendWa = (o: Order, pin: string) => {
    if (!settings) return;
    window.open(waLink(o.customer_whatsapp, fillTemplate(settings.whatsapp_template, { order: o.order_code, product: o.product_name, pin })), "_blank");
  };
  async function approve(o: Order) {
    const { data, error } = await supabase.rpc("approve_order", { _order_id: o.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Approved"); sendWa(o, data as string); reload();
  }
  async function reject(o: Order) {
    const reason = prompt("Reason for rejection?"); if (reason === null) return;
    const { error } = await supabase.from("orders").update({ status: "rejected", reject_reason: reason }).eq("id", o.id);
    if (error) { toast.error(error.message); return; } toast.success("Rejected"); reload();
  }
  async function edit(o: Order, field: "customer_whatsapp" | "player_id") {
    const v = prompt(`New ${field === "player_id" ? "Player ID" : "WhatsApp"}`, o[field]); if (!v) return;
    const { error } = await supabase.from("orders").update(field === "player_id" ? { player_id: v } : { customer_whatsapp: v }).eq("id", o.id);
    if (error) { toast.error(error.message); return; } reload();
  }
  async function viewReceipt(o: Order) {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(o.receipt_image_url, 600);
    if (error) { toast.error(error.message); return; } window.open(data.signedUrl, "_blank");
  }
  function exportCsv() {
    const rows = [["Order ID", "Delivered", "Mode", "Product", "Category", "Price", "Profit", "WhatsApp", "PIN", "Player ID", "Transaction ID"],
      ...sold.map((o) => [o.order_code, o.delivered_at ?? "", o.delivery_mode ?? "", o.product_name, o.category, o.price, Number(o.price) - Number(o.cost_price), o.customer_whatsapp, o.pin_delivered ?? "", o.player_id, o.transaction_id])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `zgh-sales-${Date.now()}.csv`; a.click();
  }

  const th = "px-2 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap";
  const td = "px-2 py-2 text-sm whitespace-nowrap";
  const Checks = ({ c }: { c: unknown }) => {
    const obj = (c ?? {}) as Record<string, boolean>;
    return <div className="flex gap-1">{Object.entries(obj).map(([k, v]) => <span key={k} title={k} className={`h-2.5 w-2.5 rounded-full ${v ? "bg-primary" : "bg-destructive"}`} />)}</div>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Waiting approval", pending.length, "text-warning"], ["Sold today", soldToday.length, "text-primary"], ["Profit today", naira(profitToday), "text-accent"], ["Low stock", low, "text-destructive"]].map(([l, v, c]) => (
          <div key={l as string} className="card-glow p-4"><p className="text-xs text-muted-foreground">{l}</p><p className={`font-display text-2xl font-bold ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Search orders..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Waiting ({pending.length})</TabsTrigger>
          <TabsTrigger value="sold">Sold ({sold.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="overflow-x-auto rounded-lg border border-warning/40">
          <table className="w-full"><thead><tr>{["Order", "Date", "Product", "Price", "WhatsApp", "Player ID", "Receipt", "Txn ID", "Checks", "Action"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{pending.map((o) => {
              const old = Date.now() - new Date(o.created_at).getTime() > 3600_000;
              return (
                <tr key={o.id} className={`border-t border-border ${old ? "bg-destructive/10" : ""}`}>
                  <td className={`${td} font-mono text-warning`}>{o.order_code}</td>
                  <td className={td}>{new Date(o.created_at).toLocaleString()}</td>
                  <td className={td}>{o.product_name}<div className="text-xs text-muted-foreground">{o.category}</div></td>
                  <td className={`${td} font-bold text-primary`}>{naira(o.price)}</td>
                  <td className={td}><a className="text-primary underline" href={waLink(o.customer_whatsapp)} target="_blank" rel="noreferrer">{o.customer_whatsapp}</a> <button className="text-xs text-muted-foreground" onClick={() => edit(o, "customer_whatsapp")}>edit</button></td>
                  <td className={td}>{o.player_id} <button className="text-xs text-muted-foreground" onClick={() => edit(o, "player_id")}>edit</button></td>
                  <td className={td}><Button size="sm" variant="outline" onClick={() => viewReceipt(o)}>View</Button></td>
                  <td className={`${td} font-mono`}>{o.transaction_id}</td>
                  <td className={td}><Checks c={o.auto_checks} /></td>
                  <td className={`${td} space-x-1`}><Button size="sm" onClick={() => approve(o)}>Approve & send</Button><Button size="sm" variant="destructive" onClick={() => reject(o)}>Reject</Button></td>
                </tr>
              );
            })}</tbody></table>
          {!pending.length && <p className="p-6 text-center text-muted-foreground">No pending orders.</p>}
        </TabsContent>
        <TabsContent value="sold" className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Sales: <b className="text-primary">{naira(sold.reduce((s, o) => s + Number(o.price), 0))}</b> · Profit: <b className="text-accent">{naira(sold.reduce((s, o) => s + Number(o.price) - Number(o.cost_price), 0))}</b></span>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export Excel (CSV)</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-primary/40">
            <table className="w-full"><thead><tr>{["Order", "Delivered", "Mode", "Product", "Price", "Profit", "WhatsApp", "PIN", "Player ID", "Txn ID", "Action"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{sold.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className={`${td} font-mono text-primary`}>{o.order_code}</td>
                  <td className={td}>{o.delivered_at && new Date(o.delivered_at).toLocaleString()}</td>
                  <td className={td}>{o.delivery_mode === "auto" ? "Auto" : "Manual"}</td>
                  <td className={td}>{o.product_name}</td>
                  <td className={td}>{naira(o.price)}</td>
                  <td className={`${td} text-accent`}>{naira(Number(o.price) - Number(o.cost_price))}</td>
                  <td className={td}>{o.customer_whatsapp}</td>
                  <td className={`${td} font-mono`}>{o.pin_delivered}</td>
                  <td className={td}>{o.player_id}</td>
                  <td className={`${td} font-mono`}>{o.transaction_id}</td>
                  <td className={`${td} space-x-1`}>
                    <Button size="sm" onClick={() => sendWa(o, o.pin_delivered ?? "")}>Resend</Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(o.pin_delivered ?? ""); toast.success("PIN copied"); }}><Copy className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}</tbody></table>
          </div>
        </TabsContent>
        <TabsContent value="rejected" className="overflow-x-auto rounded-lg border border-destructive/40">
          <table className="w-full"><thead><tr>{["Order", "Date", "Product", "Price", "WhatsApp", "Reason"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rejected.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className={`${td} font-mono text-destructive`}>{o.order_code}</td>
                <td className={td}>{new Date(o.created_at).toLocaleString()}</td>
                <td className={td}>{o.product_name}</td><td className={td}>{naira(o.price)}</td>
                <td className={td}>{o.customer_whatsapp}</td><td className={td}>{o.reject_reason}</td>
              </tr>
            ))}</tbody></table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
