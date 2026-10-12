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
import { fillTemplate, naira, settingsQuery, sha256File, waLink, type PublicProduct } from "@/lib/store";

type Result = { order_code: string; status: string; pin: string | null };

export function BuyDialog({ product, onClose }: { product: PublicProduct | null; onClose: () => void }) {
  const { data: settings } = useQuery(settingsQuery);
  const [playerId, setPlayerId] = useState("");
  const [wa, setWa] = useState("");
  const [txn, setTxn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);

  const close = () => { setResult(null); setFile(null); setTxn(""); onClose(); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product || !file) return toast.error("Please upload your payment receipt");
    setBusy(true);
    try {
      const hash = await sha256File(file);
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "_")}`;
      const up = await supabase.storage.from("receipts").upload(path, file);
      if (up.error) throw up.error;
      const { data, error } = await supabase.rpc("place_order", {
        _product_id: product.id, _player_id: playerId.trim(), _whatsapp: wa.trim(),
        _receipt_url: path, _receipt_hash: hash, _transaction_id: txn.trim(),
      });
      if (error) throw error;
      setResult(data as unknown as Result);
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
            <p className="text-sm text-muted-foreground">Your order ID</p>
            <p className="font-display text-2xl font-bold text-accent">{result.order_code}</p>
            {result.pin ? (
              <>
                <p className="font-semibold text-primary">Auto-Delivered!</p>
                <p className="rounded-lg bg-secondary p-3 font-mono text-lg">{result.pin}</p>
                {settings && product && (
                  <Button asChild><a target="_blank" rel="noreferrer" href={waLink(wa, fillTemplate(settings.whatsapp_template, { order: result.order_code, product: product.name, pin: result.pin }))}>Save PIN to my WhatsApp</a></Button>
                )}
              </>
            ) : (
              <p className="text-sm">Pending verification. We'll send your PIN on WhatsApp after checking your payment. Save your order ID.</p>
            )}
            <Button variant="outline" asChild><Link to="/track" onClick={close}>Track order</Link></Button>
          </div>
        ) : product && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              <p>Pay <b className="text-lg text-primary">EXACTLY {naira(product.price_naira)}</b> to:</p>
              <p className="mt-1 font-semibold">OPay {settings?.opay_number ?? "9045001199"}</p>
              <p>{settings?.opay_name ?? "Samuel Kingsley"}</p>
            </div>
            {product.how_to_use && <p className="text-xs text-muted-foreground">{product.how_to_use}</p>}
            <div className="space-y-1"><Label>Player ID / Phone number *</Label><Input required minLength={3} value={playerId} onChange={(e) => setPlayerId(e.target.value)} /></div>
            <div className="space-y-1"><Label>Your WhatsApp number *</Label><Input required type="tel" minLength={6} placeholder="+218..." value={wa} onChange={(e) => setWa(e.target.value)} /></div>
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
