import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { naira, slugify, uploadProductImage } from "@/lib/store";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/products")({ component: Products });

type Product = Tables<"products"> & { stock: number };
type Cat = Tables<"categories">;

export function useAdminData() {
  const cats = useQuery({ queryKey: ["admin-cats"], queryFn: async () => (await supabase.from("categories").select("*").order("sort_order").order("name")).data ?? [] });
  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const [{ data, error }, { data: stock }] = await Promise.all([
        supabase.from("products").select("*").is("deleted_at", null).order("created_at"),
        supabase.from("product_stock").select("*"),
      ]);
      if (error) throw error;
      const m = new Map((stock ?? []).map((s) => [s.product_id, s.stock_count ?? 0]));
      return (data ?? []).map((p) => ({ ...p, stock: m.get(p.id) ?? 0 })) as Product[];
    },
  });
  return { cats: (cats.data ?? []) as Cat[], products: products.data ?? [] };
}

function Products() {
  const qc = useQueryClient();
  const { cats, products } = useAdminData();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [st, setSt] = useState("");
  const { data: log = [] } = useQuery({ queryKey: ["price-log"], queryFn: async () => (await supabase.from("price_change_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });
  const refresh = () => ["admin-products", "products", "price-log", "admin-cats", "categories"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "";

  const list = useMemo(() => products.filter((p) =>
    (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!cat || p.category_id === cat) && (!st || (st === "low" ? p.stock < 5 : p.status === st))
  ), [products, q, cat, st]);
  const lastAdded = products.reduce<Product | null>((a, p) => (!a || p.created_at > a.created_at ? p : a), null);
  const lastEdited = products.reduce<Product | null>((a, p) => (!a || p.updated_at > a.updated_at ? p : a), null);

  async function del(p: Product) {
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "pending");
    if (count) { toast.error("Cannot delete: has pending orders"); return; }
    if (!confirm(`Are you sure? Delete ${p.name}?`)) return;
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString(), status: "inactive" }).eq("id", p.id);
    if (error) { toast.error(error.message); return; } toast.success("Moved to trash"); refresh();
  }
  const ids = [...sel];
  async function bulk(action: "delete" | "active" | "inactive" | "price" | "stock") {
    if (!ids.length) { toast.error("Select products first"); return; }
    if (action === "delete") {
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).in("product_id", ids).eq("status", "pending");
      if (count) { toast.error("Some selected products have pending orders"); return; }
      if (!confirm(`Delete ${ids.length} products?`)) return;
      await supabase.from("products").update({ deleted_at: new Date().toISOString(), status: "inactive" }).in("id", ids);
    } else if (action === "active" || action === "inactive") {
      await supabase.from("products").update({ status: action }).in("id", ids);
    } else if (action === "price") {
      const pct = Number(prompt("Change price by % (e.g. 10 or -10)")); if (!pct) return;
      for (const p of products.filter((x) => sel.has(x.id))) {
        await supabase.from("products").update({ price_naira: Math.round(Number(p.price_naira) * (1 + pct / 100)) }).eq("id", p.id);
      }
    } else {
      const text = prompt("Paste PINs separated by spaces or commas — added to EACH selected product"); if (!text) return;
      const pins = text.split(/[\s,]+/).filter(Boolean);
      await supabase.from("pins_stock").insert(ids.flatMap((id) => pins.map((pin_code) => ({ product_id: id, pin_code }))));
    }
    toast.success("Done"); setSel(new Set()); refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products <span className="text-primary">({products.length})</span></h1>
          <p className="text-xs text-muted-foreground">Last added: {lastAdded?.name} · Last edited: {lastEdited?.name} {lastEdited && new Date(lastEdited.updated_at).toLocaleString()}</p>
        </div>
        <Button size="lg" onClick={() => setEditing({ status: "active", ...(cats[0] ? { category_id: cats[0].id } : {}) })}><Plus className="mr-1" />Add New Product</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-md border border-input bg-background px-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 text-sm" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="low">Low stock</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="self-center text-muted-foreground">{sel.size} selected:</span>
        <Button size="sm" variant="outline" onClick={() => bulk("price")}>Price ±%</Button>
        <Button size="sm" variant="outline" onClick={() => bulk("stock")}>Add stock</Button>
        <Button size="sm" variant="outline" onClick={() => bulk("active")}>Activate</Button>
        <Button size="sm" variant="outline" onClick={() => bulk("inactive")}>Deactivate</Button>
        <Button size="sm" variant="destructive" onClick={() => bulk("delete")}>Delete</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground">
            <th className="p-2"><Checkbox checked={list.length > 0 && list.every((p) => sel.has(p.id))} onCheckedChange={(v) => setSel(v ? new Set(list.map((p) => p.id)) : new Set())} /></th>
            {["Image", "Name", "Category", "Price ₦", "Cost ₦", "Stock", "Status", "Actions"].map((h) => <th key={h} className="p-2">{h}</th>)}
          </tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="p-2"><Checkbox checked={sel.has(p.id)} onCheckedChange={(v) => { const n = new Set(sel); v ? n.add(p.id) : n.delete(p.id); setSel(n); }} /></td>
              <td className="p-2">{p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" /> : <Gamepad2 className="h-6 w-6 text-primary/60" />}</td>
              <td className="p-2 font-medium">{p.name}</td>
              <td className="p-2">{catName(p.category_id)}</td>
              <td className="p-2 font-bold text-primary">{naira(p.price_naira)}</td>
              <td className="p-2 text-muted-foreground">{naira(p.cost_price)}</td>
              <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs ${p.stock > 0 ? "bg-primary/15 text-primary" : "bg-destructive/20 text-destructive"}`}>{p.stock}</span></td>
              <td className="p-2">{p.status === "active" ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td>
              <td className="space-x-1 whitespace-nowrap p-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="destructive" onClick={() => del(p)}><Trash2 className="h-3 w-3" /></Button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Price change log</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["Product", "Old", "New", "Changed by", "Time"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
            <tbody>{log.map((l) => (
              <tr key={l.id} className="border-t border-border"><td className="p-2">{l.product_name}</td><td className="p-2">{naira(Number(l.old_price))}</td><td className="p-2 text-primary">{naira(Number(l.new_price))}</td><td className="p-2">{l.changed_by}</td><td className="p-2">{new Date(l.created_at).toLocaleString()}</td></tr>
            ))}</tbody></table>
        </div>
      </section>
      <ProductForm value={editing} cats={cats} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  );
}

function ProductForm({ value, cats, onClose, onSaved }: { value: Partial<Product> | null; cats: Cat[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Product>>({});
  const [pins, setPins] = useState("");
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<unknown>(null);
  if (value !== key) { setKey(value); setF(value ?? {}); setPins(""); setNewCat(""); }
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      let category_id = f.category_id;
      if (category_id === "__new") {
        if (!newCat.trim()) throw new Error("Enter category name");
        const { data, error } = await supabase.from("categories").insert({ name: newCat.trim(), slug: slugify(newCat) }).select().single();
        if (error) throw error; category_id = data.id;
      }
      const row = { name: f.name!, category_id: category_id!, price_naira: Number(f.price_naira), cost_price: Number(f.cost_price ?? 0), image_url: f.image_url || null, description: f.description || null, how_to_use: f.how_to_use || null, status: f.status ?? "active" };
      let id = f.id;
      if (id) { const { error } = await supabase.from("products").update(row).eq("id", id); if (error) throw error; }
      else { const { data, error } = await supabase.from("products").insert(row).select().single(); if (error) throw error; id = data.id; }
      const list = pins.split("\n").map((s) => s.trim()).filter(Boolean);
      if (list.length) { const { error } = await supabase.from("pins_stock").insert(list.map((pin_code) => ({ product_id: id!, pin_code }))); if (error) throw error; }
      toast.success("Saved — live on the website"); onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader><DialogTitle>{f.id ? "Edit product" : "Add new product"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Product name *</Label><Input required placeholder="e.g. Libyana 100" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Category *</Label>
            <select required className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new">+ Add new category</option>
            </select>
            {f.category_id === "__new" && <Input className="mt-2" placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Price ₦ *</Label><Input required type="number" min={0} value={f.price_naira ?? ""} onChange={(e) => set("price_naira", e.target.value as unknown as number)} /></div>
            <div><Label>Cost price ₦ (private)</Label><Input type="number" min={0} value={f.cost_price ?? ""} onChange={(e) => set("cost_price", e.target.value as unknown as number)} /></div>
          </div>
          <div><Label>Add stock PINs (one per line)</Label><Textarea rows={3} value={pins} onChange={(e) => setPins(e.target.value)} /></div>
          <div><Label>Image</Label>
            <div className="flex gap-2"><Input placeholder="Image URL" value={f.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} />
              <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm">Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try { set("image_url", await uploadProductImage(file)); toast.success("Image uploaded"); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
              }} /></label></div>
            {f.image_url && <img src={f.image_url} alt="" className="mt-2 h-20 rounded" />}
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div><Label>How to use</Label><Textarea rows={2} value={f.how_to_use ?? ""} onChange={(e) => set("how_to_use", e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={(f.status ?? "active") === "active"} onCheckedChange={(v) => set("status", v ? "active" : "inactive")} /><span className="text-sm">{(f.status ?? "active") === "active" ? "Active" : "Inactive"}</span></div>
          <Button className="w-full" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
