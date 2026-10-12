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

export const Route = createFileRoute("/admin/stock")({ component: Stock });

function Stock() {
  const { cats, products } = useAdminData();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Stock</h1>
      {cats.map((c) => {
        const list = products.filter((p) => p.category_id === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id}>
            <h2 className="mb-3 text-lg font-bold text-primary">{c.name}</h2>
            <div className="grid gap-3 md:grid-cols-2">{list.map((p) => <StockRow key={p.id} p={p} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

function StockRow({ p }: { p: ReturnType<typeof useAdminData>["products"][number] }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(p.price_naira));
  const [cost, setCost] = useState(String(p.cost_price));
  const [pins, setPins] = useState("");
  const [showPins, setShowPins] = useState<{ id: string; pin_code: string }[] | null>(null);
  const refresh = () => ["admin-products", "products", "price-log"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function savePrice() {
    const { error } = await supabase.from("products").update({ price_naira: Number(price), cost_price: Number(cost) }).eq("id", p.id);
    if (error) { toast.error(error.message); return; } toast.success("Saved"); refresh();
  }
  async function addPins() {
    const list = pins.split("\n").map((s) => s.trim()).filter(Boolean); if (!list.length) return;
    const { error } = await supabase.from("pins_stock").insert(list.map((pin_code) => ({ product_id: p.id, pin_code })));
    if (error) { toast.error(error.message); return; } toast.success(`${list.length} PINs added`); setPins(""); refresh();
  }
  async function loadPins() {
    const { data } = await supabase.from("pins_stock").select("id,pin_code").eq("product_id", p.id).eq("is_used", false).order("created_at");
    setShowPins(data ?? []);
  }
  async function delPin(id: string) {
    await supabase.from("pins_stock").delete().eq("id", id); loadPins(); refresh();
  }
  return (
    <div className="card-glow space-y-2 p-4">
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
      <Textarea rows={2} placeholder="Paste PINs, one per line" value={pins} onChange={(e) => setPins(e.target.value)} />
      <div className="flex gap-2"><Button size="sm" onClick={addPins}>Add stock</Button><Button size="sm" variant="outline" onClick={() => (showPins ? setShowPins(null) : loadPins())}>{showPins ? "Hide" : "Manage"} PINs</Button></div>
      {showPins && (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {showPins.map((x) => <li key={x.id} className="flex justify-between font-mono"><span>{x.pin_code}</span><button className="text-destructive" onClick={() => delPin(x.id)}>delete</button></li>)}
          {!showPins.length && <li className="text-muted-foreground">No unused PINs.</li>}
        </ul>
      )}
    </div>
  );
}
