import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { settingsQuery, slugify, uploadProductImage, type Settings } from "@/lib/store";
import { useAdminData } from "./admin.products";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const { cats } = useAdminData();
  const [s, setS] = useState<Settings | null>(null);
  const [cat, setCat] = useState({ name: "", image_url: "" });
  useEffect(() => { if (data) setS(data); }, [data]);
  const refresh = () => ["settings", "admin-cats", "categories"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function save() {
    if (!s) return;
    const { error } = await supabase.from("settings").update(s).eq("id", 1);
    if (error) return toast.error(error.message); toast.success("Settings saved"); refresh();
  }
  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("categories").insert({ name: cat.name.trim(), slug: slugify(cat.name), image_url: cat.image_url || null });
    if (error) return toast.error(error.message); toast.success(`Page /${slugify(cat.name)} created`); setCat({ name: "", image_url: "" }); refresh();
  }
  async function updateCat(id: string, patch: { name?: string; status?: string }) {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) return toast.error(error.message); refresh();
  }
  async function delCat(id: string) {
    if (!confirm("Delete this category? Only works if it has no products.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error("Move or delete its products first"); refresh();
  }
  if (!s) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card-glow space-y-4 p-5">
        <h2 className="text-lg font-bold">Delivery & payment</h2>
        <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
          <div><p className="font-semibold">{s.auto_mode ? "Auto delivery ON" : "Manual delivery"}</p>
            <p className="text-xs text-muted-foreground">Auto sends a PIN instantly when the transaction ID & receipt are new and stock exists.</p></div>
          <Switch checked={s.auto_mode} onCheckedChange={(v) => setS({ ...s, auto_mode: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>OPay number</Label><Input value={s.opay_number} onChange={(e) => setS({ ...s, opay_number: e.target.value })} /></div>
          <div><Label>OPay name</Label><Input value={s.opay_name} onChange={(e) => setS({ ...s, opay_name: e.target.value })} /></div>
          <div><Label>Support WhatsApp</Label><Input value={s.whatsapp_number} onChange={(e) => setS({ ...s, whatsapp_number: e.target.value })} /></div>
          <div><Label>Low stock alert at</Label><Input type="number" value={s.low_stock_threshold} onChange={(e) => setS({ ...s, low_stock_threshold: Number(e.target.value) })} /></div>
        </div>
        <div><Label>WhatsApp message template</Label><Textarea rows={6} value={s.whatsapp_template} onChange={(e) => setS({ ...s, whatsapp_template: e.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">Use {"{order}"}, {"{product}"}, {"{pin}"}</p></div>
        <Button onClick={save}>Save settings</Button>
      </div>
      <div className="card-glow space-y-4 p-5">
        <h2 className="text-lg font-bold">Categories</h2>
        <form onSubmit={addCat} className="space-y-2">
          <Input required placeholder="New category e.g. Zain" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="Banner image URL (optional)" value={cat.image_url} onChange={(e) => setCat({ ...cat, image_url: e.target.value })} />
            <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-sm">Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { setCat((c) => ({ ...c, image_url: "" })); const url = await uploadProductImage(f); setCat((c) => ({ ...c, image_url: url })); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
            }} /></label>
          </div>
          <Button type="submit">Add new category</Button>
        </form>
        <ul className="divide-y divide-border">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && updateCat(c.id, { name: e.target.value })} />
              <span className="text-xs text-muted-foreground">/{c.slug}</span>
              <Switch checked={c.status === "active"} onCheckedChange={(v) => updateCat(c.id, { status: v ? "active" : "inactive" })} />
              <Button size="sm" variant="destructive" onClick={() => delCat(c.id)}>✕</Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
