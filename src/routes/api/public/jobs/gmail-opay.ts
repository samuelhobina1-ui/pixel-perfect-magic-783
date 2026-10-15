import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const GW = "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me";
const Q = "is:unread newer_than:2d (subject:opay OR from:noreply) NGN TxnID";

function decode(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
function bodyText(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data) return decode(p.body.data);
  for (const c of p.parts ?? []) { const t = bodyText(c); if (t) return t; }
  if (p.body?.data) return decode(p.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

// Polls the owner's Gmail for forwarded OPay SMS and feeds them into the same matcher as the SMS webhook.
export const Route = createFileRoute("/api/public/jobs/gmail-opay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = await authenticateCronRequest(request);
        if (fail) return fail;
        const lk = process.env["LOVABLE_API_KEY"], gk = process.env["GOOGLE_MAIL_API_KEY"];
        if (!lk || !gk) return new Response("Gmail not connected", { status: 500 });
        const h = { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk };
        const list = await fetch(`${GW}/messages?maxResults=20&q=${encodeURIComponent(Q)}`, { headers: h });
        if (!list.ok) { const t = await list.text(); console.error(`Gmail list [${list.status}]: ${t}`); return new Response(t, { status: 502 }); }
        const ids = ((await list.json()) as { messages?: { id: string }[] }).messages ?? [];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: s } = await supabaseAdmin.from("settings").select("sms_webhook_token").eq("id", 1).single();
        const results = [];
        for (const { id } of ids) {
          const r = await fetch(`${GW}/messages/${id}?format=full`, { headers: h });
          if (!r.ok) { console.error(`Gmail get [${r.status}]: ${await r.text()}`); continue; }
          const m = (await r.json()) as { payload: Part; snippet?: string };
          const text = (bodyText(m.payload) || m.snippet || "").replace(/\s+/g, " ").slice(0, 2000);
          const { data, error } = await supabaseAdmin.rpc("ingest_opay_sms", { _token: s?.sms_webhook_token ?? "", _message: text });
          const parsed = (data as { parsed?: { txn_id: string } } | null)?.parsed;
          if (parsed) await supabaseAdmin.from("opay_sms_log").update({ source: "gmail" }).eq("txn_id", parsed.txn_id);
          console.log("[gmail-opay]", id, error?.message ?? JSON.stringify(data));
          results.push({ id, result: error ? error.message : data });
          await fetch(`${GW}/messages/${id}/modify`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) });
        }
        return Response.json({ checked: ids.length, results });
      },
    },
  },
});
