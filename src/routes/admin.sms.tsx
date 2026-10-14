import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/store";

export const Route = createFileRoute("/admin/sms")({ component: Sms });

const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

function Sms() {
  const [q, setQ] = useState("");
  const { data: rows = [] } = useQuery({
    queryKey: ["sms-log"], refetchInterval: 15000,
    queryFn: async () => (await supabase.from("opay_sms_log").select("*").order("received_at", { ascending: false }).limit(300)).data ?? [],
  });
  const { data: token } = useQuery({
    queryKey: ["sms-token"],
    queryFn: async () => (await supabase.from("settings").select("sms_webhook_token").eq("id", 1).single()).data?.sms_webhook_token ?? "",
  });
  const hook = token ? `${window.location.origin}/api/public/opay-sms?token=${token}` : "";
  const list = rows.filter((r) => r.txn_id.includes(q.trim()));
  return (
    <div className="space-y-6">
      <section className="card-glow space-y-2 p-4 text-sm">
        <h2 className="text-lg font-bold text-primary">SMS setup</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>On the phone that gets OPay alerts, install an "SMS Forwarder" app.</li>
          <li>Add a rule: messages from <b>OPay</b> → forward to the web link below, method <b>POST</b>.</li>
          <li>Send yourself a test. It should appear in the list below within seconds.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Keep this link private — anyone with it could add fake payments. Use your published site address, not the preview.</p>
        <div className="flex gap-2"><Input readOnly value={hook} className="font-mono text-xs" /><Button size="sm" onClick={() => copy(hook)}>Copy</Button></div>
      </section>
      <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">OPay SMS log</h1><Input className="ml-auto max-w-xs" placeholder="Search TxnID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-2">TxnID</th><th>Amount</th><th>Sender</th><th>Full SMS</th><th>Time</th><th>Used?</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="p-2 font-mono"><button onClick={() => copy(r.txn_id)} className="hover:text-primary">{r.txn_id} 📋</button></td>
              <td>{naira(r.amount)}</td><td>{r.sender_name}</td>
              <td className="max-w-xs text-xs text-muted-foreground">{r.raw_full_sms}</td>
              <td className="whitespace-nowrap">{new Date(r.received_at).toLocaleString()}</td>
              <td>{r.is_processed ? <span className="text-primary">Yes</span> : <span className="text-warning">No</span>}</td>
            </tr>))}</tbody>
        </table>
        {!list.length && <p className="p-6 text-center text-muted-foreground">No SMS yet.</p>}
      </div>
    </div>
  );
}
