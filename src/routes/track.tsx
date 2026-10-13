import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/store";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "My Orders — ZENTRA GAMING HUB" },
      { name: "description", content: "Check your ZENTRA orders by tracking ID or WhatsApp number." },
      { property: "og:title", content: "My Orders — ZENTRA GAMING HUB" },
      { property: "og:description", content: "See your order status and PIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Track,
});

type T = { order_code: string; product_name: string; price: number; status: string; pin?: string | null; created_at: string; reject_reason: string | null };
type Local = { tracking_id: string; product: string; date: string; whatsapp?: string };
const LABEL: Record<string, string> = { pending: "Pending verification", auto_approved: "Auto-Delivered", approved: "Delivered", rejected: "Rejected" };

async function fetchOne(o: Local): Promise<T | null> {
  if (o.whatsapp) {
    const { data } = await supabase.rpc("track_order", { _code: o.tracking_id, _whatsapp: o.whatsapp });
    if (data) return data as unknown as T;
  }
  const { data } = await supabase.rpc("get_order_by_tracking_id", { _tracking_id: o.tracking_id });
  return (data as unknown as T) ?? null;
}

function OrderCard({ res }: { res: T }) {
  return (
    <div className="card-glow space-y-2 p-5">
      <p className="font-display text-xl text-accent">{res.order_code}</p>
      <p>{res.product_name} · <b className="text-primary">{naira(res.price)}</b></p>
      <p className="text-xs text-muted-foreground">{new Date(res.created_at).toLocaleString()}</p>
      <p className={res.status === "rejected" ? "text-destructive" : res.status === "pending" ? "text-warning" : "text-primary"}>{LABEL[res.status] ?? res.status}</p>
      {res.reject_reason && <p className="text-sm text-muted-foreground">Reason: {res.reject_reason}</p>}
      {res.pin && <p className="rounded bg-secondary p-3 font-mono text-lg">PIN: {res.pin}</p>}
    </div>
  );
}

function Track() {
  const [q, setQ] = useState("");
  const [mine, setMine] = useState<T[]>([]);
  const [found, setFound] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let list: Local[] = [];
    try { list = JSON.parse(localStorage.getItem("zentra_orders") ?? "[]"); } catch { /* ignore */ }
    Promise.all(list.map(fetchOne)).then((r) => setMine(r.filter(Boolean) as T[]));
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const v = q.trim();
    const res = /^zentra\d{6}$/i.test(v)
      ? await supabase.rpc("get_order_by_tracking_id", { _tracking_id: v })
      : await supabase.rpc("get_orders_by_whatsapp", { _whatsapp: "+" + v.replace(/\D/g, "") });
    setBusy(false);
    const d = res.data as unknown;
    const arr = (Array.isArray(d) ? d : d ? [d] : []) as T[];
    if (res.error || !arr.length) { setFound(null); toast.error("No orders found. Use ZENTRA123456 or a full number like +218912345678."); return; }
    setFound(arr);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">My Orders</h1>
      <form onSubmit={go} className="card-glow space-y-3 p-5">
        <Input required placeholder="Tracking ID (ZENTRA123456) or WhatsApp (+218...)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button className="w-full" disabled={busy}>{busy ? "Searching..." : "Search"}</Button>
      </form>
      {found && <div className="mt-6 space-y-3">{found.map((r) => <OrderCard key={r.order_code} res={r} />)}</div>}
      {mine.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Saved on this device</h2>
          {mine.map((r) => <OrderCard key={r.order_code} res={r} />)}
        </section>
      )}
    </main>
  );
}
