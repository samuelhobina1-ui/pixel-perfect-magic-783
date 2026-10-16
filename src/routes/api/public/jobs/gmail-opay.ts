import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const GW = "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me";
const Q =
  'is:unread newer_than:2d from:(alerts@moniepoint.com OR no-reply@moniepoint.com OR noreply@moniepoint.com) ' +
  '("Credit Alert" OR "You have received" OR "Payment Received" OR "Transaction Alert - Credit" OR credit)';

function decode(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };
function bodyText(p: Part): string {
  if (p.mimeType === "text/plain" && p.body?.data) return decode(p.body.data);
  for (const c of p.parts ?? []) { const t = bodyText(c); if (t) return t; }
  if (p.body?.data) return decode(p.body.data).replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#8358;/g, (m) => (m === "&nbsp;" ? " " : "₦"));
  return "";
}

export const ACCOUNT = "5339964934";

// Parses a Moniepoint credit alert. Rejects alerts naming a different account. Exported for tests.
export function parseMoniepoint(text: string, account = ACCOUNT) {
  if (/debit/i.test(text) && !/credit/i.test(text)) return null;
  const acct = text.match(/Account\s*(?:Number|No\.?)?\s*[:\-]?\s*(\d{10})/i)?.[1];
  if (acct && acct !== account) return null;
  const m = text.match(/(?:Credit\s*Amount\s*[:\-]?\s*)?(?:₦|NGN)\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const amount = Number((m[1] ?? "").replace(/,/g, ""));
  if (!amount) return null;
  const sender = text.match(/(?:from|sender(?:'|’)?s?(?:\s*name)?|by)\s*[:\-]?\s*(?:from\s+)?([A-Z][A-Za-z.' ]{2,60}?)(?=\s{2,}|\s*(?:\||,|\.|\n|Account|Amount|Narration|on |Date|Ref|$))/i)?.[1]?.trim() ?? null;
  return { amount, sender, account: acct ?? null };
}

// Polls the owner's Gmail every minute for Moniepoint credit alerts and auto-confirms the matching pending order.
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
        const results = [];
        for (const { id } of ids) {
          const r = await fetch(`${GW}/messages/${id}?format=full`, { headers: h });
          if (!r.ok) { console.error(`Gmail get [${r.status}]: ${await r.text()}`); continue; }
          const m = (await r.json()) as { payload: Part; snippet?: string };
          const from = m.payload.headers?.find((x) => x.name.toLowerCase() === "from")?.value ?? "";
          const subject = m.payload.headers?.find((x) => x.name.toLowerCase() === "subject")?.value ?? "";
          const text = `${subject} ${bodyText(m.payload) || m.snippet || ""}`.replace(/\s+/g, " ").slice(0, 2000);
          const p = /@moniepoint\.com>?\s*$/i.test(from) ? parseMoniepoint(text) : null;
          let result: unknown = "skipped: not a Moniepoint credit alert";
          if (p) {
            const { data, error } = await supabaseAdmin.rpc("ingest_bank_alert", { _ref: `MP-${id}`, _amount: p.amount, _sender: p.sender ?? "", _message: text });
            result = error ? error.message : data;
          }
          console.log("[gmail-moniepoint]", id, from, JSON.stringify(p), JSON.stringify(result));
          results.push({ id, parsed: p, result });
          await fetch(`${GW}/messages/${id}/modify`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) });
        }
        return Response.json({ checked: ids.length, results });
      },
    },
  },
});
