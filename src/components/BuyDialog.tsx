import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Upload, CheckCircle2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fillTemplate, naira, publicSettingsQuery, sha256File, waLink, type PublicProduct } from "@/lib/store";

type Result = { order_code: string; status: string; pin: string | null };

const CODES = { "218": { flag: "🇱🇾", len: 9, ph: "91xxxxxxx" }, "234": { flag: "🇳🇬", len: 10, ph: "80xxxxxxxx" } } as const;
type Code = keyof typeof CODES;

function deliveryField(name: string) {
  if (/tiktok/i.test(name)) return { label: "TikTok @username *", ph: "@username", pattern: "@.{2,}", title: "Must start with @" };
  if (/liby/i.test(name)) return { label: "Libya Number *", ph: "091xxxxxxx", pattern: "0?9\\d{8}", title: "Libya number like 091xxxxxxx" };
  return { label: "Player ID *", ph: "Player ID", pattern: ".{3,}", title: "At least 3 characters" };
}

export function saveLocalOrder(o: { tracking_id: string; product: string; date: string; whatsapp: string }) {
  try {
    const list = JSON.parse(localStorage.getItem("zentra_orders") ?? "[]");
    localStorage.setItem("zentra_orders", JSON.stringify([o, ...list.filter((x: { tracking_id: string }) => x.tracking_id !== o.tracking_id)].slice(0, 30)));
  } catch { /* ignore */ }
}

export function BuyDialog({ product, onClose }: { product: PublicProduct | null; onClose: () => void }) {
  const { data: settings } = useQuery(publicSettingsQuery);
  const [playerId, setPlayerId] = useState("");
  const [cc, setCc] = useState<Code>("218");
  const [wa, setWa] = useState("");
  const [txn, setTxn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);
  const field = deliveryField(product?.name ?? "");
  const local = wa.replace(/\D/g, "").replace(/^0+/, "");
  const fullWa = `+${cc}${local}`;

  const close = () => { setResult(null); setFile(null); setTxn(""); onClose(); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !file) { toast.error("Please upload your payment receipt"); return; }
    if (local.length !== CODES[cc].len) { toast.error(`WhatsApp number must be ${CODES[cc].len} digits after +${cc}`); return; }
    setBusy(true);
    try {
      const hash = await sha256File(file);
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "_")}`;
      const up = await supabase.storage.from("receipts").upload(path, file);
      if (up.error) throw up.error;
      const { data, error } = await supabase.rpc("place_order", {
        _product_id: product.id, _player_id: playerId.trim(), _whatsapp: fullWa,
        _receipt_url: path, _receipt_hash: hash, _transaction_id: txn.trim(),
      });
      if (error) throw error;
      const r = data as unknown as Result;
      saveLocalOrder({ tracking_id: r.order_code, product: product.name, date: new Date().toISOString(), whatsapp: fullWa });
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card">
        <DialogHeader><DialogTitle className="font-display">{product?.name}</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-4 text-center">
            {result.pin ? <CheckCircle2 className="mx-auto h-12 w-12 text-primary" /> : <Clock className="mx-auto h-12 w-12 text-warning" />}
            <p className="text-sm text-muted-foreground">Your tracking ID</p>
            <p className="font-display text-3xl font-bold text-accent">{result.order_code}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(result.order_code); toast.success("Copied"); }}>Copy</Button>
              <Button asChild><a target="_blank" rel="noreferrer" href={waLink(fullWa, `My ZENTRA order: ${result.order_code} (${product?.name ?? ""})`)}>Send to my WhatsApp</a></Button>
            </div>
            {result.pin ? (
              <>
                <p className="font-semibold text-primary">Auto-Delivered!</p>
                <p className="rounded-lg bg-secondary p-3 font-mono text-lg">{result.pin}</p>
                {settings && product && (
                  <Button asChild><a target="_blank" rel="noreferrer" href={waLink(fullWa, fillTemplate(settings.whatsapp_template, { order: result.order_code, product: product.name, pin: result.pin }))}>Save PIN to my WhatsApp</a></Button>
                )}
              </>
            ) : (
              <p className="text-sm">{result.status === "paid_waiting_manual"
                ? "✅ Payment confirmed! Your top-up will be done manually within 5–15 mins. We'll confirm on WhatsApp."
                : result.status === "rejected"
                  ? `Order rejected: ${(result as Result & { reject_reason?: string }).reject_reason ?? "please contact support"}`
                  : "Waiting for OPay payment confirmation. This usually takes a minute — check My Orders."}</p>
            )}
            <Button variant="outline" asChild><Link to="/track" onClick={close}>My Orders</Link></Button>
          </div>
        ) : product && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              <p>Pay <b className="text-lg text-primary">EXACTLY {naira(product.price_naira)}</b> to:</p>
              <p className="mt-1 font-semibold">OPay {settings?.opay_number ?? "9045001199"}</p>
              <p>{settings?.opay_name ?? "Samuel Kingsley"}</p>
            </div>
            {product.how_to_use && <p className="text-xs text-muted-foreground">{product.how_to_use}</p>}
            <div className="space-y-1"><Label>{field.label}</Label><Input required pattern={field.pattern} title={field.title} placeholder={field.ph} value={playerId} onChange={(e) => setPlayerId(e.target.value)} /></div>
            <div className="space-y-1"><Label>Your WhatsApp number *</Label>
              <div className="flex gap-2">
                <select value={cc} onChange={(e) => setCc(e.target.value as Code)} className="rounded-md border border-input bg-background px-2 text-sm">
                  {(Object.keys(CODES) as Code[]).map((k) => <option key={k} value={k}>{CODES[k].flag} +{k}</option>)}
                </select>
                <Input required type="tel" placeholder={CODES[cc].ph} value={wa} onChange={(e) => setWa(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment receipt *</Label>
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm ${drag ? "border-primary bg-primary/10" : "border-border"}`}>
                {file ? <img src={URL.createObjectURL(file)} alt="Receipt preview" className="max-h-40 rounded" /> : <><Upload className="h-6 w-6 text-primary" />Drag & drop or tap to upload</>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="space-y-1"><Label>Transaction ID *</Label><Input required minLength={4} value={txn} onChange={(e) => setTxn(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Submitting..." : "Submit order"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
