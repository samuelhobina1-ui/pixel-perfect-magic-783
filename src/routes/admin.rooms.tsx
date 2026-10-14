import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { naira, waLink } from "@/lib/store";

export const Route = createFileRoute("/admin/rooms")({ component: Rooms });

const TABS = ["TikTok", "CODM", "PUBG", "Free Fire"] as const;
const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

function Rooms() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("TikTok");
  const { data: orders = [] } = useQuery({
    queryKey: ["manual-orders"], refetchInterval: 15000,
    queryFn: async () => (await supabase.from("orders").select("*").eq("status", "paid_waiting_manual").order("created_at")).data ?? [],
  });
  const list = orders.filter((o) => o.category.toLowerCase() === tab.toLowerCase());

  async function done(o: (typeof orders)[number]) {
    const { error } = await supabase.from("orders").update({ status: "approved", delivery_mode: "manual", delivered_at: new Date().toISOString() }).eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    window.open(waLink(o.customer_whatsapp, `✅ Your ${o.product_name} top-up is complete! Check your account.\nOrder: ${o.order_code}\n— ZENTRA GAMING HUB`), "_blank");
    qc.invalidateQueries({ queryKey: ["manual-orders"] });
  }
  async function invalid(o: (typeof orders)[number]) {
    const reason = prompt("Why is it invalid?"); if (!reason) return;
    await supabase.from("orders").update({ status: "rejected", reject_reason: reason }).eq("id", o.id);
    qc.invalidateQueries({ queryKey: ["manual-orders"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Manual top-ups</h1>
      <div className="flex flex-wrap gap-2">{TABS.map((t) => {
        const n = orders.filter((o) => o.category.toLowerCase() === t.toLowerCase()).length;
        return <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t} ({n})</Button>;
      })}</div>
      {!list.length && <p className="p-6 text-center text-muted-foreground">Nothing waiting.</p>}
      <div className="grid gap-4 md:grid-cols-2">{list.map((o) => (
        <div key={o.id} className="overflow-hidden rounded-xl border-2 border-primary">
          <div className="bg-primary p-3 text-center font-display font-bold text-primary-foreground">✅ PAYMENT VERIFIED — SAFE TO TOP-UP</div>
          <div className="space-y-3 p-4">
            <p className="text-sm">{o.order_code} · {o.product_name} · {naira(o.verified_amount ?? o.price)} ✅ · TxnID {o.verified_txn_id} ✅</p>
            <Big label={tab === "TikTok" ? "USERNAME" : "PLAYER ID"} value={o.player_id} />
            <Big label="PACKAGE" value={o.product_name} />
            <Big label="CUSTOMER WHATSAPP" value={o.customer_whatsapp} />
            <div className="flex flex-wrap gap-2">
              {tab !== "TikTok" && <Button variant="outline" asChild><a href="https://www.codashop.com/en-ng/" target="_blank" rel="noreferrer">Open Codashop</a></Button>}
              <Button onClick={() => done(o)}>✅ Mark done & tell buyer</Button>
              <Button variant="destructive" onClick={() => invalid(o)}>❌ Invalid</Button>
            </div>
          </div>
        </div>))}</div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-3">
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono text-xl font-bold">{value}</p></div>
      <Button size="lg" onClick={() => copy(value)}>📋 Copy</Button>
    </div>
  );
}
