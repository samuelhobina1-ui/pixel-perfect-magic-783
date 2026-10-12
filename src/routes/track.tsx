import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/store";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your order — ZENTRA GAMING HUB" },
      { name: "description", content: "Check your ZENTRA order status and get your PIN." },
      { property: "og:title", content: "Track order — ZENTRA GAMING HUB" },
      { property: "og:description", content: "Enter your order ID to see status and PIN." },
    ],
  }),
  component: Track,
});

type T = { order_code: string; product_name: string; price: number; status: string; pin: string | null; delivery_mode: string | null; created_at: string; reject_reason: string | null };
const LABEL: Record<string, string> = { pending: "Pending verification", auto_approved: "Auto-Delivered", approved: "Delivered", rejected: "Rejected" };

function Track() {
  const [code, setCode] = useState("");
  const [wa, setWa] = useState("");
  const [res, setRes] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { data, error } = await supabase.rpc("track_order", { _code: code, _whatsapp: wa });
    setBusy(false);
    if (error || !data) { setRes(null); { toast.error("Order not found. Check the ID and WhatsApp number."); return; } }
    setRes(data as unknown as T);
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Track Order</h1>
      <form onSubmit={go} className="card-glow space-y-3 p-5">
        <Input required placeholder="Order ID e.g. ZGH-AB12CD34" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input required placeholder="WhatsApp number used for the order" value={wa} onChange={(e) => setWa(e.target.value)} />
        <Button className="w-full" disabled={busy}>{busy ? "Checking..." : "Track"}</Button>
      </form>
      {res && (
        <div className="card-glow mt-6 space-y-2 p-5">
          <p className="font-display text-xl text-accent">{res.order_code}</p>
          <p>{res.product_name} · <b className="text-primary">{naira(res.price)}</b></p>
          <p className={res.status === "rejected" ? "text-destructive" : res.status === "pending" ? "text-warning" : "text-primary"}>{LABEL[res.status] ?? res.status}</p>
          {res.reject_reason && <p className="text-sm text-muted-foreground">Reason: {res.reject_reason}</p>}
          {res.pin && <p className="rounded bg-secondary p-3 font-mono text-lg">PIN: {res.pin}</p>}
        </div>
      )}
    </main>
  );
}
