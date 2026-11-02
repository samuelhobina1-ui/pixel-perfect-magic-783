import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/store";
import { useAdminData } from "./admin.products";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { parseBulkPins, stockLevel } from "@/lib/admin-stock";

export const Route = createFileRoute("/admin/stock")({ component: Stock, head: () => ({ meta: [{ title: "PIN inventory — Zentra Gaming Hub" }, { name: "description", content: "Zentra PIN inventory, stock levels and bulk restocking." }, { property: "og:title", content: "Zentra PIN inventory" }, { property: "og:description", content: "Manage PIN counts and restock products." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }) });

function Stock() {
  const { products } = useAdminData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = products.find((p) => p.id === selectedId);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Stock</h1>
      <div className="flex flex-wrap gap-4 text-sm"><span className="text-primary">Green: &gt;10</span><span className="text-warning">Yellow: 5–10</span><span className="text-destructive">Red: &lt;5</span></div>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground">{["Product", "Left", "Stock level", "Action"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
        {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
          const level = stockLevel(p.stock);
          const color = level === "low" ? "text-destructive" : level === "warning" ? "text-warning" : "text-primary";
          return <tr key={p.id} className="border-t border-border"><td className="p-3 font-semibold">{p.name.trim()}<p className="text-xs text-muted-foreground">{p.fulfillment_type === "auto_pin" ? "PIN delivery" : "Manual top-up"}</p></td><td className={`p-3 font-bold ${color}`}>{p.stock}</td><td className={`p-3 ${color}`}>{level === "low" ? "Low" : level === "warning" ? "Restock soon" : "Healthy"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelectedId(p.id)}>Add PINs</Button></td></tr>;
        })}
      </tbody></table></div>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Inventory — {selected?.name.trim()}</DialogTitle><DialogDescription>Stock and bulk PIN entry</DialogDescription></DialogHeader>{selected && <StockRow key={selected.id} p={selected} />}</DialogContent></Dialog>
    </div>
  );
}

function StockRow({ p }: { p: ReturnType<typeof useAdminData>["products"][number] }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(p.price_naira));
  const [cost, setCost] = useState(String(p.cost_price));
  const [pins, setPins] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPins, setShowPins] = useState<{ id: string; pin_code: string }[] | null>(null);
  const refresh = () => Promise.all(["admin-products", "products", "price-log", "admin-stock-low"].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  async function savePrice() {
    const { error } = await supabase.from("products").update({ price_naira: Number(price), cost_price: Number(cost) }).eq("id", p.id);
    if (error) { toast.error(error.message); return; } toast.success("Saved"); refresh();
  }
  async function addPins() {
    const list = parseBulkPins(pins); if (!list.length || busy) return;
    setBusy(true);
    try {
      const { data: existing, error: readError } = await supabase.from("pins_stock").select("pin_code").eq("product_id", p.id).in("pin_code", list);
      if (readError) throw readError;
      const seen = new Set((existing ?? []).map((pin) => pin.pin_code));
      const fresh = list.filter((pin) => !seen.has(pin));
      if (!fresh.length) { toast.error("These PINs already exist for this product."); return; }
      const { error } = await supabase.from("pins_stock").insert(fresh.map((pin_code) => ({ product_id: p.id, pin_code })));
      if (error) throw error;
      setPins(""); await refresh(); if (showPins) await loadPins();
      toast.success(`${fresh.length} PINs added${seen.size ? `; ${seen.size} existing PINs skipped` : ""}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add PINs"); }
    finally { setBusy(false); }
  }
  async function loadPins() {
    const { data, error } = await supabase.from("pins_stock").select("id,pin_code").eq("product_id", p.id).eq("is_used", false).order("created_at");
    if (error) { toast.error(error.message); return; }
    setShowPins(data ?? []);
  }
  async function delPin(id: string) {
    const { error } = await supabase.from("pins_stock").delete().eq("id", id).eq("is_used", false);
    if (error) { toast.error(error.message); return; } await loadPins(); await refresh();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{p.name}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs ${p.stock > 0 ? "bg-primary/15 text-primary" : "bg-destructive/20 text-destructive"}`}>{p.stock} in stock</span>
      </div>
      <div className="flex gap-2">
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price" />
        <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Cost" />
        <Button size="sm" onClick={savePrice}>Save</Button>
      </div>
      <p className="text-xs text-muted-foreground">Price {naira(Number(price))} · Cost {naira(Number(cost))} · Last change {new Date(p.updated_at).toLocaleString()}</p>
      <Textarea rows={8} aria-label="Bulk PINs" placeholder="Paste PINs, one per line" value={pins} onChange={(e) => setPins(e.target.value)} />
      <p className="text-sm text-muted-foreground">{parseBulkPins(pins).length} unique PINs ready to add</p>
      <div className="flex gap-2"><Button size="sm" disabled={busy || !parseBulkPins(pins).length} onClick={addPins}>{busy ? "Adding…" : "Add stock"}</Button><Button size="sm" variant="outline" onClick={() => (showPins ? setShowPins(null) : loadPins())}>{showPins ? "Hide" : "Manage"} PINs</Button></div>
      {showPins && (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {showPins.map((x) => <li key={x.id} className="flex justify-between font-mono"><span className="break-all">{x.pin_code}</span><Button size="sm" variant="ghost" onClick={() => delPin(x.id)}>Delete</Button></li>)}
          {!showPins.length && <li className="text-muted-foreground">No unused PINs.</li>}
        </ul>
      )}
    </div>
  );
}
